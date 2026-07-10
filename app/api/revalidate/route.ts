import { NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'
import { timingSafeEqual } from 'crypto'
import { revalidateLimiter, getClientIp } from '@/lib/ratelimit'

export const runtime = 'nodejs'

/** Constant-time string compare (guards length first). */
function secretMatches(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  try {
    return timingSafeEqual(ab, bb)
  } catch {
    return false
  }
}

/**
 * POST /api/revalidate?secret=…
 *
 * Called by a Sanity webhook on publish/unpublish so Learn content updates
 * appear on the live site within seconds, without a redeploy. Secured by a
 * shared secret (SANITY_REVALIDATE_SECRET) passed as a query param or the
 * x-webhook-secret header, compared in constant time.
 *
 * Configure the Sanity webhook to POST a small projection like:
 *   { "slug": slug.current }
 * so we can revalidate the specific article page as well as the index.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const secret = process.env.SANITY_REVALIDATE_SECRET
  const url = new URL(req.url)
  const provided = url.searchParams.get('secret') ?? req.headers.get('x-webhook-secret') ?? ''

  // Auth first — an unauthenticated caller is rejected before any body read or
  // rate-limiter (Redis) work.
  if (!secret || !secretMatches(provided, secret)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Cap authenticated call volume (leaked-secret / bulk-publish blast radius).
  const ip = getClientIp(req)
  if (ip) {
    const { success } = await revalidateLimiter.limit(ip)
    if (!success) return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  let slug: string | undefined
  try {
    const body = await req.json()
    const raw = typeof body?.slug === 'string' ? body.slug : body?.slug?.current
    // Only accept a plausible slug; ignore anything weird rather than feeding it
    // to revalidatePath.
    if (typeof raw === 'string' && /^[a-z0-9-]{1,128}$/i.test(raw)) slug = raw
  } catch {
    // No/!JSON body — just revalidate the index.
  }

  revalidatePath('/learn')
  if (slug) revalidatePath(`/learn/${slug}`)

  return NextResponse.json({ revalidated: true, slug: slug ?? null, now: Date.now() })
}
