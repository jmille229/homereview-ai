import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

export const runtime = 'nodejs'

/**
 * POST /api/revalidate?secret=…
 *
 * Called by a Sanity webhook on publish/unpublish so Learn content updates
 * appear on the live site within seconds, without a redeploy. Secured by a
 * shared secret (SANITY_REVALIDATE_SECRET) passed as a query param or the
 * x-webhook-secret header.
 *
 * Configure the Sanity webhook to POST a small projection like:
 *   { "slug": slug.current }
 * so we can revalidate the specific article page as well as the index.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  const url = new URL(req.url)
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-webhook-secret')

  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let slug: string | undefined
  try {
    const body = await req.json()
    slug = typeof body?.slug === 'string' ? body.slug : body?.slug?.current
  } catch {
    // No/!JSON body — just revalidate the index.
  }

  revalidatePath('/learn')
  if (slug) revalidatePath(`/learn/${slug}`)

  return NextResponse.json({ revalidated: true, slug: slug ?? null, now: Date.now() })
}
