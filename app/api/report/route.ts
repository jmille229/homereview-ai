import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { waitUntil } from '@vercel/functions'

import { callClaude } from '@/lib/claude'
import { getSession, updateSession, acquireGenerationLock, markReportComplete, markReportFailed } from '@/lib/redis'
import { reportLimiter, getClientIp } from '@/lib/ratelimit'
import {
  buildDiagnosticBriefSystem,
  buildQuoteShieldSystem,
  buildUpdateSystem,
  sanitizeInput,
} from '@/lib/prompts'
import {
  diagnosticBriefSchema,
  quoteShieldSchema,
  generateReportRequestSchema,
  updateReportRequestSchema,
  MAX_BODY_BYTES,
} from '@/lib/validators'
import { stripe } from '@/lib/stripe'
import { getCategoryLabel } from '@/lib/constants'
import {
  accessCookieName,
  accessCookieOptions,
  accessWindowSeconds,
  createAccessToken,
  hasValidAccess,
} from '@/lib/access'
import type {
  DiagnosticBriefReport,
  GenerateReportResponse,
  QuoteShieldReport,
  StoredSession,
  UpdateReportResponse,
  UploadedFile,
} from '@/lib/types'

// ─── Schema repair ────────────────────────────────────────────────────────────

/**
 * Trims oversized arrays to their display limits after Zod validation passes.
 *
 * This is the correct layer for count enforcement. Zod validates structure
 * and types. This function enforces the product's display decisions. The two
 * concerns are separate: a model returning 7 credentials instead of 5 is not
 * a data error — it's extra content that we trim before saving.
 *
 * Result: reports always save successfully when structurally valid.
 * Users never see a failure because Sonnet was slightly generous with a list.
 */
function repairDiagnosticBrief(report: DiagnosticBriefReport): DiagnosticBriefReport {
  return {
    ...report,
    verifyCredentials: report.verifyCredentials.slice(0, 6),
    costFactors:       report.costFactors.slice(0, 6),
    questionsToAsk:    report.questionsToAsk.slice(0, 10),
    redFlags:          report.redFlags.slice(0, 6),
    insistOnWriting:   report.insistOnWriting.slice(0, 6),
  }
}

function repairQuoteShield(report: Omit<QuoteShieldReport, 'updates'>): QuoteShieldReport {
  return {
    ...report,
    upsells:             report.upsells.slice(0, 6),
    missingItems:        report.missingItems.slice(0, 6),
    redFlags:            report.redFlags.slice(0, 6),
    greenFlags:          report.greenFlags.slice(0, 6),
    contractorQuestions: report.contractorQuestions.slice(0, 8),
    beforeYouSign:       report.beforeYouSign.slice(0, 6),
    updates:             [],
  }
}


export const runtime    = 'nodejs'
export const maxDuration = 120  // 120s gives Sonnet full generation time + cleanup margin on cold starts

// ─── Background report generation ─────────────────────────────────────────────

/**
 * Runs inside waitUntil — executes after the HTTP response has been sent.
 * The function stays alive until this promise resolves (up to maxDuration).
 *
 * This pattern decouples payment acknowledgement (fast) from report generation
 * (slow), giving users immediate feedback while generation runs in the background.
 */
async function generateAndSaveReport(
  sessionId: string,
  session: StoredSession,
  // Files from sessionStorage — present for post-quote flow, absent for pre-quote.
  // Passed through from the POST handler so the background function has access
  // to the uploaded contractor quote document without re-fetching from anywhere.
  files: UploadedFile[] = [],
): Promise<void> {
  // Outer try-catch ensures markReportFailed is ALWAYS called on any failure,
  // including errors that occur before the Claude call (e.g. getCategoryLabel).
  // Previously, errors here left the session stuck in 'generating' forever.
  try {
    const categoryLabel = getCategoryLabel(session.category)

    const answersContext = (session.answers ?? []).length > 0
      ? '\n\nClarifying answers provided by homeowner:\n' +
        (session.answers ?? [])
          .map((a: { question: string; answer: string }) => `Q: ${a.question}\nA: ${a.answer}`)
          .join('\n\n')
      : ''

    const userText =
      `Issue description: ${session.description}${answersContext}\n` +
      `Zip code: ${session.zip || 'Not provided'}`

    let report: DiagnosticBriefReport | QuoteShieldReport

    if (session.flow === 'pre') {
      const rawBrief = await callClaude({
        system:    buildDiagnosticBriefSystem(categoryLabel),
        userText,
        schema:    diagnosticBriefSchema,
        model:     'sonnet',
        maxTokens: 3500,
        retries:   0,  // one attempt at 90s — retry adds no value when timeout is the failure mode
      })
      report = repairDiagnosticBrief(rawBrief)
    } else {
      const rawShield = await callClaude({
        system:    buildQuoteShieldSystem(categoryLabel, session.zip),
        userText,
        files,     // contractor quote document from sessionStorage — anchors fair price range
        schema:    quoteShieldSchema,
        model:     'sonnet',
        maxTokens: 3500,
        retries:   0,  // one attempt at 90s — retry adds no value when timeout is the failure mode
      })
      report = repairQuoteShield(rawShield)
    }

    await markReportComplete(sessionId, report)

  } catch (err) {
    // Log the ACTUAL error server-side for debugging, but persist only a
    // generic, user-safe message. The stored value is returned verbatim to the
    // browser by the status endpoint, so it must not leak internal details
    // (model names, timeouts, schema-validation internals).
    const errorMessage = err instanceof Error ? err.message : String(err)
    console.error('[report/generate] Generation failed:', {
      message: errorMessage,
      sessionId,
      flow: session.flow,
      category: session.category,
    })
    await markReportFailed(
      sessionId,
      'We couldn\'t finish building your report. Please try again — you won\'t be charged again.',
    )
  }
}

