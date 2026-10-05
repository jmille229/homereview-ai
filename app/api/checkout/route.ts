import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { createReportCheckout } from '@/lib/checkout'
import { getSession } from '@/lib/redis'
import { checkoutLimiter, getClientIp } from '@/lib/ratelimit'
import { checkoutRequestSchema, MAX_JSON_BYTES } from '@/lib/validators'
import { parseJsonBody } from '@/lib/http'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await checkoutLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait.' },
      { status: 429 },
    )
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof checkoutRequestSchema.parse>
  try {
    data = checkoutRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // ── Validate session exists and isn't already paid ─────────────────────────
  let session: Awaited<ReturnType<typeof getSession>>
  try {
    session = await getSession(data.sessionId)
  } catch {
    return NextResponse.json({ error: 'Session lookup failed.' }, { status: 503 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  }

  if (session.paid) {
    return NextResponse.json({ error: 'This session has already been purchased.' }, { status: 400 })
  }

  // ── Validate product matches session flow ──────────────────────────────────
  if (data.product === 'brief' && session.flow !== 'pre') {
    return NextResponse.json(
      { error: 'Diagnostic Brief requires a pre-quote session.' },
      { status: 400 },
    )
  }
  if (data.product === 'shield' && session.flow !== 'post') {
    return NextResponse.json(
      { error: 'Quote Shield requires a post-quote session.' },
      { status: 400 },
    )
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
  if (!baseUrl) {
    console.error('[checkout] NEXT_PUBLIC_BASE_URL is not set')
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  // ── Create Stripe Checkout Session ─────────────────────────────────────────
  let checkoutSession: Awaited<ReturnType<typeof createReportCheckout>>
  try {
    checkoutSession = await createReportCheckout({
      baseUrl,
      sessionId:     data.sessionId,
      product:       data.product,
      customerEmail: session.leadEmail,
    })
  } catch (err) {
    console.error('[checkout] Stripe session creation failed:', { message: err instanceof Error ? err.message : 'Unknown error' })
    return NextResponse.json(
      { error: 'Failed to create checkout session.' },
      { status: 502 },
    )
  }

  if (!checkoutSession.url) {
    return NextResponse.json({ error: 'No checkout URL returned from Stripe.' }, { status: 502 })
  }

  return NextResponse.json({ url: checkoutSession.url })
}
