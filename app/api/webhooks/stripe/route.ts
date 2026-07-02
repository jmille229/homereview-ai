import { NextResponse } from 'next/server'
import type Stripe from 'stripe'
import type { StoredSession } from '@/lib/types'

import { stripe } from '@/lib/stripe'
import { updateSession, markStripeEventProcessed, wasStripeEventProcessed, indexSessionForRecovery } from '@/lib/redis'

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
  // Size-capped: real Stripe events are a few KB; 1 MB is generous headroom.
  // Without a cap, anyone who knows the URL can force unbounded body buffering
  // (signature verification only happens after the read).
  const MAX_WEBHOOK_BYTES = 1_000_000
  const declared = Number(req.headers.get('content-length') ?? 0)
  if (declared > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
  }
  let rawBody: string
  try {
    rawBody = await req.text()
  } catch {
    return NextResponse.json({ error: 'Failed to read request body.' }, { status: 400 })
  }
  if (Buffer.byteLength(rawBody, 'utf8') > MAX_WEBHOOK_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
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

  // ── Idempotency: skip events we've ALREADY fully processed ─────────────────
  // Stripe guarantees at-least-once delivery and retries on non-2xx responses.
  // FIX (HIGH): The "processed" marker is written only AFTER the handler below
  // succeeds (not here, before the work). Previously, marking first meant a
  // handler that failed and returned 500 was suppressed on Stripe's retry — the
  // paid flag / recovery index were lost permanently. The side effects are
  // idempotent, so the narrow window where two concurrent deliveries both pass
  // this check and both run is harmless.
  try {
    if (await wasStripeEventProcessed(event.id)) {
      return NextResponse.json({ received: true })
    }
  } catch (err) {
    // Redis unavailable — return 503 so Stripe retries when the store is healthy.
    console.error('[webhook] Event dedup check failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      eventId: event.id,
    })
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  // ── Handle events ──────────────────────────────────────────────────────────
  if (event.type === 'checkout.session.completed') {
    const checkoutSession = event.data.object as Stripe.Checkout.Session

    // Only act on fully-paid sessions. For delayed methods Stripe sends this with
    // payment_status 'unpaid' first; we intentionally do NOT mark the event
    // processed, so the eventual paid delivery (or our own /api/report Stripe
    // re-verification) still provisions the report.
    if (checkoutSession.payment_status !== 'paid') {
      return NextResponse.json({ received: true })
    }

    const reportSessionId = checkoutSession.metadata?.reportSessionId
    const product         = checkoutSession.metadata?.product

    if (!reportSessionId || !product) {
      console.error('[webhook] Missing metadata:', { eventId: event.id })
      // A metadata problem won't fix on retry — mark processed and stop.
      try { await markStripeEventProcessed(event.id) } catch { /* non-fatal */ }
      return NextResponse.json({ received: true })
    }

    const payerEmail = checkoutSession.customer_details?.email?.toLowerCase().trim()

    try {
      await updateSession(reportSessionId, {
        paid:   true,
        paidAt: new Date().toISOString(),
        payerEmail,
        stripeSessionId: checkoutSession.id,
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
      // Return 500 so Stripe retries — we did NOT mark the event processed, so
      // the retry will genuinely re-run this handler.
      return NextResponse.json({ error: 'Failed to process event.' }, { status: 500 })
    }
  }

  // Mark processed only after successful handling (or for events we don't act on).
  try { await markStripeEventProcessed(event.id) } catch { /* non-fatal — at worst a duplicate idempotent re-run */ }

  return NextResponse.json({ received: true })
}
