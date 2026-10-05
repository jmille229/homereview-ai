/**
 * lib/site.ts — site-wide constants for SEO surfaces (sitemap, robots, metadata,
 * structured data). No env reads beyond the public base URL, so it's safe to
 * import from client components too.
 */

export const SITE_NAME = 'HomeReview AI'

export const SITE_TAGLINE = 'Independent home repair and contractor quote analysis'

export const SITE_DESCRIPTION =
  'Get an objective, AI-powered analysis of your home repair issue or contractor quote — no referral fees, no bias.'

/** Canonical origin, no trailing slash. Mirrors `metadataBase` in app/layout.tsx. */
export const SITE_URL = (process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000').replace(/\/+$/, '')

/** Absolute URL for a site path (e.g. '/learn' → 'https://…/learn'). */
export function absoluteUrl(path = '/'): string {
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

/**
 * Only the production deployment should be crawled. Vercel preview deployments
 * (VERCEL_ENV=preview) would otherwise get indexed as duplicate content.
 * Off Vercel, fall back to NODE_ENV so `next start` behaves like production.
 */
export function isIndexable(): boolean {
  const vercelEnv = process.env.VERCEL_ENV
  if (vercelEnv) return vercelEnv === 'production'
  return process.env.NODE_ENV === 'production'
}
