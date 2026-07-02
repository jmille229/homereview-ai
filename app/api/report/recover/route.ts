import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { findSessionIdsByEmail, getSession } from '@/lib/redis'
import { recoverLimiter, getClientIp } from '@/lib/ratelimit'
import { recoverRequestSchema, MAX_JSON_BYTES } from '@/lib/validators'
import { parseJsonBody } from '@/lib/http'
import { getCategoryLabel } from '@/lib/constants'
import { sendRecoveryEmail, emailEnabled } from '@/lib/email'

export const runtime = 'nodejs'

/**
 * POST /api/report/recover
 *
 * Self-service recovery for a buyer who has lost their report link. They supply
 * the email used at Stripe checkout; if any paid reports match, we EMAIL one-click
 * magic links to that address.
 *
 * SECURITY (#4): The email is not a secret, so this endpoint must not treat it as
 * a bearer credential. It therefore:
 *   - never returns report contents or sets access cookies in the HTTP response
 *     (delivery is to the inbox, so possession of the inbox is the proof);
 *   - always returns the same generic `{ ok: true }`, so an attacker can't
 *     enumerate which emails are paying customers;
 *   - uses a dedicated, tight rate limiter.
 * Buyers who still have their report URL use /api/report/reclaim instead, which
 * needs no email delivery.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })

  const { success } = await recoverLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait an hour and try again.' },
      { status: 429 },
    )
  }

  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof recoverRequestSchema.parse>
  try {
    data = recoverRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const email = data.email.toLowerCase().trim()

  // Constant response regardless of outcome — never reveal whether this email
  // has reports. All real work happens out-of-band via email.
  const ok = NextResponse.json({ ok: true })

  let sessionIds: string[]
  try {
    sessionIds = await findSessionIdsByEmail(email)
  } catch {
    return ok
  }

  const reports: Array<{ sessionId: string; product: 'brief' | 'shield'; categoryLabel: string }> = []
  for (const id of sessionIds) {
    const session = await getSession(id).catch(() => null)
    // Re-verify: still exists, is paid, and the stored payer email matches.
    if (!session || !session.paid || !session.product) continue
    if (session.payerEmail && session.payerEmail !== email) continue
    reports.push({
      sessionId:     id,
      product:       session.product,
      categoryLabel: getCategoryLabel(session.category),
    })
  }

  // Best-effort, dormant until Resend is configured. Never throws into the caller.
  if (reports.length > 0) {
    if (!emailEnabled()) {
      // The response is deliberately blinded, so the USER can't be told delivery
      // is impossible — the OPERATOR must be (via logs/Sentry; an email alert
      // can't work here by definition). A real buyer just hit a dead end.
      console.error('[recover] Recovery requested for an email with paid reports, ' +
        'but RESEND_API_KEY is not configured — no email can be sent. ' +
        'Configure Resend or handle this buyer via support.')
    } else {
      try { await sendRecoveryEmail({ to: email, reports }) } catch { /* non-fatal */ }
    }
  }

  return ok
}
