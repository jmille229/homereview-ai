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

const isDev = process.env.NODE_ENV === 'development'

// ─── CORS (API routes) ────────────────────────────────────────────────────────

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return true                              // server-to-server / same-origin
  if (isDev) return true
  return origin === ALLOWED_ORIGIN
}

function buildCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(origin) ? (origin ?? ALLOWED_ORIGIN) : ''
  return {
    'Access-Control-Allow-Origin':  allowedOrigin,
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age':       '86400',
  }
}

function handleApi(req: NextRequest): NextResponse {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new NextResponse(null, { status: 204, headers: buildCorsHeaders(origin) })
  }

  // Block disallowed origins (except Stripe webhooks — no Origin header).
  if (!req.nextUrl.pathname.startsWith('/api/webhooks/') && !isAllowedOrigin(origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const response = NextResponse.next()
  for (const [key, value] of Object.entries(buildCorsHeaders(origin))) {
    response.headers.set(key, value)
  }
  return response
}

// ─── Content-Security-Policy (document routes) ────────────────────────────────
//
// Replaces the static, script-src 'unsafe-inline' policy that lived in
// next.config.js with a per-request nonce. Next.js reads the nonce from the CSP
// on the inbound request headers and stamps it onto every framework <script>,
// so we can drop 'unsafe-inline' for scripts entirely — any injected inline
// script without the nonce is refused. Host-sourced scripts ('self', Turnstile)
// still load because we don't use 'strict-dynamic'.
//
// Trade-off: a per-request nonce opts matched pages into dynamic rendering
// (they can no longer be served as fully static HTML).

function buildCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    'https://challenges.cloudflare.com', // Turnstile widget script
    isDev ? "'unsafe-eval'" : '',         // React Refresh / dev tooling only
  ].filter(Boolean).join(' ')

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    `script-src ${scriptSrc}`,
    "style-src 'self' 'unsafe-inline'", // Tailwind/Next inject inline styles; far lower risk than script
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self' https://api.stripe.com https://challenges.cloudflare.com",
    "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
    "frame-ancestors 'self'",
    "form-action 'self'",
  ].join('; ')
}

function handleDocument(req: NextRequest): NextResponse {
  const nonce = btoa(crypto.randomUUID())
  const csp = buildCsp(nonce)

  // Propagate the nonce + CSP to the framework via request headers so Next can
  // apply the nonce to the scripts it renders.
  const requestHeaders = new Headers(req.headers)
  requestHeaders.set('x-nonce', nonce)
  requestHeaders.set('Content-Security-Policy', csp)

  const response = NextResponse.next({ request: { headers: requestHeaders } })
  response.headers.set('Content-Security-Policy', csp)
  return response
}

export function middleware(req: NextRequest): NextResponse {
  if (req.nextUrl.pathname.startsWith('/api/')) return handleApi(req)
  return handleDocument(req)
}

export const config = {
  // Run on API routes (CORS) and document routes (CSP), but skip static assets
  // and image optimization where a per-request nonce is pointless.
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)',
  ],
}
