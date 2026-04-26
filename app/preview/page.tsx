'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { Product } from '@/lib/types'

const PRE_UNLOCKS = [
  'Complete diagnosis and most likely root cause',
  'DIY feasibility — what you can and cannot self-fix',
  'Exactly who to hire and what credentials to verify',
  '8 questions to ask every contractor before choosing one',
  'Hiring red flags specific to this trade and job type',
  'What to insist on in writing before work begins',
]

const POST_UNLOCKS = [
  'Line-by-line analysis of your quote',
  'Upsell and unnecessary item detection',
  'Pricing verdict with specific dollar reasoning',
  '8–12 questions tailored to this specific contractor',
  'Negotiation guide with exact language to use',
  'Living report — update free for 60 days as new info arrives',
]

const PRODUCT_MAP: Record<string, Product> = {
  pre: 'brief',
  post: 'shield',
}

const PRICE_MAP: Record<Product, string> = {
  brief: '$14',
  shield: '$34',
  bundle: '$42',
}

const PRODUCT_LABEL: Record<Product, string> = {
  brief: 'Diagnostic Brief',
  shield: 'Quote Shield',
  bundle: 'HomeReview Bundle',
}

const PRODUCT_META: Record<Product, string> = {
  brief: 'Instant · PDF download',
  shield: 'Instant · Living report · 60 days · PDF export',
  bundle: 'Diagnostic Brief + Quote Shield · Save $6',
}

export default function PreviewPage() {
  const router = useRouter()
  const { flow, preview, sessionId } = useSessionStore()
  const [purchasing, setPurchasing] = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  useEffect(() => {
    if (!flow) router.replace('/')
    else if (!preview || !sessionId) router.replace('/intake')
  }, [flow, preview, sessionId, router])

  if (!flow || !preview || !sessionId) return null

  const product = PRODUCT_MAP[flow]
  const unlocks = flow === 'pre' ? PRE_UNLOCKS : POST_UNLOCKS
  const price = PRICE_MAP[product]
  const productLabel = PRODUCT_LABEL[product]
  const productMeta = PRODUCT_META[product]

  const handlePurchase = async (selectedProduct: Product) => {
    setPurchaseError(null)
    setPurchasing(true)

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, product: selectedProduct }),
      })

      const json: { url: string } | { error: string } = await res.json()

      if (!res.ok || 'error' in json) {
        setPurchaseError(('error' in json ? json.error : null) ?? 'Checkout failed. Please try again.')
        setPurchasing(false)
        return
      }

      // Redirect to Stripe Checkout (hosted, PCI-compliant)
      window.location.href = (json as { url: string }).url
    } catch {
      setPurchaseError('Network error. Please check your connection and try again.')
      setPurchasing(false)
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar onBack={() => router.push('/intake')} />

        {/* Header */}
        <div className="mb-5">
          <h2 className="text-2xl font-semibold text-brand-navy mb-1">
            Your free preview is ready
          </h2>
          <p className="text-sm text-brand-muted">
            {flow === 'pre' ? 'Pre-quote analysis' : 'Post-quote analysis'}
          </p>
        </div>

        {/* Issue summary */}
        <div className="card mb-2.5">
          <p className="section-label">Issue Summary</p>
          <p className="text-sm text-brand-navy leading-relaxed">{preview.summary}</p>
        </div>

        {/* Severity + cost */}
        <div className="grid grid-cols-2 gap-2.5 mb-2.5">
          <div className="card">
            <p className="section-label">Severity</p>
            <SeverityBadge severity={preview.severity} className="mb-2.5" />
            <p className="text-xs text-brand-muted leading-relaxed">{preview.severityReason}</p>
          </div>
          <div className="card">
            <p className="section-label">Typical Cost Range</p>
            <p className="text-2xl font-semibold text-brand-navy mb-1">
              ${preview.costMin.toLocaleString()}–${preview.costMax.toLocaleString()}
            </p>
            <p className="text-xs text-brand-muted">For this type of issue in your area</p>
          </div>
        </div>

        {/* Key insight */}
        <div className="card border-l-[3px] border-l-blue-300 rounded-l-none mb-6">
          <p className="section-label text-blue-600">Key Insight</p>
          <p className="text-sm text-brand-navy leading-relaxed">{preview.keyInsight}</p>
        </div>

        {/* Paywall card */}
        <div className="border border-brand-border rounded-xl overflow-hidden">
          {/* What's locked */}
          <div className="p-5 bg-gray-50">
            <p className="text-sm font-semibold text-brand-navy mb-3">
              {productLabel} unlocks:
            </p>
            <ul className="space-y-2" aria-label="Report contents">
              {unlocks.map((item) => (
                <li key={item} className="flex items-start gap-2.5 opacity-40">
                  <div className="w-[15px] h-[15px] border border-brand-border-dark rounded-[3px] flex-shrink-0 mt-0.5" />
                  <span className="text-xs text-brand-navy">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Purchase */}
          <div className="p-5 bg-white border-t border-brand-border">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-brand-navy">{productLabel}</p>
                <p className="text-xs text-brand-muted mt-0.5">{productMeta}</p>
              </div>
              <p className="text-2xl font-semibold text-brand-navy">{price}</p>
            </div>

            {purchaseError && (
              <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">{purchaseError}</p>
              </div>
            )}

            <button
              onClick={() => handlePurchase(product)}
              disabled={purchasing}
              className="btn-primary mb-2 flex items-center justify-center gap-2"
            >
              {purchasing ? (
                <>
                  <LoadingSpinner size={16} color="white" />
                  <span>Redirecting to checkout…</span>
                </>
              ) : (
                `Get ${productLabel} — ${price}`
              )}
            </button>

            <button
              onClick={() => handlePurchase('bundle')}
              disabled={purchasing}
              className="btn-ghost text-xs"
            >
              + Get both reports — $42{' '}
              <span className="text-green-600">(save $6)</span>
            </button>

            <p className="text-[11px] text-brand-muted text-center mt-3">
              Secure checkout powered by Stripe
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
