import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { getSession } from '@/lib/redis'
import { reclaimLimiter, getClientIp } from '@/lib/ratelimit'
import { reclaimRequestSchema } from '@/lib/validators'
import {
  accessCookieName,
  accessCookieOptions,
  accessWindowSeconds,
  createAccessToken,
} from '@/lib/access'

export const runtime = 'nodejs'

/**
 * POST /api/report/reclaim
 *
 * Re-grants access to a paid report on a new device. The caller proves
 * ownership by supplying the email they used at Stripe checkout, which we
 * compare against the email stored on the session. On success we mint the same
 * per-session access cookie that /api/report issues after payment.
 *
 * Email is not a strong secret, so this is rate-limited to blunt guessing and
 * responses are deliberately generic — they never confirm whether a session
 * exists or which email is on file.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req)
  const { success } = await reclaimLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait an hour and try again.' },
      { status: 429 },
    )
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let data: ReturnType<typeof reclaimRequestSchema.parse>
  try {
    data = reclaimRequestSchema.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession(data.sessionId)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  // Generic failure for every "can't grant" case — never reveal existence,
  // payment status, or the email on file.
  const deny = () =>
    NextResponse.json(
      { error: "That email doesn't match the one used to purchase this report." },
      { status: 403 },
    )

  if (!session || !session.paid || !session.product) return deny()
  if (!session.payerEmail) return deny()

  const submitted = data.email.toLowerCase().trim()
  if (submitted !== session.payerEmail) return deny()

  // Match — mint the per-session access cookie and hand back the report path.
  const reportPath = `/report/${session.flow === 'pre' ? 'brief' : 'shield'}/${session.id}`
  const ttl = accessWindowSeconds(session.product)

  const res = NextResponse.json({ reportPath })
  res.cookies.set(
    accessCookieName(session.id),
    createAccessToken(session.id, ttl),
    accessCookieOptions(ttl),
  )
  return res
}
