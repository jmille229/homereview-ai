import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { getSession, updateSession } from '@/lib/redis'
import { leadLimiter, getClientIp } from '@/lib/ratelimit'
import { leadCaptureRequestSchema, MAX_JSON_BYTES } from '@/lib/validators'
import { parseJsonBody } from '@/lib/http'
import { emailEnabled } from '@/lib/email'
import { startNurture } from '@/lib/nurture'

export const runtime = 'nodejs'

/**
 * Optional email capture on the free preview: emails the visitor their preview
 * and enrolls them in the short nurture sequence (lib/nurture.ts). Once per
 * session; a repeat submit is a no-op that still reports success.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await leadLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 })
  }

  if (!emailEnabled()) {
    return NextResponse.json({ error: "Email isn't available right now." }, { status: 503 })
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof leadCaptureRequestSchema.parse>
  try {
    data = leadCaptureRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // ── Validate session ───────────────────────────────────────────────────────
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession(data.sessionId)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }
  if (!session) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  }
  if (session.paid) {
    return NextResponse.json({ error: 'This session has already been purchased.' }, { status: 400 })
  }

  // ── Store + send ───────────────────────────────────────────────────────────
  // The first email given for a session sticks. Re-running startNurture is a
  // no-op once the lead exists, and finishes the job if a previous attempt
  // saved the email but failed before enrolling it.
  try {
    if (!session.leadEmail) {
      await updateSession(data.sessionId, {
        leadEmail:      data.email,
        leadCapturedAt: new Date().toISOString(),
      })
    }
    await startNurture(data.sessionId, session.leadEmail ?? data.email)
  } catch (err) {
    console.error('[preview-email] capture failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Could not save your email. Please try again.' }, { status: 503 })
  }

  return NextResponse.json({ ok: true })
}
