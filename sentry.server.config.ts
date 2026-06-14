import * as Sentry from '@sentry/nextjs'

// Dormant unless NEXT_PUBLIC_SENTRY_DSN is set (init with no DSN is a no-op).
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  enabled: !!process.env.NEXT_PUBLIC_SENTRY_DSN,
})
