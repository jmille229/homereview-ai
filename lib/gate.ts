import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'

/**
 * lib/gate.ts — Bot gate for the free, unauthenticated AI endpoints.
 *
 * The preview pipeline (`/api/questions`, `/api/analyze`) runs expensive Claude
 * calls before any payment. Per-IP rate limits don't stop an attacker rotating
 * IPs, so we put a Cloudflare Turnstile challenge in front: the user solves it
 * once on the intake page, the server verifies the token and issues a short,
 * signed, HttpOnly "preview pass" cookie that the AI endpoints require.
 *
 * Feature-flagged by env so a deploy never breaks if keys aren't set yet:
 *   - TURNSTILE_SECRET_KEY unset            -> gate dormant (allow), warn once.
 *   - TURNSTILE_SECRET_KEY set              -> gate enforced.
 * The matching NEXT_PUBLIC_TURNSTILE_SITE_KEY drives the client widget.
 */

const PASS_COOKIE = 'hr_preview_pass'
const PASS_TTL_SECONDS = 60 * 60 // 60 min — spans intake -> questions -> analyze
const TOKEN_VERSION = 'v1'

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify'

export function gateEnabled(): boolean {
  return !!process.env.TURNSTILE_SECRET_KEY
}

// ─── Signing (shares ACCESS_TOKEN_SECRET; distinct message prefix) ────────────

function getSecret(): string {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (secret && secret.length >= 16) return secret
  if (process.env.NODE_ENV === 'development') return 'dev-insecure-access-secret-change-me'
  throw new Error('ACCESS_TOKEN_SECRET must be set (>=16 chars).')
}

function sign(exp: number): string {
  return createHmac('sha256', getSecret()).update(`preview-pass.${exp}`).digest('hex')
}

function mintPass(): { value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS
  return { value: `${TOKEN_VERSION}.${exp}.${sign(exp)}`, maxAge: PASS_TTL_SECONDS }
}

function passIsValid(token: string | undefined): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [version, expRaw, sig] = parts
  if (version !== TOKEN_VERSION) return false
  const exp = Number(expRaw)
  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return false
  const expected = sign(exp)
  if (sig.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// ─── Turnstile verification ────────────────────────────────────────────────

/** Verifies a Turnstile token with Cloudflare. Returns false on any failure. */
export async function verifyTurnstileToken(token: string, ip: string | null): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY
  if (!secret) return false

  const form = new URLSearchParams()
  form.set('secret', secret)
  form.set('response', token)
  if (ip) form.set('remoteip', ip)

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 5000)
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
      signal: controller.signal,
    }).finally(() => clearTimeout(timer))
    const json = (await res.json()) as { success?: boolean }
    return json.success === true
  } catch {
    return false
  }
}

// ─── Cookie helpers (request-scoped) ──────────────────────────────────────────

export function passCookie(): { name: string; value: string; options: Record<string, unknown> } {
  const { value, maxAge } = mintPass()
  return {
    name: PASS_COOKIE,
    value,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
      maxAge,
    },
  }
}

/**
 * Whether the current request may use the preview pipeline.
 *
 * SECURITY (#9): When the gate is unconfigured this now FAILS CLOSED in
 * production — a dropped/missing TURNSTILE_SECRET_KEY no longer silently
 * disables the only bot protection in front of the expensive pre-payment Claude
 * calls. Operators who intentionally run ungated must opt in explicitly with
 * ALLOW_UNGATED_PREVIEW=true. Development is always allowed for local testing.
 */
export function hasValidPreviewPass(): boolean {
  if (!gateEnabled()) {
    if (process.env.NODE_ENV !== 'production') return true
    if (process.env.ALLOW_UNGATED_PREVIEW === 'true') {
      console.warn('[gate] TURNSTILE_SECRET_KEY not set — bot gate DISABLED via ALLOW_UNGATED_PREVIEW.')
      return true
    }
    console.error('[gate] TURNSTILE_SECRET_KEY not set in production — failing closed. ' +
      'Set the Turnstile keys, or ALLOW_UNGATED_PREVIEW=true to intentionally run ungated.')
    return false
  }
  return passIsValid(cookies().get(PASS_COOKIE)?.value)
}
