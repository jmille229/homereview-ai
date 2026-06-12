import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { findSessionIdsByEmail, getSession } from '@/lib/redis'
import { reclaimLimiter, getClientIp } from '@/lib/ratelimit'
import { recoverRequestSchema, MAX_JSON_BYTES } from '@/lib/validators'
import { parseJsonBody } from '@/lib/http'
import { getCategoryLabel } from '@/lib/constants'
import {
  accessCookieName,
  accessCookieOptions,
  accessWindowSeconds,
  createAccessToken,
} from '@/lib/access'
import type { Product } from '@/lib/types'

export const runtime = 'nodejs'

interface RecoveredReport {
  path:        string
  product:     Product
  category:    string
  purchasedAt: string
}

/**
 * POST /api/report/recover
 *
 * Self-service recovery for a buyer who has lost their report link. They supply
 * the email used at Stripe checkout; we look up their paid sessions via the
 * recovery index, mint the per-session access cookie for each, and return the
 * list so the client can link straight to them.
 *
 * Email is the access factor (the product is account-less), so this is
 * rate-limited and the response only ever reflects the email that was submitted.
 */
export async function POST(req: Request): Promise<NextResponse> {
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })

  const { success } = await reclaimLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait an hour and try again.' },
      { status: 429 },
    )
  }

  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof recoverRequestSchema.parse>
  try {
    data = recoverRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const email = data.email.toLowerCase().trim()

  let sessionIds: string[]
  try {
    sessionIds = await findSessionIdsByEmail(email)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  const reports: RecoveredReport[] = []
  const cookies: Array<{ name: string; value: string; options: ReturnType<typeof accessCookieOptions> }> = []

  for (const id of sessionIds) {
    const session = await getSession(id).catch(() => null)
    // Re-verify everything: the session still exists, is paid, and the stored
    // payer email matches (the index key is a hash, this is defense in depth).
    if (!session || !session.paid || !session.product) continue
    if (session.payerEmail && session.payerEmail !== email) continue

    const type = session.flow === 'pre' ? 'brief' : 'shield'
    reports.push({
      path:        `/report/${type}/${id}`,
      product:     session.product,
      category:    getCategoryLabel(session.category),
      purchasedAt: session.paidAt ?? session.createdAt,
    })

    const ttl = accessWindowSeconds(session.product)
    cookies.push({
      name:    accessCookieName(id),
      value:   createAccessToken(id, ttl),
      options: accessCookieOptions(ttl),
    })
  }

  // Most recent first.
  reports.sort((a, b) => new Date(b.purchasedAt).getTime() - new Date(a.purchasedAt).getTime())

  const res = NextResponse.json({ reports })
  for (const c of cookies) res.cookies.set(c.name, c.value, c.options)
  return res
}
