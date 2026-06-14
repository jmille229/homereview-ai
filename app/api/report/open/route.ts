import { NextResponse } from 'next/server'

import { getSession } from '@/lib/redis'
import { accessCookieName, accessCookieOptions, accessWindowSeconds, verifyAccessToken } from '@/lib/access'

export const runtime = 'nodejs'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

/**
 * GET /api/report/open?session=<id>&t=<access-token>
 *
 * Magic-link target for emailed report links. Verifies the signed access token,
 * sets the per-session access cookie, and redirects to the report — so the buyer
 * lands straight in their report from any device. On any failure it falls back
 * to the email-reclaim flow rather than erroring.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const url = new URL(req.url)
  const sessionId = url.searchParams.get('session') ?? ''
  const token = url.searchParams.get('t') ?? ''
  const base = process.env.NEXT_PUBLIC_BASE_URL ?? url.origin

  const fail = () => NextResponse.redirect(`${base}/recover`)

  if (!UUID_RE.test(sessionId) || !verifyAccessToken(sessionId, token)) {
    return sessionId && UUID_RE.test(sessionId)
      ? NextResponse.redirect(`${base}/unlock?session=${sessionId}`)
      : fail()
  }

  const session = await getSession(sessionId).catch(() => null)
  if (!session || !session.paid || !session.product) return fail()

  const type = session.flow === 'pre' ? 'brief' : 'shield'
  const res = NextResponse.redirect(`${base}/report/${type}/${sessionId}`)
  const ttl = accessWindowSeconds(session.product)
  res.cookies.set(accessCookieName(sessionId), token, accessCookieOptions(ttl))
  return res
}
