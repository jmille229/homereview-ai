import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { isAuthorizedAdmin } from '@/lib/adminAuth'
import { adminLimiter, getClientIp } from '@/lib/ratelimit'
import { adminRefundRequestSchema, MAX_JSON_BYTES } from '@/lib/validators'
import { parseJsonBody } from '@/lib/http'
import { stripe } from '@/lib/stripe'

export const runtime = 'nodejs'

/**
 * POST /api/admin/refund  (header: x-admin-secret)
 * Body: { stripeSessionId: string }
 *
 * Issues a full refund for a checkout session's payment. Idempotency is handled
 * by Stripe (refunding an already-refunded charge returns an error we surface).
 */
export async function POST(req: Request): Promise<NextResponse> {
  // Rate limit BEFORE the auth check to throttle online guessing of the secret.
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  const { success } = await adminLimiter.limit(ip)
  if (!success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })

  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof adminRefundRequestSchema.parse>
  try {
    data = adminRefundRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  try {
    const cs = await stripe.checkout.sessions.retrieve(data.stripeSessionId)
    const paymentIntent = typeof cs.payment_intent === 'string' ? cs.payment_intent : cs.payment_intent?.id
    if (!paymentIntent) {
      return NextResponse.json({ error: 'No payment intent on that session.' }, { status: 400 })
    }
    const refund = await stripe.refunds.create({ payment_intent: paymentIntent })
    // Audit log: refunds move money — record who/what/when (no card data).
    console.warn('[admin/refund] Refund issued:', {
      stripeSessionId: data.stripeSessionId,
      reportSessionId: cs.metadata?.reportSessionId ?? null,
      refundId:        refund.id,
      status:          refund.status,
      ip,
      at:              new Date().toISOString(),
    })
    return NextResponse.json({ ok: true, refundId: refund.id, status: refund.status })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refund failed.' },
      { status: 502 },
    )
  }
}
