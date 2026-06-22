import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'
import { waitUntil } from '@vercel/functions'

import { callClaude } from '@/lib/claude'
import { getSession, updateSession, acquireGenerationLock, markReportComplete, markReportFailed, indexSessionForRecovery } from '@/lib/redis'
import { reportLimiter, getClientIp } from '@/lib/ratelimit'
import {
  buildDiagnosticBriefSystem,
  buildQuoteShieldSystem,
  buildUpdateSystem,
  buildQuoteComparisonSystem,
  sanitizeInput,
} from '@/lib/prompts'
import {
  diagnosticBriefSchema,
  quoteShieldSchema,
  generateReportRequestSchema,
  updateReportRequestSchema,
  quoteComparisonResultSchema,
  MAX_BODY_BYTES,
} from '@/lib/validators'
import { parseJsonBody } from '@/lib/http'
import { filesHaveValidSignatures } from '@/lib/fileValidation'
import { stripe } from '@/lib/stripe'
import { getCategoryLabel, getRelatedAreaLabels } from '@/lib/constants'
import {
  accessCookieName,
  accessCookieOptions,
  accessWindowSeconds,
  createAccessToken,
  hasValidAccess,
} from '@/lib/access'
import { sendReportReadyEmail, sendReportFailedEmail, sendOpsAlert } from '@/lib/email'
import type {
  AnalyzedQuote,
  DiagnosticBriefReport,
  GenerateReportResponse,
  QuoteComparison,
  QuoteShieldReport,
  StoredSession,
  UpdateReportResponse,
  UploadedFile,
} from '@/lib/types'

/** Max contractor quotes that can be compared at once (original + 2 added). */
const MAX_QUOTES = 3

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


// ─── Multi-quote comparison ───────────────────────────────────────────────────

/** Normalize a nullish AI string/number into an optional value. */
function opt<T>(v: T | null | undefined): T | undefined {
  return v === null || v === undefined ? undefined : v
}

/**
 * Runs the cross-quote comparison: analyzes the newly uploaded quote against the
 * original report and any quotes already on file, then returns the full
 * normalized set (stable ids/facts preserved) plus the best-value recommendation.
 */
