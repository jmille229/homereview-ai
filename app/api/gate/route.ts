import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { getClientIp, previewLimiter } from '@/lib/ratelimit'
import { gateEnabled, verifyTurnstileToken, passCookie } from '@/lib/gate'
import { gateRequestSchema, MAX_JSON_BYTES } from '@/lib/validators'
import { parseJsonBody } from '@/lib/http'

export const runtime = 'nodejs'

/**
 * POST /api/gate
 *
 * Exchanges a solved Cloudflare Turnstile token for a short-lived, signed
 * preview-pass cookie that the free AI endpoints require. Rate-limited on the
 * same per-IP bucket as previews so the verification step itself can't be
 * hammered.
 */
export async function POST(req: Request): Promise<NextResponse> {
  // If the gate isn't configured, this endpoint is a no-op success so the
  // client flow continues uninterrupted.
  if (!gateEnabled()) return NextResponse.json({ ok: true })

  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })

  const { success } = await previewLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests. Please wait before trying again.' }, { status: 429 })
  }

  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof gateRequestSchema.parse>
  try {
    data = gateRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const ok = await verifyTurnstileToken(data.token, ip)
  if (!ok) {
    return NextResponse.json({ error: 'Verification failed. Please try again.' }, { status: 403 })
  }

  const cookie = passCookie()
  const res = NextResponse.json({ ok: true })
  res.cookies.set(cookie.name, cookie.value, cookie.options)
  return res
}
