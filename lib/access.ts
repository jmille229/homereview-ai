import { createHmac, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import type { Product } from './enums'

/**
 * lib/access.ts — Capability-based access control for paid reports.
 *
 * The session UUID alone is no longer sufficient to view a paid report or use
 * chat: the requester must also present a signed, HttpOnly access cookie that
 * is minted only after Stripe confirms payment (in /api/report) or after the
 * payer proves ownership via the email they used at checkout (in
 * /api/report/reclaim).
 *
 * The token is stateless and self-verifying — an HMAC over `${sessionId}.${exp}`
 * keyed by ACCESS_TOKEN_SECRET — so verification needs no extra Redis round-trip.
 * One cookie is issued per session so a user may hold reports for several
 * purchases simultaneously.
 */

// ─── Access windows (must match each product's living-report / chat window) ───

const PRODUCT_ACCESS_DAYS: Record<Product, number> = {
  brief:  30,
  shield: 60,
}

export function accessWindowSeconds(product: Product): number {
  return (PRODUCT_ACCESS_DAYS[product] ?? 30) * 24 * 60 * 60
}

// ─── Secret ───────────────────────────────────────────────────────────────────

/**
 * Returns the signing secret. Fails closed in production: if the secret is not
 * configured, access tokens cannot be minted or verified, so no paid surface is
 * reachable. In development a fixed placeholder is used so local testing works
 * without configuration.
 */
function getSecret(): string {
  const secret = process.env.ACCESS_TOKEN_SECRET
  if (secret && secret.length >= 16) return secret
  // Fail closed everywhere EXCEPT a local development server. The previous
  // check only threw when NODE_ENV === 'production', so any other value
  // (test, staging, or unset) silently fell back to a public, hardcoded
  // secret — which would make every access cookie forgeable on a reachable
  // non-prod build. Only NODE_ENV === 'development' (i.e. `next dev`) is exempt.
  if (process.env.NODE_ENV === 'development') {
    return 'dev-insecure-access-secret-change-me'
  }
  throw new Error('ACCESS_TOKEN_SECRET must be set (>=16 chars).')
}

// ─── Cookie naming / options ────────────────────────────────────────────────

export const ACCESS_COOKIE_PREFIX = 'hr_access_'

export function accessCookieName(sessionId: string): string {
  return `${ACCESS_COOKIE_PREFIX}${sessionId}`
}

export function accessCookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    secure:   process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path:     '/',
    maxAge:   maxAgeSeconds,
  }
}

// ─── Token mint / verify ───────────────────────────────────────────────────

const TOKEN_VERSION = 'v1'

function sign(sessionId: string, exp: number): string {
  return createHmac('sha256', getSecret())
    .update(`${sessionId}.${exp}`)
    .digest('hex')
}

/** Mints a signed token authorizing access to `sessionId` for `ttlSeconds`. */
export function createAccessToken(sessionId: string, ttlSeconds: number): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds
  return `${TOKEN_VERSION}.${exp}.${sign(sessionId, exp)}`
}

/** Verifies a token authorizes access to `sessionId` and has not expired. */
export function verifyAccessToken(sessionId: string, token: string | undefined | null): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [version, expRaw, sig] = parts
  if (version !== TOKEN_VERSION) return false

  const exp = Number(expRaw)
  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return false

  const expected = sign(sessionId, exp)
  // Constant-time comparison. Both are hex strings of equal length when valid.
  if (sig.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// ─── Read-only share tokens ─────────────────────────────────────────────────
//
// A separate, read-only capability so a buyer can share their report (e.g. with
// a spouse or the contractor) without granting chat/upload access. Distinct
// message prefix so a share token can never be used as an access token.

const SHARE_TTL_SECONDS = 60 * 60 * 24 * 180 // 180 days

function signShare(sessionId: string, exp: number): string {
  return createHmac('sha256', getSecret()).update(`share.${sessionId}.${exp}`).digest('hex')
}

export function createShareToken(sessionId: string): string {
  const exp = Math.floor(Date.now() / 1000) + SHARE_TTL_SECONDS
  return `${TOKEN_VERSION}.${exp}.${signShare(sessionId, exp)}`
}

export function verifyShareToken(sessionId: string, token: string | undefined | null): boolean {
  if (!token) return false
  const parts = token.split('.')
  if (parts.length !== 3) return false
  const [version, expRaw, sig] = parts
  if (version !== TOKEN_VERSION) return false
  const exp = Number(expRaw)
  if (!Number.isInteger(exp) || exp <= Math.floor(Date.now() / 1000)) return false
  const expected = signShare(sessionId, exp)
  if (sig.length !== expected.length) return false
  try {
    return timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
  } catch {
    return false
  }
}

// ─── Request-scoped helper (server components + route handlers) ───────────────

/**
 * Reads the per-session access cookie from the current request and verifies it.
 * Safe to call from server components and route handlers.
 */
export function hasValidAccess(sessionId: string): boolean {
  const token = cookies().get(accessCookieName(sessionId))?.value
  return verifyAccessToken(sessionId, token)
}