async function runQuoteComparison(
  session: StoredSession,
  newFiles: UploadedFile[],
): Promise<{ quotes: AnalyzedQuote[]; comparison: QuoteComparison }> {
  const categoryLabel = getCategoryLabel(session.category)
  const report        = session.report as QuoteShieldReport
  const existing      = session.quotes ?? []
  // Quotes already analyzed beyond the original (the AI re-derives the original
  // from the report itself, so it is not passed in this list).
  const priorAdded    = existing.filter((q) => !q.isOriginal)

  const result = await callClaude({
    system: buildQuoteComparisonSystem(
      categoryLabel,
      session.zip,
      report,
      priorAdded,
      session.description,
    ),
    userText:  'Analyze the attached new contractor quote and compare it against the quotes described above.',
    files:     newFiles,
    schema:    quoteComparisonResultSchema,
    model:     'sonnet',
    maxTokens: 3500,
    retries:   0,
  })

  // Map AI output to stored AnalyzedQuote[], preserving ids/addedAt for quotes
  // already on file (matched by position — the prompt fixes the order).
  const now = new Date().toISOString()
  const quotes: AnalyzedQuote[] = result.quotes.map((q, i) => {
    const prev = existing[i]
    return {
      id:               prev?.id ?? randomUUID(),
      label:            q.label,
      contractorName:   opt(q.contractorName),
      quotedTotal:      opt(q.quotedTotal),
      adjustedTotal:    opt(q.adjustedTotal),
      pricingVerdict:   q.pricingVerdict,
      fairMin:          q.fairMin,
      fairMax:          q.fairMax,
      scopeVerdict:     q.scopeVerdict,
      diagnosisVerdict: q.diagnosisVerdict,
      includedItems:    q.includedItems,
      missingItems:     q.missingItems,
      upsells:          q.upsells,
      redFlags:         q.redFlags,
      greenFlags:       q.greenFlags,
      warranty:         opt(q.warranty),
      timeline:         opt(q.timeline),
      summary:          q.summary,
      isOriginal:       i === 0,
      addedAt:          prev?.addedAt ?? now,
    }
  })

  const recIdx = Math.min(result.recommendedIndex, quotes.length - 1)
  const comparison: QuoteComparison = {
    recommendedQuoteId:   quotes[recIdx].id,
    recommendationReason: result.recommendationReason,
    negotiationLeverage:  result.negotiationLeverage,
    keyDifferences:       result.keyDifferences,
    generatedAt:          now,
  }

  return { quotes, comparison }
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
  // Payer's checkout email — used to send the report-ready / failure email.
  payerEmail?: string,
): Promise<void> {
  // Outer try-catch ensures markReportFailed is ALWAYS called on any failure,
  // including errors that occur before the Claude call (e.g. getCategoryLabel).
  // Previously, errors here left the session stuck in 'generating' forever.
  try {
    const categoryLabel = getCategoryLabel(session.category)
    const relatedLabels = getRelatedAreaLabels(session.category, session.relatedAreas)

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
        system:    buildDiagnosticBriefSystem(categoryLabel, session.preview?.severity, relatedLabels),
        userText,
        schema:    diagnosticBriefSchema,
        model:     'sonnet',
        maxTokens: 3500,
        retries:   0,  // one attempt at 90s — retry adds no value when timeout is the failure mode
      })
      report = repairDiagnosticBrief(rawBrief)
    } else {
      const rawShield = await callClaude({
        system:    buildQuoteShieldSystem(
          categoryLabel,
          session.zip,
          session.preview ? { min: session.preview.costMin, max: session.preview.costMax } : undefined,
          relatedLabels,
        ),
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

    // Notify the buyer their report is ready (best-effort; dormant if email off).
    if (payerEmail && session.product) {
      await sendReportReadyEmail({
        to: payerEmail,
        sessionId,
        product: session.product,
        categoryLabel,
      })
    }

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
    // Ops alert + apology to the buyer (both best-effort, dormant if unconfigured).
    await sendOpsAlert(
      'Report generation failed',
      `session=${sessionId} flow=${session.flow} category=${session.category}\n${errorMessage}`,
    )
    if (payerEmail && session.product) {
      await sendReportFailedEmail({
        to: payerEmail,
        sessionId,
        product: session.product,
        categoryLabel: getCategoryLabel(session.category),
      })
    }
  }
}

// ─── POST /api/report — Verify payment, fire background generation ─────────────

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await reportLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429 },
    )
  }

  // ── Parse and validate (real-body size limit; POST carries quote files) ────
  const parsed = await parseJsonBody(req, MAX_BODY_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof generateReportRequestSchema.parse>
  try {
    data = generateReportRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (data.files && !filesHaveValidSignatures(data.files)) {
    return NextResponse.json(
      { error: 'One or more files appear corrupted or are not a supported image/PDF.' },
      { status: 400 },
    )
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
      paid:            true,
      paidAt:          new Date().toISOString(),
      payerEmail,
      stripeSessionId: data.stripeSessionId,
      product,
      reportStatus:    'generating',
    })
    // Index for email-based recovery (best-effort — never block the purchase).
    if (payerEmail) {
      try { await indexSessionForRecovery(payerEmail, reportSessionId) } catch { /* non-fatal */ }
    }
  } catch (err) {
    await releaseLock()
    console.error('[report] Failed to mark paid/generating:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 })
  }

  // The fetched session predates the paid/product update above; reflect the
  // current product so the background function emails with the right details.
  session.product = product

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
    generateAndSaveReport(reportSessionId, session, data.files ?? [], payerEmail).finally(async () => {
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
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await reportLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  // ── Parse and validate (real-body size limit) ──────────────────────────────
  const parsed = await parseJsonBody(req, MAX_BODY_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof updateReportRequestSchema.parse>
  try {
    data = updateReportRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (!filesHaveValidSignatures(data.files)) {
    return NextResponse.json(
      { error: 'One or more files appear corrupted or are not a supported image/PDF.' },
      { status: 400 },
    )
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

  // ── New quote → side-by-side comparison (does NOT overwrite the report) ─────
  if (data.updateType === 'new_quote') {
    if (data.files.length === 0) {
      return NextResponse.json(
        { error: 'Please upload the new quote document so we can compare it.' },
        { status: 400 },
      )
    }
    // Original counts as one quote even before the comparison set is created.
    const currentCount = session.quotes?.length ?? 1
    if (currentCount >= MAX_QUOTES) {
      return NextResponse.json(
        { error: `You can compare up to ${MAX_QUOTES} quotes. Remove one to add another.` },
        { status: 409 },
      )
    }

    let comparisonOut: { quotes: AnalyzedQuote[]; comparison: QuoteComparison }
    try {
      comparisonOut = await runQuoteComparison(session, data.files)
    } catch (err) {
      console.error('[report/update] Quote comparison failed:', {
        message: err instanceof Error ? err.message : 'Unknown error',
      })
      return NextResponse.json({ error: 'We couldn\'t analyze that quote. Please try again.' }, { status: 502 })
    }

    const recommended = comparisonOut.quotes.find((q) => q.id === comparisonOut.comparison.recommendedQuoteId)
    const updatedReport: QuoteShieldReport = {
      ...existingReport,
      updates: [
        ...(existingReport.updates ?? []),
        {
          timestamp:       new Date().toISOString(),
          updateType:      'new_quote',
          changedSections: ['Quote comparison'],
          summary:         `Added a quote — now comparing ${comparisonOut.quotes.length}. Best value: ${recommended?.label ?? 'see comparison'}.`,
        },
      ],
    }

    try {
      await updateSession(data.sessionId, {
        report:     updatedReport,
        quotes:     comparisonOut.quotes,
        comparison: comparisonOut.comparison,
      })
    } catch (err) {
      if (err instanceof Error && err.message.startsWith('LOCK_CONTENTION')) {
        return NextResponse.json(
          { error: 'Another update is in progress. Please try again in a moment.' },
          { status: 409 },
        )
      }
      console.error('[report/update] Redis update failed (comparison):', {
        message: err instanceof Error ? err.message : 'Unknown error',
      })
      return NextResponse.json({ error: 'Failed to save the comparison. Please try again.' }, { status: 503 })
    }

    const res: UpdateReportResponse = {
      report:     updatedReport,
      quotes:     comparisonOut.quotes,
      comparison: comparisonOut.comparison,
    }
    return NextResponse.json(res)
  }

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
