import { NextResponse } from 'next/server'
import { getSession } from '@/lib/redis'
import { statusLimiter, getClientIp } from '@/lib/ratelimit'
import type { ReportStatusResponse } from '@/lib/types'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * GET /api/report/status/[sessionId]
 *
 * Polling endpoint for the success page. Called every 2 seconds while
 * the background report generation (waitUntil) is running.
 *
 * Returns:
 *   - { status: 'generating' }           — still in progress, poll again
 *   - { status: 'complete', reportPath } — done, redirect to reportPath
 *   - { status: 'failed', error }        — generation failed, show error
 */
export async function GET(
  req: Request,
  { params }: { params: { sessionId: string } },
): Promise<NextResponse> {
  // ── Rate limit — dedicated status limiter (300/h) sized for 2s polling ─────
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await statusLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  // ── Validate session ID format ─────────────────────────────────────────────
  const { sessionId } = params
  if (!sessionId || !UUID_RE.test(sessionId)) {
    return NextResponse.json({ error: 'Invalid session ID.' }, { status: 400 })
  }

  // ── Fetch session from Redis ───────────────────────────────────────────────
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession(sessionId)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  // Check session exists and has been initiated for generation.
  // We check reportStatus rather than session.paid because paid is set
  // in the POST handler immediately — but as an extra safety check, both
  // should be true for any legitimate polling request.
  if (!session || !session.reportStatus) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  }

  // ── Map session state to status response ───────────────────────────────────
  const status = session.reportStatus ?? 'generating'

  if (status === 'failed') {
    const res: ReportStatusResponse = {
      status: 'failed',
      error:  session.reportError ?? 'Report generation failed. Please contact support.',
    }
    return NextResponse.json(res)
  }

  if (status === 'complete' && session.report && session.product) {
    // Determine the correct report path based on flow
    const reportType = session.flow === 'pre' ? 'brief' : 'shield'
    const res: ReportStatusResponse = {
      status:     'complete',
      reportPath: `/report/${reportType}/${sessionId}`,
    }
    return NextResponse.json(res)
  }

  // Still generating (or no status set yet — treat as generating)
  const res: ReportStatusResponse = { status: 'generating' }
  return NextResponse.json(res)
}
