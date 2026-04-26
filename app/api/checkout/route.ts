import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { stripe, PRICES } from '@/lib/stripe'
import { getSession } from '@/lib/redis'
import { checkoutLimiter, getClientIp } from '@/lib/ratelimit'
import { checkoutRequestSchema } from '@/lib/validators'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const { success } = await checkoutLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many checkout attempts. Please wait.' },
      { status: 429 },
    )
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let data: ReturnType<typeof checkoutRequestSchema.parse>
  try {
    data = checkoutRequestSchema.parse(body)
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

  const price = PRICES[data.product]

  // ── Create Stripe Checkout Session ─────────────────────────────────────────
  let checkoutSession: Awaited<ReturnType<typeof stripe.checkout.sessions.create>>
  try {
    checkoutSession = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: price.name,
              description: price.description,
            },
            unit_amount: price.amount,
          },
          quantity: 1,
        },
      ],
      // Stripe appends {CHECKOUT_SESSION_ID} automatically
      success_url: `${baseUrl}/success?stripe_session_id={CHECKOUT_SESSION_ID}&product=${data.product}`,
      cancel_url: `${baseUrl}/preview`,
      metadata: {
        reportSessionId: data.sessionId,
        product: data.product,
      },
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
