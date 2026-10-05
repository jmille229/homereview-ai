import { NextResponse } from 'next/server'

import { nurtureLinkLimiter, getClientIp } from '@/lib/ratelimit'
import { verifyUnsubscribeToken } from '@/lib/access'
import { suppressEmailHash } from '@/lib/nurture'

export const runtime = 'nodejs'

/**
 * Unsubscribes an email from nurture mail. Two callers:
 *   • Mail clients' RFC 8058 one-click button: POST with e/t in the query string
 *     and a `List-Unsubscribe=One-Click` form body. Answers 200.
 *   • The confirm button on /unsubscribe: a form POST with e/t in the body.
 *     Redirects back to the page's "done" state.
 * GET is deliberately not supported, so link scanners that prefetch email links
 * can't unsubscribe people.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await nurtureLinkLimiter.limit(ip)
  if (!success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  const url = new URL(req.url)
  let e = url.searchParams.get('e')
  let t = url.searchParams.get('t')
  let fromPage = false

  const raw = (await req.text()).slice(0, 2048)
  if (!e || !t) {
    const form = new URLSearchParams(raw)
    e = form.get('e')
    t = form.get('t')
    fromPage = true
  }

  if (!e || !/^[0-9a-f]{64}$/.test(e) || !verifyUnsubscribeToken(e, t)) {
    return NextResponse.json({ error: 'Invalid unsubscribe link.' }, { status: 400 })
  }

  try {
    await suppressEmailHash(e)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  if (fromPage) {
    const base = (process.env.NEXT_PUBLIC_BASE_URL ?? url.origin).replace(/\/$/, '')
    return NextResponse.redirect(`${base}/unsubscribe?done=1`, 303)
  }
  return NextResponse.json({ ok: true })
}
