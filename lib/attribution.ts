/**
 * lib/attribution.ts — ad / campaign attribution (UTM + click IDs).
 *
 * The visitor's last campaign touch is captured in the browser on landing
 * (components/analytics/AttributionCapture.tsx), sent with the checkout
 * request, and written onto the Stripe Checkout Session as `attr_*` metadata.
 * The Stripe webhook reads it back to attribute the purchase server-side.
 *
 * Dependency-free and isomorphic: safe to import from client and server code.
 */

/** URL params we capture when a visitor lands. */
export const ATTRIBUTION_URL_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',   // Google Ads click ID
  'gbraid',  // Google Ads (iOS app→web)
  'wbraid',  // Google Ads (iOS web→web)
  'fbclid',  // Meta click ID
] as const

/** Everything an attribution record can hold. */
export const ATTRIBUTION_KEYS = [
  ...ATTRIBUTION_URL_PARAMS,
  'landing_page', // path (no query) the visitor landed on
  'referrer',     // external referring host, if any
  'captured_at',  // ISO time of the touch
  'fbp',          // Meta browser ID (_fbp cookie, set by the Meta pixel)
  'fbc',          // Meta click ID cookie value (_fbc, or derived from fbclid)
] as const

export type AttributionKey = (typeof ATTRIBUTION_KEYS)[number]
export type Attribution = Partial<Record<AttributionKey, string>>

/** Max length of any single attribution value (Stripe caps metadata values at 500). */
export const MAX_ATTRIBUTION_VALUE = 200

const METADATA_PREFIX = 'attr_'

/** Strips control characters and caps length. Returns undefined for empty input. */
export function cleanAttributionValue(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  // eslint-disable-next-line no-control-regex
  const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, MAX_ATTRIBUTION_VALUE)
  return cleaned || undefined
}

/** Keeps only known keys with non-empty, cleaned string values. */
export function sanitizeAttribution(input: unknown): Attribution {
  const out: Attribution = {}
  if (!input || typeof input !== 'object') return out
  for (const key of ATTRIBUTION_KEYS) {
    const v = cleanAttributionValue((input as Record<string, unknown>)[key])
    if (v) out[key] = v
  }
  return out
}

/**
 * Reads campaign params from a query string. Returns null when the URL carries
 * no campaign params at all, so a later direct visit never overwrites a real
 * campaign touch.
 */
export function parseAttributionParams(search: string): Attribution | null {
  const params = new URLSearchParams(search)
  const out: Attribution = {}
  for (const key of ATTRIBUTION_URL_PARAMS) {
    const v = cleanAttributionValue(params.get(key))
    if (v) out[key] = v
  }
  return Object.keys(out).length > 0 ? out : null
}

/** Meta's _fbc format, derived from an fbclid when the pixel hasn't set the cookie. */
export function buildFbc(fbclid: string, capturedAtMs: number): string {
  return `fb.1.${capturedAtMs}.${fbclid}`
}

/** Attribution → Stripe Checkout metadata (`attr_` prefix, values ≤ 500 chars). */
export function attributionToStripeMetadata(attribution: Attribution): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [key, value] of Object.entries(sanitizeAttribution(attribution))) {
    out[`${METADATA_PREFIX}${key}`] = value
  }
  return out
}

/** Stripe Checkout metadata → attribution (inverse of attributionToStripeMetadata). */
export function attributionFromStripeMetadata(
  metadata: Record<string, string> | null | undefined,
): Attribution {
  if (!metadata) return {}
  const raw: Record<string, string> = {}
  for (const [key, value] of Object.entries(metadata)) {
    if (key.startsWith(METADATA_PREFIX)) raw[key.slice(METADATA_PREFIX.length)] = value
  }
  return sanitizeAttribution(raw)
}
