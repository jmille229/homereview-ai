import { NextResponse } from 'next/server'
import { z, ZodError } from 'zod'

import { callClaude } from '@/lib/claude'
import { getSession, updateSession, acquireGenerationLock } from '@/lib/redis'
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
import type {
  DiagnosticBriefReport,
  GenerateReportResponse,
  QuoteShieldReport,
  StoredSession,
  UpdateReportResponse,
} from '@/lib/types'

export const runtime = 'nodejs'

const CATEGORY_LABELS: Record<string, string> = {
  hvac:        'HVAC (Heating, Cooling & Air Quality)',
  plumbing:    'Plumbing',
  electrical:  'Electrical',
  roofing:     'Roofing & Exterior',
  foundation:  'Foundation & Structure',
  appliances:  'Appliances',
  pest:        'Pest & Mold',
  maintenance: 'General Maintenance',
}

// ─── POST /api/report — Generate full report after payment ────────────────────

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

  // ── Parse and validate ─────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
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
    // MED-03: Generic message — don't expose Stripe API details
    return NextResponse.json({ error: 'Payment verification failed.' }, { status: 400 })
  }

  if (stripeSession.payment_status !== 'paid') {
    return NextResponse.json({ error: 'Payment not completed.' }, { status: 402 })
  }

  const reportSessionId = stripeSession.metadata?.reportSessionId
  const product         = stripeSession.metadata?.product as StoredSession['product']

  if (!reportSessionId || !product) {
    // MED-03: Log the detail; surface a generic message
    console.error('[report] Missing metadata on Stripe session:', {
      stripeSessionId: data.stripeSessionId,
    })
    return NextResponse.json({ error: 'Invalid payment session.' }, { status: 400 })
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

  // MED-03: Use a single generic message for all "not found" states
  if (!session) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
  }

  // ── Idempotency: return early if already generated ─────────────────────────
  if (session.paid && session.report) {
    const res: GenerateReportResponse = { sessionId: reportSessionId, product }
    return NextResponse.json(res)
  }

  // ── CRIT-02: Acquire generation lock before calling Claude ─────────────────
  // Prevents two concurrent requests for the same session (e.g., browser
  // double-submit, or a race between the success page and a retry) from
  // both passing the paid check and triggering duplicate Claude calls.
  let releaseLock: (() => Promise<void>) | null = null
  try {
    releaseLock = await acquireGenerationLock(reportSessionId)
  } catch (err) {
    if (err instanceof Error && err.message.startsWith('LOCK_CONTENTION')) {
      // Another request is already generating this report — ask the client to retry
      return NextResponse.json(
        { error: 'Report generation is already in progress. Please wait a moment.' },
        { status: 409 },
      )
    }
    console.error('[report] Lock acquisition failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Service unavailable. Please try again.' }, { status: 503 })
  }

  // ── Generate report ────────────────────────────────────────────────────────
  const categoryLabel = CATEGORY_LABELS[session.category] ?? session.category
  const userText      = `Issue description: ${session.description}\nZip code: ${session.zip || 'Not provided'}`

  let report: DiagnosticBriefReport | QuoteShieldReport

  try {
    if (session.flow === 'pre') {
      report = await callClaude({
        system:    buildDiagnosticBriefSystem(categoryLabel),
        userText,
        schema:    diagnosticBriefSchema,
        model:     'sonnet',
        maxTokens: 2500,
      })
    } else {
      const shieldReport = await callClaude({
        system:    buildQuoteShieldSystem(categoryLabel, session.zip),
        userText,
        schema:    quoteShieldSchema,
        model:     'sonnet',
        maxTokens: 2500,
      })
      report = { ...shieldReport, updates: [] }
    }
  } catch (err) {
    console.error('[report] Claude call failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Report generation failed. Please try again.' },
      { status: 502 },
    )
  } finally {
    // Always release the lock — even if Claude fails
    await releaseLock()
  }

  // ── Persist paid status + report ───────────────────────────────────────────
  try {
    await updateSession(reportSessionId, {
      paid:   true,
      paidAt: new Date().toISOString(),
      product,
      report,
    })
  } catch (err) {
    console.error('[report] Redis update failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Failed to save report. Please contact support.' },
      { status: 503 },
    )
  }

  const res: GenerateReportResponse = { sessionId: reportSessionId, product }
  return NextResponse.json(res)
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
  try {
    body = await req.json()
  } catch {
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

  // MED-03: Collapse all "not found / wrong state" into a single generic message
  if (!session || !session.paid || session.flow !== 'post' || !session.report) {
    return NextResponse.json({ error: 'Report not found.' }, { status: 404 })
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
  const categoryLabel  = CATEGORY_LABELS[session.category] ?? session.category
  const noteText       = data.note ? sanitizeInput(data.note) : ''

  // ── Update response schema (defined inline — only used in PATCH) ───────────
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
      model:     'sonnet',
      maxTokens: 2000,
    })
  } catch (err) {
    console.error('[report/update] Claude call failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Update generation failed. Please try again.' }, { status: 502 })
  }

  // ── Merge update into existing report ──────────────────────────────────────
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
