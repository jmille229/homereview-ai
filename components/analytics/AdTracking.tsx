'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { GOOGLE_ADS_ID, META_PIXEL_ID } from '@/lib/adConfig'
import { captureAttribution } from '@/lib/analytics'

/**
 * Captures campaign attribution on every navigation and, when configured,
 * loads the Meta Pixel and Google Ads tag and reports page views.
 *
 * The vendor bootstrap snippets are re-implemented here (bundled first-party
 * code) rather than injected as inline <script>s, so they run under the strict
 * nonce CSP on funnel pages. Only the vendor hosts are allowlisted in
 * middleware.ts, and only when the matching env var is set.
 */

function loadScript(src: string): void {
  if (document.querySelector(`script[src="${src}"]`)) return
  const s = document.createElement('script')
  s.async = true
  s.src = src
  document.head.appendChild(s)
}

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[]
  push: unknown
  loaded: boolean
  version: string
}

function initMeta(pixelId: string): void {
  if (window.fbq) return
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as Fbq
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = '2.0'
  fbq.queue = []
  window.fbq = fbq
  ;(window as unknown as { _fbq?: Fbq })._fbq ??= fbq
  loadScript('https://connect.facebook.net/en_US/fbevents.js')
  fbq('init', pixelId)
}

function initGoogle(adsId: string): void {
  if (window.gtag) return
  window.dataLayer = window.dataLayer ?? []
  // gtag.js requires the real `arguments` object to be queued, not an array.
  window.gtag = function gtag() {
    // eslint-disable-next-line prefer-rest-params
    window.dataLayer!.push(arguments)
  }
  loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(adsId)}`)
  window.gtag('js', new Date())
  window.gtag('config', adsId) // also sends the initial page_view
}

export function AdTracking() {
  const pathname = usePathname()
  const firstView = useRef(true)

  useEffect(() => {
    captureAttribution()
    try {
      if (META_PIXEL_ID) {
        initMeta(META_PIXEL_ID)
        window.fbq?.('track', 'PageView')
      }
      if (GOOGLE_ADS_ID) {
        initGoogle(GOOGLE_ADS_ID)
        // `config` already counted the first view; count client-side navigations.
        if (!firstView.current) {
          window.gtag?.('event', 'page_view', { page_path: pathname })
        }
      }
    } catch { /* tracking must never break the page */ }
    firstView.current = false
  }, [pathname])

  return null
}
