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

/**
 * The origin the request was actually served from (scheme + host). Used to
 * recognise SAME-ORIGIN requests on ANY deployment domain — the production
 * domain, the *.vercel.app alias, and every per-branch preview URL — without
 * hardcoding them. The app only ever makes same-origin fetches, so this is
 * both correct and what unblocks preview deployments (whose Origin is the
 * preview URL, not NEXT_PUBLIC_BASE_URL).
 */
function requestOrigin(req: NextRequest): string | null {
  const host = req.headers.get('host')
  if (!host) return null
  const proto = req.headers.get('x-forwarded-proto') ?? 'https'
  return `${proto}://${host}`
}

function isAllowedOrigin(req: NextRequest, origin: string | null): boolean {
  if (!origin) return true                              // server-to-server / same-origin GET
  if (isDev) return true
  if (origin === ALLOWED_ORIGIN) return true            // configured production origin
  return origin === requestOrigin(req)                  // same-origin (covers preview deploys)
}

function buildCorsHeaders(req: NextRequest, origin: string | null): Record<string, string> {
  const allowedOrigin = isAllowedOrigin(req, origin) ? (origin ?? ALLOWED_ORIGIN) : ''
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
    return new NextResponse(null, { status: 204, headers: buildCorsHeaders(req, origin) })
  }

  // Block disallowed origins (except Stripe webhooks — no Origin header).
  if (!req.nextUrl.pathname.startsWith('/api/webhooks/') && !isAllowedOrigin(req, origin)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const response = NextResponse.next()
  for (const [key, value] of Object.entries(buildCorsHeaders(req, origin))) {
    response.headers.set(key, value)
  }
  return response
}

// ─── Content-Security-Policy (document routes) ────────────────────────────────
//
// Two policies, chosen per path:
//
//   • Funnel / app routes (the `(flow)` route group) reflect user + AI content,
//     so they get a STRICT per-request nonce policy with NO script-src
//     'unsafe-inline'. Those routes are dynamically rendered (see
//     app/(flow)/layout.tsx) so Next can stamp the nonce onto its scripts.
//
//   • Marketing routes render only static, trusted content and stay statically
//     CDN-cached, so they keep the looser 'unsafe-inline' policy (a static page
//     can't carry a per-request nonce, and there's no untrusted input to protect).
//
// Host-sourced scripts still load under the strict policy because we don't use
// 'strict-dynamic'.

/** Paths that handle user / AI / payment data — get the strict nonce policy. */
const STRICT_CSP_PREFIXES = ['/intake', '/questions', '/preview', '/success', '/unlock', '/report']

function isStrictPath(pathname: string): boolean {
  return STRICT_CSP_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`))
}

const SHARED_DIRECTIVES = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "style-src 'self' 'unsafe-inline'", // Tailwind/Next inject inline styles; far lower risk than script
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://api.stripe.com https://challenges.cloudflare.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com https://challenges.cloudflare.com",
  "frame-ancestors 'self'",
  "form-action 'self'",
]

function nonceCsp(nonce: string): string {
  const scriptSrc = [
    "'self'",
    `'nonce-${nonce}'`,
    'https://challenges.cloudflare.com', // Turnstile widget script
    isDev ? "'unsafe-eval'" : '',
  ].filter(Boolean).join(' ')
  return [`script-src ${scriptSrc}`, ...SHARED_DIRECTIVES].join('; ')
}

function staticCsp(): string {
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'"
  return [scriptSrc, ...SHARED_DIRECTIVES].join('; ')
}

function handleDocument(req: NextRequest): NextResponse {
  // Marketing / static pages: looser policy, no nonce, stays CDN-cacheable.
  if (!isStrictPath(req.nextUrl.pathname)) {
    const response = NextResponse.next()
    response.headers.set('Content-Security-Policy', staticCsp())
    return response
  }

  // Funnel / app pages: per-request nonce. Propagated via request headers so
  // Next applies it to the scripts it renders.
  const nonce = btoa(crypto.randomUUID())
  const csp = nonceCsp(nonce)
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
