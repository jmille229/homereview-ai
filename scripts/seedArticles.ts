/**
 * One-time migration: copies the legacy static articles (lib/articles.ts) into
 * Sanity as `article` documents with Portable Text bodies.
 *
 * Run once after creating a write token:
 *   SANITY_API_WRITE_TOKEN=sk... npm run seed
 *
 * Idempotent — uses a deterministic _id per slug (createOrReplace), so re-running
 * overwrites rather than duplicating. Safe to run again if you tweak the source.
 */
import { randomUUID } from 'crypto'
import { createClient } from '@sanity/client'
import { ARTICLES, type ArticleSection } from '../lib/articles'
import { projectId, dataset, apiVersion } from '../sanity/env'

const token = process.env.SANITY_API_WRITE_TOKEN
if (!token) {
  console.error('Missing SANITY_API_WRITE_TOKEN. Create one in Sanity → API → Tokens (Editor), then re-run.')
  process.exit(1)
}

const client = createClient({ projectId, dataset, apiVersion, token, useCdn: false })

const key = () => randomUUID().replace(/-/g, '').slice(0, 12)

/** A Portable Text block from a single line of text. */
function textBlock(text: string, style: 'normal' | 'h2', listItem?: 'bullet') {
  return {
    _type: 'block',
    _key: key(),
    style,
    ...(listItem ? { listItem, level: 1 } : {}),
    markDefs: [],
    children: [{ _type: 'span', _key: key(), text, marks: [] }],
  }
}

/** Convert legacy heading/body/bullets sections into Portable Text. */
function toPortableText(sections: ArticleSection[]) {
  const blocks: ReturnType<typeof textBlock>[] = []
  for (const s of sections) {
    if (s.heading) blocks.push(textBlock(s.heading, 'h2'))
    for (const p of s.body) blocks.push(textBlock(p, 'normal'))
    for (const b of s.bullets ?? []) blocks.push(textBlock(b, 'normal', 'bullet'))
  }
  return blocks
}

function publishedDate(published: string): string {
  const d = new Date(published) // e.g. "June 2026"
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString()
}

async function run() {
  const docs = Object.values(ARTICLES).map((a) => ({
    _id: `article-${a.slug}`,
    _type: 'article',
    title: a.title,
    slug: { _type: 'slug', current: a.slug },
    category: a.category,
    summary: a.summary,
    readTime: a.readTime,
    publishedAt: publishedDate(a.published),
    featured: true,
    body: toPortableText(a.sections),
  }))

  for (const doc of docs) {
    await client.createOrReplace(doc)
    console.log(`✓ seeded ${doc._id}`)
  }
  console.log(`\nDone — ${docs.length} article(s) in Sanity. Publish/edit them in the Studio.`)
}

run().catch((err) => {
  console.error('Seed failed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
