import type { MetadataRoute } from 'next'
import { absoluteUrl } from '@/lib/site'
import { getAllArticleSlugs } from '@/lib/learn'
import { LANDING_PAGES } from '@/lib/landing'

// Re-generate hourly so newly published Learn articles are picked up without a
// deploy. getAllArticleSlugs() returns [] on a Sanity error, so the static
// entries are always served.
export const revalidate = 3600

const STATIC_PAGES: { path: string; priority: number; changeFrequency: 'weekly' | 'monthly' | 'yearly' }[] = [
  { path: '/',        priority: 1.0, changeFrequency: 'weekly'  },
  { path: '/check',   priority: 0.8, changeFrequency: 'weekly'  },
  { path: '/learn',   priority: 0.8, changeFrequency: 'weekly'  },
  { path: '/sample',  priority: 0.6, changeFrequency: 'monthly' },
  { path: '/about',   priority: 0.5, changeFrequency: 'monthly' },
  { path: '/privacy', priority: 0.2, changeFrequency: 'yearly'  },
  { path: '/terms',   priority: 0.2, changeFrequency: 'yearly'  },
]

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = await getAllArticleSlugs()

  return [
    ...STATIC_PAGES.map(({ path, priority, changeFrequency }) => ({
      url: absoluteUrl(path),
      priority,
      changeFrequency,
    })),
    ...LANDING_PAGES.map((p) => ({
      url:             absoluteUrl(`/check/${p.slug}`),
      lastModified:    p.updated,
      priority:        0.7,
      changeFrequency: 'monthly' as const,
    })),
    ...slugs.map((slug) => ({
      url:             absoluteUrl(`/learn/${slug}`),
      priority:        0.6,
      changeFrequency: 'monthly' as const,
    })),
  ]
}
