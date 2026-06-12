import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { StoredSession } from '@/lib/types'

import { stripe } from '@/lib/stripe'
import { updateSession, markStripeEventProcessed, indexSessionForRecovery } from '@/lib/redis'

export const runtime = 'nodejs'

/**
 * Stripe sends the raw body for signature verification.
 * This route must read the raw body — do NOT use req.json() here.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const sig = req.headers.get('stripe-signature')

  if (!sig) {
    return NextResponse.json({ error: 'Missing stripe-signature header.' }, { status: 400 })
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error('[webhook] STRIPE_WEBHOOK_SECRET is not set')
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  // ── Read raw body for signature verification ───────────────────────────────
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read request body.' }, { status: 400 })
  }

  // ── Verify Stripe signature ────────────────────────────────────────────────
  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    )
  } catch (err) {
    // LOW-02: Log only the message, not the full error object
    console.error('[webhook] Signature verification failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ error: 'Invalid signature.' }, { status: 400 })
  }

  // ── HIGH-02: Deduplicate events via Redis SET NX ───────────────────────────
  // Stripe guarantees at-least-once delivery and retries on non-2xx responses.
  // Without this guard, a transient Redis failure followed by a Stripe retry
  // would re-process an event and could trigger duplicate side-effects.
  let isFirstDelivery: boolean
  try {
    isFirstDelivery = await markStripeEventProcessed(event.id)
  } catch (err) {
    // If Redis is down we can't safely deduplicate — log and return 500 so
    // Stripe retries later when the store is healthy.
    console.error('[webhook] Event deduplication check failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      eventId: event.id,
    })
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  if (!isFirstDelivery) {
    // Already processed — return 200 so Stripe stops retrying
    return NextResponse.json({ received: true })
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session

    if (checkoutSession.payment_status !== 'paid') {
      // Buy Now Pay Later flow — wait for payment_intent.succeeded
      return NextResponse.json({ received: true })
    }

    const reportSessionId = checkoutSession.metadata?.reportSessionId
    const product         = checkoutSession.metadata?.product

    if (!reportSessionId || !product) {
      console.error('[webhook] Missing metadata:', { eventId: event.id })
      // Return 200 — retrying won't fix a metadata configuration issue
      return NextResponse.json({ received: true })
    }

    const payerEmail = checkoutSession.customer_details?.email?.toLowerCase().trim()

    try {
      await updateSession(reportSessionId, {
        paid:   true,
        paidAt: new Date().toISOString(),
        payerEmail,
        product: product as StoredSession['product'],
      })
      if (payerEmail) {
        try { await indexSessionForRecovery(payerEmail, reportSessionId) } catch { /* non-fatal */ }
      }
    } catch (err) {
      console.error('[webhook] Failed to update session:', {
        message: err instanceof Error ? err.message : 'Unknown error',
        eventId: event.id,
      })
      // Return 500 so Stripe retries — the event ID guard above ensures
      // idempotency even if this handler runs again.
      return NextResponse.json({ error: 'Failed to process event.' }, { status: 500 })
    }
  }

  return NextResponse.json({ received: true })
}
