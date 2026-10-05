/**
 * lib/adConfig.ts — ad-platform IDs, read from public env vars.
 *
 * Every pixel is OFF unless its env var is set (and well-formed). With nothing
 * set, no third-party script loads and the CSP is unchanged. Safe to import from
 * client components, server code, and middleware (NEXT_PUBLIC_* is inlined at
 * build time).
 */

function match(value: string | undefined, pattern: RegExp): string | null {
  const v = value?.trim()
  return v && pattern.test(v) ? v : null
}

/** Meta (Facebook/Instagram) Pixel ID — digits only, e.g. "123456789012345". */
export const META_PIXEL_ID = match(process.env.NEXT_PUBLIC_META_PIXEL_ID, /^\d{5,20}$/)

/** Google Ads tag ID, e.g. "AW-123456789". */
export const GOOGLE_ADS_ID = match(process.env.NEXT_PUBLIC_GOOGLE_ADS_ID, /^AW-\d{5,20}$/)

/** Conversion label of the Google Ads "Purchase" conversion action, e.g. "AbC-D_efG-h12_34-567". */
export const GOOGLE_ADS_PURCHASE_LABEL = match(
  process.env.NEXT_PUBLIC_GOOGLE_ADS_PURCHASE_LABEL,
  /^[A-Za-z0-9_-]{4,64}$/,
)

export const ANY_AD_PIXEL_ENABLED = Boolean(META_PIXEL_ID || GOOGLE_ADS_ID)
