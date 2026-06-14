'use client'

import * as Sentry from '@sentry/nextjs'
import { useEffect } from 'react'

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body style={{ fontFamily: 'system-ui, sans-serif', background: '#F5F0E8', color: '#1C2B3A' }}>
        <div style={{ maxWidth: 420, margin: '15vh auto', padding: '0 20px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 20, fontWeight: 700, marginBottom: 8 }}>Something went wrong</h1>
          <p style={{ fontSize: 14, color: '#5A6678', lineHeight: 1.6, marginBottom: 24 }}>
            An unexpected error occurred. Please refresh the page — if it keeps happening, email
            support@homereviewai.com and we&apos;ll help.
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block', background: '#1C2B3A', color: '#fff', textDecoration: 'none',
              fontSize: 14, fontWeight: 600, padding: '12px 20px', borderRadius: 12,
            }}
          >
            Back to home
          </a>
        </div>
      </body>
    </html>
  )
}
