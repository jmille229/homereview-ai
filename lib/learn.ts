import type { PortableTextBlock } from '@portabletext/types'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { sanityClient } from '@/sanity/lib/client'
import { ARTICLES_QUERY, ARTICLE_QUERY, ARTICLE_SLUGS_QUERY } from '@/sanity/lib/queries'
import { ARTICLES as LEGACY, type ArticleSection } from '@/lib/articles'

/**
 * lib/learn.ts — the read layer for Learn content.
 *
 * Content lives in Sanity (edited via the Studio). During/after migration this
 * layer falls back to the legacy static articles in lib/articles.ts whenever
 * Sanity has nothing (empty dataset) or is unreachable — so the Learn section
 * never breaks, and it cuts over to Sanity automatically once content is
 * published there. Once everything is migrated, the legacy fallback can be
 * deleted.
 */

export interface LearnListItem {
  slug:        string
  title:       string
  category:    string
  summary:     string
  readTime:    string
  published:   string                 // display string, e.g. "May 2026"
  featured:    boolean
  coverImage?: SanityImageSource
}

export type LearnBody =
  | { kind: 'portable'; value: PortableTextBlock[] }
  | { kind: 'legacy';   sections: ArticleSection[] }

export interface LearnArticle extends LearnListItem {
  body:            LearnBody
  seoTitle?:       string
  seoDescription?: string
}

interface SanityRow {
  slug?:        string
  title?:       string
  category?:    string
  summary?:     string
  readTime?:    string
  featured?:    boolean
  publishedAt?: string
  coverImage?:  SanityImageSource
  body?:        PortableTextBlock[]
  seoTitle?:    string
  seoDescription?: string
}

function formatMonthYear(iso?: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function toListItem(row: SanityRow): LearnListItem {
  return {
    slug:       row.slug ?? '',
    title:      row.title ?? 'Untitled',
    category:   row.category ?? 'General',
    summary:    row.summary ?? '',
    readTime:   row.readTime ?? '',
    published:  formatMonthYear(row.publishedAt),
    featured:   row.featured ?? false,
    coverImage: row.coverImage,
  }
}

/** Published Sanity articles, newest first. Empty on empty dataset or any error. */
export async function getPublishedArticles(): Promise<LearnListItem[]> {
  try {
    const rows = await sanityClient.fetch<SanityRow[]>(ARTICLES_QUERY)
    if (rows?.length) return rows.filter((r) => r.slug).map(toListItem)
  } catch (err) {
    console.error('[learn] Sanity list fetch failed; falling back to legacy:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }
  return []
}

/** A single article by slug — Sanity first, then the legacy static content. */
export async function getArticleBySlug(slug: string): Promise<LearnArticle | null> {
  try {
    const row = await sanityClient.fetch<SanityRow | null>(ARTICLE_QUERY, { slug })
    if (row?.slug && row.body) {
      return {
        ...toListItem(row),
        body:           { kind: 'portable', value: row.body },
        seoTitle:       row.seoTitle,
        seoDescription: row.seoDescription,
      }
    }
  } catch (err) {
    console.error('[learn] Sanity article fetch failed; trying legacy:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      slug,
    })
  }

  const legacy = LEGACY[slug]
  if (!legacy) return null
  return {
    slug:      legacy.slug,
    title:     legacy.title,
    category:  legacy.category,
    summary:   legacy.summary,
    readTime:  legacy.readTime,
    published: legacy.published,
    featured:  false,
    body:      { kind: 'legacy', sections: legacy.sections },
  }
}

/** All known slugs (Sanity ∪ legacy) for static generation. */
export async function getAllArticleSlugs(): Promise<string[]> {
  const set = new Set<string>(Object.keys(LEGACY))
  try {
    const slugs = await sanityClient.fetch<string[]>(ARTICLE_SLUGS_QUERY)
    for (const s of slugs ?? []) if (s) set.add(s)
  } catch { /* legacy slugs are enough to build */ }
  return [...set]
}
