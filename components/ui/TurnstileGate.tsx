'use client'

import Script from 'next/script'
import { useEffect, useRef, useState } from 'react'

/**
 * Cloudflare Turnstile widget. Renders only when NEXT_PUBLIC_TURNSTILE_SITE_KEY
 * is configured; otherwise it's inert and the parent treats the gate as
 * not required (matching the server, which only enforces when its secret is set).
 *
 * Reports the solved token (or null on expiry/error) via onToken.
 *
 * IMPORTANT: rendering is driven by the actual availability of `window.turnstile`,
 * NOT by next/script's onLoad. next/script loads api.js once per session and
 * dedupes it, so onLoad does NOT fire when you return to this page via in-app
 * navigation / back-forward — which previously left the widget unrendered and
 * the form blocked until a hard refresh. Checking the global directly (with a
 * short poll for the first load) renders reliably on every mount.
 */

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

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
  const [failed, setFailed] = useState(false)

  // Keep the latest callback without re-running the render effect.
  const onTokenRef = useRef(onToken)
  onTokenRef.current = onToken

  useEffect(() => {
    if (!SITE_KEY) return
    let cancelled = false
    let pollId: ReturnType<typeof setInterval> | undefined
    let timeoutId: ReturnType<typeof setTimeout> | undefined

    const renderWidget = () => {
      if (cancelled || widgetId.current || !containerRef.current || !globalThis.turnstile?.render) return
      try {
        widgetId.current = globalThis.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          callback: (token: string) => { setFailed(false); onTokenRef.current(token) },
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        })
      } catch {
        /* render throws if the element already hosts a widget — safe to ignore */
      }
    }

    if (globalThis.turnstile?.render) {
      // API already loaded (returning via client navigation) — render now.
      renderWidget()
    } else {
      // First load — poll until api.js has defined window.turnstile.
      pollId = setInterval(() => {
        if (globalThis.turnstile?.render) {
          if (pollId) clearInterval(pollId)
          renderWidget()
        }
      }, 100)
      // If it never loads (blocked/offline), surface a clear message instead of
      // leaving the user stuck behind a dead button.
      timeoutId = setTimeout(() => {
        if (pollId) clearInterval(pollId)
        if (!widgetId.current && !cancelled) setFailed(true)
      }, 15000)
    }

    return () => {
      cancelled = true
      if (pollId) clearInterval(pollId)
      if (timeoutId) clearTimeout(timeoutId)
      if (widgetId.current && globalThis.turnstile) {
        try { globalThis.turnstile.remove(widgetId.current) } catch { /* already gone */ }
        widgetId.current = null
      }
    }
  }, [])

  if (!SITE_KEY) return null

  return (
    <div className="mb-3">
      <Script
        src="https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
        strategy="afterInteractive"
      />
      <div ref={containerRef} />
      {failed && (
        <p role="alert" className="text-xs text-red-600 mt-1 leading-relaxed">
          Couldn&apos;t load the verification widget.{' '}
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="underline font-semibold"
          >
            Refresh the page
          </button>
          {' '}or disable any ad/script blockers, then try again.
        </p>
      )}
    </div>
  )
}