// ─── POST /api/report — Verify payment, fire background generation ─────────────

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const { success } = await reportLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
  }

  // ── Body size guard ────────────────────────────────────────────────────────
  // POST now accepts files (contractor quote documents from sessionStorage).
  // Enforce the same size limit as PATCH to prevent oversized payloads.
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let data: ReturnType<typeof generateReportRequestSchema.parse>
  try {
    data = generateReportRequestSchema.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // ── Verify Stripe payment ──────────────────────────────────────────────────
  let stripeSession: Awaited<ReturnType<typeof stripe.checkout.sessions.retrieve>>
  try {
    stripeSession = await stripe.checkout.sessions.retrieve(data.stripeSessionId)
  } catch {
    return NextResponse.json({ error: 'Payment verification failed.' }, { status: 400 })
  }

  if (stripeSession.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not completed.' }, { status: 402 })
  }

  const reportSessionId = stripeSession.metadata?.reportSessionId
  const product         = stripeSession.metadata?.product as StoredSession['product']

  if (!reportSessionId || !product) {
    console.error('[report] Missing metadata on Stripe session:', {
      stripeSessionId: data.stripeSessionId,
    })
    return NextResponse.json({ error: 'Invalid payment session.' }, { status: 400 })
  }

  // The email the buyer used at Stripe checkout — stored so they can reclaim
  // access on another device via /api/report/reclaim.
  const payerEmail = stripeSession.customer_details?.email?.toLowerCase().trim()

  // Payment is proven for this session: mint a per-session access cookie on
  // every success response below. This is what gates the report pages, chat,
  // and living-report updates — the session URL alone is no longer enough.
  const grant = (res: NextResponse): NextResponse => {
    const ttl = accessWindowSeconds(product)
    res.cookies.set(
      accessCookieName(reportSessionId),
      createAccessToken(reportSessionId, ttl),
      accessCookieOptions(ttl),
    )
    return res
  }

  // ── Fetch our session ──────────────────────────────────────────────────────
  let session: StoredSession | null
  try {
    session = await getSession(reportSessionId)
  } catch (err) {
    console.error('[report] Redis lookup failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
  }

  // ── Idempotency: if already complete, return immediately ───────────────────
  if (session.reportStatus === 'complete' && session.report) {
    const res: GenerateReportResponse = {
      status:    'generating', // client will poll and find 'complete' immediately
      sessionId: reportSessionId,
      product,
    }
    return grant(NextResponse.json(res))
  }

  // ── If already generating, check if it's stale (waitUntil may have timed out) ──
  if (session.reportStatus === 'generating') {
    const fiveMinutesMs = 5 * 60 * 1000
    const updatedAt = session.updatedAt ?? session.createdAt
    const isStale = Date.now() - new Date(updatedAt).getTime() > fiveMinutesMs
    if (!isStale) {
      // Genuinely in progress — tell client to keep polling
      const res: GenerateReportResponse = { status: 'generating', sessionId: reportSessionId, product }
      return grant(NextResponse.json(res, { status: 202 }))
    }
    // Stale — waitUntil likely timed out. Fall through to retry generation.
    console.error('[report] Stale generating state detected, retrying:', { sessionId: reportSessionId })
  }

  // ── Acquire generation lock ────────────────────────────────────────────────
  let releaseLock: (() => Promise<void>) | null = null
  try {
    releaseLock = await acquireGenerationLock(reportSessionId)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('LOCK_CONTENTION')) {
      return NextResponse.json(
        { error: 'Report generation is already in progress.' },
        { status: 409 },
      )
    }
    console.error('[report] Lock acquisition failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 })
  }

  // ── Mark paid and generating in Redis ────────────────────────────────────────
  // CRITICAL: paid:true is set HERE in the POST handler, not inside the
  // background generation function. The status polling endpoint checks
  // session.paid — if it's false during generation, every poll returns 404.
  try {
    await updateSession(reportSessionId, {
      paid:         true,
      paidAt:       new Date().toISOString(),
      payerEmail,
      product,
      reportStatus: 'generating',
    })
  } catch (err) {
    await releaseLock()
    console.error('[report] Failed to mark paid/generating:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 })
  }

  // ── Fire background generation and return immediately ──────────────────────
  //
  // waitUntil registers the promise but does NOT await it before sending the
  // response. The HTTP response is sent now (fast). Vercel keeps the function
  // alive until the promise resolves, up to maxDuration (120s).
  //
  // Result:
  //   - User gets a response in ~2-3 seconds (payment verified, generation started)
  //   - Generation runs in the background (20-40 seconds)
  //   - Client polls /api/report/status every 2 seconds
  //   - Total perceived wait time: 2-3 seconds to acknowledgement, not 40 seconds
  //
  waitUntil(
    generateAndSaveReport(reportSessionId, session, data.files ?? []).finally(async () => {
      // Always release the lock, whether generation succeeded or failed
      await releaseLock!()
    }),
  )

  const res: GenerateReportResponse = {
    status:    'generating',
    sessionId: reportSessionId,
    product,
  }
  return grant(NextResponse.json(res, { status: 202 })) // 202 Accepted — work in progress
}

// ─── PATCH /api/report — Update a Quote Shield living report ──────────────────

export async function PATCH(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const { success } = await reportLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  // ── HIGH-01: Reject oversized bodies before parsing ────────────────────────
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let data: ReturnType<typeof updateReportRequestSchema.parse>
  try {
    data = updateReportRequestSchema.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // ── Fetch and validate session ─────────────────────────────────────────────
  let session: StoredSession | null
  try {
    session = await getSession(data.sessionId)
  } catch (err) {
    console.error('[report/update] Redis lookup failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 })
  }

  if (!session || !session.paid || session.flow !== 'post' || !session.report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
  }

  // ── Require a valid access cookie (payment-bound capability) ────────────────
  if (!hasValidAccess(data.sessionId)) {
    return NextResponse.json(
      { error: 'Access expired. Please reopen your report to continue.' },
      { status: 401 },
    )
  }

  // ── Check 60-day update window ─────────────────────────────────────────────
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000
  if (Date.now() - new Date(session.paidAt ?? session.createdAt).getTime() > sixtyDaysMs) {
    return NextResponse.json(
      { error: 'The 60-day update window for this report has expired.' },
      { status: 403 },
    )
  }

  const existingReport = session.report as QuoteShieldReport
  const categoryLabel  = getCategoryLabel(session.category)
  const noteText       = data.note ? sanitizeInput(data.note) : ''

  const updateResponseSchema = z.object({
    changedSections: z.array(z.string()),
    updateSummary:   z.string().min(10),
    updates:         quoteShieldSchema.partial(),
  })

  let updateResult: {
    changedSections: string[]
    updateSummary: string
    updates: Partial<QuoteShieldReport>
  }

  try {
    updateResult = await callClaude({
      system: buildUpdateSystem(categoryLabel, data.updateType, existingReport),
      userText: noteText
        ? `New information (${data.updateType}): ${noteText}`
        : `New documents uploaded (type: ${data.updateType}). Analyze the attached materials.`,
      files:     data.files,
      schema:    updateResponseSchema,
      model:     'haiku',
      maxTokens: 2000,
      retries:   0,
    })
  } catch (err) {
    console.error('[report/update] Claude call failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Update generation failed. Please try again.' }, { status: 502 })
  }

  const updatedReport: QuoteShieldReport = {
    ...existingReport,
    ...updateResult.updates,
    updates: [
      ...(existingReport.updates ?? []),
      {
        timestamp:       new Date().toISOString(),
        updateType:      data.updateType,
        changedSections: updateResult.changedSections,
        summary:         updateResult.updateSummary,
      },
    ],
  }

  try {
    await updateSession(data.sessionId, { report: updatedReport })
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('LOCK_CONTENTION')) {
      return NextResponse.json(
        { error: 'Another update is in progress. Please try again in a moment.' },
        { status: 409 },
      )
    }
    console.error('[report/update] Redis update failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Failed to save update. Please try again.' }, { status: 503 })
  }

  const res: UpdateReportResponse = { report: updatedReport }
  return NextResponse.json(res)
}
