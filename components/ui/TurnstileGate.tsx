'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

/**
 * Cloudflare Turnstile widget. Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is configured; otherwise it's inert and the parent treats the gate as
 * not required (matching the server, which only enforces when its secret is set).
 *
 * Reports the solved token (or null on expiry/error) via onToken.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

// Minimal shape of the global injected by Turnstile's api.js.
interface TurnstileApi {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string
  remove: (id: string) => void
}
declare global {
  // eslint-disable-next-line no-var
  var turnstile: TurnstileApi | undefined
}

export function turnstileRequired(): boolean {
  return !!SITE_KEY
}

export function TurnstileGate({ onToken }: { onToken: (token: string | null) => void }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetId = useRef<string | null>(null)
  const [ready, setReady] = useState(false)

  // Keep the latest callback without re-running the render effect.
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!SITE_KEY || !ready || !containerRef.current || !globalThis.turnstile) return
    if (widgetId.current) return

    widgetId.current = globalThis.turnstile.render(containerRef.current, {
      sitekey: SITE_KEY,
      callback: (token: string) => onTokenRef.current(token),
      'expired-callback': () => onTokenRef.current(null),
      'error-callback': () => onTokenRef.current(null),
    })

    return () => {
      if (widgetId.current && globalThis.turnstile) {
        try { globalThis.turnstile.remove(widgetId.current) } catch { /* already gone */ }
        widgetId.current = null
      }
    }
  }, [ready])

  if (!SITE_KEY) return null

  return (
    <div className="mb-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
        onLoad={() => setReady(true)}
      />
      <div ref={containerRef} />
    </div>
  )
}
