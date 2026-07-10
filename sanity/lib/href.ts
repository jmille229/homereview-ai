/**
 * Shared href safety check, used by both the render-time sanitizer
 * (components/learn/LearnBody.tsx) and the Studio schema validation. Allows only
 * same-site paths (but not protocol-relative //host) and an explicit external
 * scheme allow-list — blocking javascript:, data:, vbscript:, etc.
 */
export function isSafeLinkHref(href: string): boolean {
  const h = href.trim()
  if (h.startsWith('/') && !h.startsWith('//')) return true
  return /^(https?:\/\/|mailto:|tel:)/i.test(h)
}
