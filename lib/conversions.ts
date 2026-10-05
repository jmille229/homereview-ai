/**
 * lib/conversions.ts — server-side purchase conversions (server-only).
 *
 * Called from the Stripe webhook once a checkout is paid. Sends the purchase to
 * Meta's Conversions API so it is counted even when the buyer's browser blocks
 * the pixel or closes the success page early. The browser pixel fires the same
 * event with the same event ID (the Stripe Checkout Session ID), so Meta counts
 * it once.
 *
 * DORMANT until META_CAPI_ACCESS_TOKEN and NEXT_PUBLIC_META_PIXEL_ID are set.
 * Never throws: a reporting failure must not fail the webhook.
 */

import { createHash } from 'crypto'
import type Stripe from 'stripe'
import { META_PIXEL_ID } from './adConfig'
import { attributionFromStripeMetadata } from './attribution'

const META_GRAPH_VERSION = 'v21.0'
const REQUEST_TIMEOUT_MS = 4_000

export function metaCapiEnabled(): boolean {
  return Boolean(META_PIXEL_ID && process.env.META_CAPI_ACCESS_TOKEN)
}

function sha256(value: string): string {
  return createHash('sha256').update(value.trim().toLowerCase()).digest('hex')
}

/** Builds the Conversions API Purchase event for a paid Checkout Session. */
export function buildMetaPurchaseEvent(checkout: Stripe.Checkout.Session, baseUrl: string) {
  const attribution = attributionFromStripeMetadata(checkout.metadata)
  const email       = checkout.customer_details?.email
  const ip          = checkout.metadata?.capi_ip
  const ua          = checkout.metadata?.capi_ua
  const product     = checkout.metadata?.product

  const userData: Record<string, unknown> = {}
  if (email)             userData.em = [sha256(email)]
  if (ip)                userData.client_ip_address = ip
  if (ua)                userData.client_user_agent = ua
  if (attribution.fbp)   userData.fbp = attribution.fbp
  if (attribution.fbc)   userData.fbc = attribution.fbc

  return {
    event_name:       'Purchase',
    event_time:       Math.floor(Date.now() / 1000), // ~payment time: this runs from the paid webhook
    event_id:         checkout.id,
    action_source:    'website',
    event_source_url: `${baseUrl}/success`,
    user_data:        userData,
    custom_data: {
      currency:     (checkout.currency ?? 'usd').toUpperCase(),
      value:        (checkout.amount_total ?? 0) / 100,
      content_ids:  product ? [product] : [],
      content_type: 'product',
    },
  }
}

async function sendMetaPurchase(checkout: Stripe.Checkout.Session): Promise<void> {
  const token   = process.env.META_CAPI_ACCESS_TOKEN
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  if (!META_PIXEL_ID || !token) return

  const body: Record<string, unknown> = { data: [buildMetaPurchaseEvent(checkout, baseUrl)] }
  // Set while verifying in Events Manager → Test events; leave unset in production.
  if (process.env.META_CAPI_TEST_EVENT_CODE) body.test_event_code = process.env.META_CAPI_TEST_EVENT_CODE

  const res = await fetch(
    `https://graph.facebook.com/${META_GRAPH_VERSION}/${META_PIXEL_ID}/events?access_token=${encodeURIComponent(token)}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    },
  )
  if (!res.ok) {
    throw new Error(`Meta CAPI responded ${res.status}`)
  }
}

/** Reports a paid checkout to every configured server-side destination. Never throws. */
export async function reportPurchaseConversion(checkout: Stripe.Checkout.Session): Promise<void> {
  if (!metaCapiEnabled()) return
  try {
    await sendMetaPurchase(checkout)
  } catch (err) {
    console.error('[conversions] Meta CAPI purchase failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      stripeSessionId: checkout.id,
    })
  }
}
