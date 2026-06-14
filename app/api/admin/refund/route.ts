import { NextResponse } from 'next/server'

import { isAuthorizedAdmin } from '@/lib/adminAuth'
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
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  let body: { stripeSessionId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const stripeSessionId = body.stripeSessionId?.trim()
  if (!stripeSessionId) {
    return NextResponse.json({ error: 'stripeSessionId is required.' }, { status: 400 })
  }

  try {
    const cs = await stripe.checkout.sessions.retrieve(stripeSessionId)
    const paymentIntent = typeof cs.payment_intent === 'string' ? cs.payment_intent : cs.payment_intent?.id
    if (!paymentIntent) {
      return NextResponse.json({ error: 'No payment intent on that session.' }, { status: 400 })
    }
    const refund = await stripe.refunds.create({ payment_intent: paymentIntent })
    return NextResponse.json({ ok: true, refundId: refund.id, status: refund.status })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Refund failed.' },
      { status: 502 },
    )
  }
}
