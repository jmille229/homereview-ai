import { NextResponse } from 'next/server'

import { getSession } from '@/lib/redis'
import { nurtureLinkLimiter, getClientIp } from '@/lib/ratelimit'
import { verifyCheckoutLinkToken } from '@/lib/access'
import { createReportCheckout } from '@/lib/checkout'
import { productForFlow } from '@/lib/nurtureEmails'

export const runtime = 'nodejs'

/**
 * One-click "Get my report" link from nurture emails. The visitor's browser no
 * longer has their preview in sessionStorage, so instead of sending them back
 * through the funnel we verify the signed link and go straight to Stripe, with
 * their email prefilled. Anything off (bad link, expired or already-paid
 * session) lands somewhere useful rather than on an error.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const base = (process.env.NEXT_PUBLIC_BASE_URL ?? new URL(req.url).origin).replace(/\/$/, '')
  const home = NextResponse.redirect(`${base}/`, 303)

  const url       = new URL(req.url)
  const sessionId = url.searchParams.get('session') ?? ''
  const token     = url.searchParams.get('t')
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || !verifyCheckoutLinkToken(sessionId, token)) return home

  const ip = getClientIp(req)
  if (!ip) return home
  const { success } = await nurtureLinkLimiter.limit(ip)
  if (!success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession(sessionId)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }
  // Expired preview: start fresh. Already bought: help them find the report.
  if (!session) return home
  if (session.paid) return NextResponse.redirect(`${base}/recover`, 303)

  try {
    const checkout = await createReportCheckout({
      baseUrl:       base,
      sessionId,
      product:       productForFlow(session.flow),
      customerEmail: session.leadEmail,
      cancelPath:    '/',
    })
    if (!checkout.url) return home
    return NextResponse.redirect(checkout.url, 303)
  } catch (err) {
    console.error('[nurture-checkout] Stripe session creation failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return home
  }
}
