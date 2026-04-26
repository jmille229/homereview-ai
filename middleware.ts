import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * MED-04: Fail loudly at startup if the base URL is missing in production.
 * A missing NEXT_PUBLIC_BASE_URL previously caused ALLOWED_ORIGIN to be '',
 * which silently broke all browser requests with 403 while appearing healthy
 * from server-to-server checks.
 */
const ALLOWED_ORIGIN = process.env.NEXT_PUBLIC_BASE_URL ?? ''
if (!ALLOWED_ORIGIN && process.env.NODE_ENV === 'production') {
  throw new Error(
    'NEXT_PUBLIC_BASE_URL must be set in production. ' +
    'Add it to your Vercel environment variables.',
  )
}

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true                              // server-to-server / same-origin
  if (process.env.NODE_ENV === 'development') return true
  return origin === ALLOWED_ORIGIN
}

/**
 * Builds CORS headers for a given origin.
 * The Allow-Origin value reflects the requesting origin when allowed,
 * so the header is always present and correct on passing responses.
 */
function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? (origin ?? ALLOWED_ORIGIN) : ''
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  }
}

/**
 * Validates request origin and applies CORS headers to all API responses.
 *
 * HIGH-03 FIX: The previous implementation only added CORS headers to OPTIONS
 * preflight responses. Actual POST/PATCH responses had no ACAO header, causing
 * browsers to block them even for requests from the correct origin. This
 * version adds CORS headers to every response that passes the origin check.
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  if (!pathname.startsWith('/api/')) return NextResponse.next()

  const origin = req.headers.get('origin')

  // ── Preflight ──────────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new NextResponse(null, {
      status: 204,
      headers: buildCorsHeaders(origin),
    })
  }

  // ── Block disallowed origins (except Stripe webhooks — no Origin header) ──
  if (!pathname.startsWith('/api/webhooks/') && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Pass through — attach CORS headers to the downstream response ──────────
  const response = NextResponse.next()
  const corsHeaders = buildCorsHeaders(origin)
  Object.entries(corsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  return response
}

export const config = {
  matcher: ['/api/:path*'],
}
