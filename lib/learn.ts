import * as Sentry from '@sentry/nextjs'
import type { PortableTextBlock } from '@portabletext/types'
import type { SanityImageSource } from '@sanity/image-url/lib/types/types'
import { sanityClient } from '@/sanity/lib/client'
import { ARTICLES_QUERY, ARTICLE_QUERY, ARTICLE_SLUGS_QUERY } from '@/sanity/lib/queries'

/**
 * lib/learn.ts — the read layer for Learn content. Sanity is the single source
 * of truth (edited via the Studio).
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

export interface LearnArticle extends LearnListItem {
  body:            PortableTextBlock[]
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

/**
 * Published articles, newest first.
 *
 * On error, reports to Sentry and returns [] so a Sanity outage at build time
 * can't hard-fail the deploy — the index then shows its empty state rather than
 * crashing. (The index is prerendered at build, so it can't propagate.)
 */
export async function getPublishedArticles(): Promise<LearnListItem[]> {
  try {
    const rows = await sanityClient.fetch<SanityRow[]>(ARTICLES_QUERY)
    return (rows ?? []).filter((r) => r.slug).map(toListItem)
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'learn', op: 'list' } })
    console.error('[learn] Sanity list fetch failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return []
  }
}

/**
 * A single article by slug.
 *
 * On a Sanity ERROR the throw propagates: during ISR regeneration Next keeps
 * serving the last good cached page instead of 404ing a live article on a
 * transient blip (and Sentry captures it). Returns null only when Sanity is
 * reachable but has no such document → a genuine 404. Detail pages are generated
 * on demand (see generateStaticParams), so this never hard-fails a build.
 */
export async function getArticleBySlug(slug: string): Promise<LearnArticle | null> {
  let row: SanityRow | null
  try {
    row = await sanityClient.fetch<SanityRow | null>(ARTICLE_QUERY, { slug })
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'learn', op: 'article', slug } })
    console.error('[learn] Sanity article fetch failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
      slug,
    })
    throw err
  }

  if (!row?.slug || !row.body) return null
  return {
    ...toListItem(row),
    body:           row.body,
    seoTitle:       row.seoTitle,
    seoDescription: row.seoDescription,
  }
}

/**
 * Slugs to prerender. Returns [] on error so the build never depends on Sanity
 * being reachable; with dynamicParams, articles then generate on first request.
 */
export async function getAllArticleSlugs(): Promise<string[]> {
  try {
    const slugs = await sanityClient.fetch<string[]>(ARTICLE_SLUGS_QUERY)
    return (slugs ?? []).filter(Boolean)
  } catch (err) {
    Sentry.captureException(err, { tags: { area: 'learn', op: 'slugs' } })
    return []
  }
}
