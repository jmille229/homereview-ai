/** @type {import('next').NextConfig} */

// NOTE: Content-Security-Policy is intentionally NOT set here. It is built
// per-request with a fresh nonce in middleware.ts so we can drop
// script-src 'unsafe-inline'. These remaining headers carry no per-request
// state, so they stay global here.
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains; preload',
  },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
]

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    // Enables instrumentation.ts (Sentry server/edge init) on Next 14.
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ]
  },
}

// Sentry: wraps the build for error/perf monitoring. Source-map upload only runs
// when SENTRY_AUTH_TOKEN/org/project are set; without them the build still
// succeeds (just no uploaded source maps). Runtime reporting is gated on
// NEXT_PUBLIC_SENTRY_DSN in the sentry.*.config files.
const { withSentryConfig } = require('@sentry/nextjs')

module.exports = withSentryConfig(nextConfig, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  disableLogger: true,
})
