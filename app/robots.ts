import type { MetadataRoute } from 'next'
import { absoluteUrl, isIndexable } from '@/lib/site'

/**
 * Funnel, report, share, and admin routes carry per-user state and have no
 * search value, so they stay out of the crawl. Non-production deployments
 * (Vercel previews) block everything to avoid duplicate-content indexing.
 */
export default function robots(): MetadataRoute.Robots {
  if (!isIndexable()) {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: {
      userAgent: '*',
      allow:     '/',
      disallow:  [
        '/api/',
        '/admin',
        '/intake',
        '/questions',
        '/preview',
        '/success',
        '/unlock',
        '/report/',
        '/share/',
        '/recover',
      ],
    },
    sitemap: absoluteUrl('/sitemap.xml'),
  }
}
