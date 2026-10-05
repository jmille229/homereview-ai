/**
 * lib/analytics.ts — client-side funnel + conversion events.
 *
 * One call fans out to Vercel Web Analytics and to whichever ad pixels are
 * configured (lib/adConfig.ts). Browser-only: call from client components.
 */

import { track } from '@vercel/analytics'
import type { Product } from './types'
import { PRODUCT_PRICING } from './pricing'
import { GOOGLE_ADS_ID, GOOGLE_ADS_PURCHASE_LABEL, META_PIXEL_ID } from './adConfig'
import {
  buildFbc,
  parseAttributionParams,
  sanitizeAttribution,
  type Attribution,
} from './attribution'

type Props = Record<string, string | number | boolean | null>

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
    gtag?: (...args: unknown[]) => void
    dataLayer?: unknown[]
  }
}

// ─── Attribution (last campaign touch, first-party, browser-only) ─────────────

const ATTRIBUTION_STORAGE_KEY = 'hr_attribution'
/** A campaign touch older than this is no longer credited. */
const ATTRIBUTION_TTL_MS = 90 * 24 * 60 * 60 * 1000

function readStored(): Attribution | null {
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_STORAGE_KEY)
    if (!raw) return null
    const parsed = sanitizeAttribution(JSON.parse(raw))
    const at = parsed.captured_at ? Date.parse(parsed.captured_at) : NaN
    if (!Number.isFinite(at) || Date.now() - at > ATTRIBUTION_TTL_MS) return null
    return parsed
  } catch {
    return null
  }
}

/**
 * Records the current URL's campaign params (UTM / click IDs) as the visitor's
 * latest touch. URLs without campaign params leave the stored touch alone.
 */
export function captureAttribution(): void {
  if (typeof window === 'undefined') return
  const params = parseAttributionParams(window.location.search)
  if (!params) return

  let referrer: string | undefined
  try {
    const ref = document.referrer ? new URL(document.referrer) : null
    if (ref && ref.host !== window.location.host) referrer = ref.host
  } catch { /* malformed referrer — ignore */ }

  const touch = sanitizeAttribution({
    ...params,
    landing_page: window.location.pathname,
    referrer,
    captured_at: new Date().toISOString(),
  })
  try {
    window.localStorage.setItem(ATTRIBUTION_STORAGE_KEY, JSON.stringify(touch))
  } catch { /* storage blocked — attribution is best-effort */ }
}

function readCookie(name: string): string | undefined {
  const match = document.cookie.split('; ').find(c => c.startsWith(`${name}=`))
  return match ? decodeURIComponent(match.slice(name.length + 1)) : undefined
}

/** The stored touch plus Meta browser IDs, for sending with the checkout request. */
export function getAttributionForCheckout(): Attribution {
  if (typeof window === 'undefined') return {}
  const stored = readStored() ?? {}
  const fbp = readCookie('_fbp')
  let fbc = readCookie('_fbc')
  if (!fbc && stored.fbclid) {
    const at = stored.captured_at ? Date.parse(stored.captured_at) : Date.now()
    fbc = buildFbc(stored.fbclid, Number.isFinite(at) ? at : Date.now())
  }
  return sanitizeAttribution({ ...stored, fbp, fbc })
}

// ─── Events ───────────────────────────────────────────────────────────────────

/** Funnel events that also map to a standard ad-platform event. */
const PIXEL_EVENT_MAP: Record<string, { meta?: string; google?: string }> = {
  preview_generated: { meta: 'Lead',             google: 'generate_lead' },
  checkout_started:  { meta: 'InitiateCheckout', google: 'begin_checkout' },
}

/** Sends a funnel event to Vercel Analytics and any mapped ad-platform event. */
export function trackEvent(name: string, props: Props = {}): void {
  track(name, props)
  const mapped = PIXEL_EVENT_MAP[name]
  if (!mapped || typeof window === 'undefined') return
  try {
    if (META_PIXEL_ID && mapped.meta) window.fbq?.('track', mapped.meta, props)
    if (GOOGLE_ADS_ID && mapped.google) window.gtag?.('event', mapped.google, props)
  } catch { /* a pixel error must never break the funnel */ }
}

/**
 * Fires the purchase conversion once per Stripe Checkout Session.
 * `transactionId` (the Stripe session ID) is also the Meta event_id the
 * server-side Conversions API uses, so Meta de-duplicates the two.
 */
export function trackPurchase(args: {
  product: Product
  transactionId: string
  /** What was actually charged (after promo codes); falls back to list price. */
  amountCents?: number
}): void {
  if (typeof window === 'undefined') return
  const onceKey = `hr_purchase_tracked_${args.transactionId}`
  try {
    if (window.sessionStorage.getItem(onceKey)) return
    window.sessionStorage.setItem(onceKey, '1')
  } catch { /* storage blocked — may double-fire on reload; platforms dedupe by ID */ }

  const cents = args.amountCents ?? PRODUCT_PRICING[args.product].amountCents
  const value = cents / 100

  track('purchase', { product: args.product, value })
  try {
    if (META_PIXEL_ID) {
      window.fbq?.(
        'track',
        'Purchase',
        { value, currency: 'USD', content_ids: [args.product], content_type: 'product' },
        { eventID: args.transactionId },
      )
    }
    if (GOOGLE_ADS_ID && GOOGLE_ADS_PURCHASE_LABEL) {
      window.gtag?.('event', 'conversion', {
        send_to:        `${GOOGLE_ADS_ID}/${GOOGLE_ADS_PURCHASE_LABEL}`,
        value,
        currency:       'USD',
        transaction_id: args.transactionId,
      })
    }
  } catch { /* never break the success page */ }
}
