'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { Button } from '@/components/ui/Button'
import { ShieldIcon } from '@/components/ui/icons'
import { track } from '@vercel/analytics'
import type { FollowupResponse, Product } from '@/lib/types'
import { MAX_FOLLOWUP_QUESTIONS } from '@/lib/validators'

// ─── Package definitions ──────────────────────────────────────────────────────

const PACKAGES = [
  {
    product:    'brief' as Product,
    flow:       'pre' as const,
    badge:      'Diagnostic Brief',
    badgeClass: 'bg-blue-50 text-blue-700',
    label:      'Diagnostic Brief',
    tagline:    "Know exactly what you're dealing with — before you call anyone.",
    price:      '$24',
    meta:       'Instant delivery · 30-day chat included',
    features: [
      'Complete diagnosis & most likely root cause',
      "DIY feasibility — what you can and can't safely self-fix",
      'Exactly which contractor to hire and what credentials to verify',
      'Regional cost range and the specific factors that drive variation',
      '8 targeted questions to ask before signing any estimate',
      'Hiring red flags specific to this trade and job type',
      'What to insist on in writing before work begins',
      '30 days of unlimited follow-up chat',
    ],
  },
  {
    product:    'shield' as Product,
    flow:       'post' as const,
    badge:      'Quote Shield',
    badgeClass: 'bg-emerald-50 text-emerald-700',
    label:      'Quote Shield',
    tagline:    "Find out if the price is fair — and get the language to push back.",
    price:      '$59',
    meta:       'Instant delivery · Living report · 60 days of updates & chat',
    features: [
      'Line-by-line analysis of your quote against regional benchmarks',
      'Pricing verdict: Fair / High End / Inflated — with specific reasoning',
      'Upsell and padding detection by line item',
      "Missing scope — what should be in the quote but isn't",
      "Red flags and green flags in this contractor's specific approach",
      'Negotiation guide with exact language to use',
      '5 targeted questions for this contractor and this job',
      'Living report — upload revised quotes, contracts & invoices for 60 days',
      '60 days of unlimited follow-up chat',
    ],
  },
]

// ─── Follow-up Q&A ────────────────────────────────────────────────────────────

interface QAPair { question: string; answer: string }

function FollowupQA({ sessionId }: { sessionId: string }) {
  const [input, setInput]         = useState('')
  const [history, setHistory]     = useState<QAPair[]>([])
  const [remaining, setRemaining] = useState(MAX_FOLLOWUP_QUESTIONS)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const exhausted = remaining <= 0

  const handleAsk = async () => {
    const question = input.trim()
    if (!question || loading || exhausted) return
    setInput(''); setLoading(true); setError(null)

    try {
      const res  = await fetch('/api/followup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, question }),
      })
      const json: FollowupResponse | { error: string } = await res.json()

      // 403 means the server considers the free allowance spent. Reflect that
      // without tearing down the conversation rendered so far.
      if (res.status === 403) { setRemaining(0); return }
      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Could not get an answer. Try again.')
        return
      }
      const { answer, questionsRemaining } = json as FollowupResponse
      setHistory(prev => [...prev, { question, answer }])
      setRemaining(questionsRemaining)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      {history.length > 0 && (
        <div className="space-y-4 mb-4">
          {history.map((pair, i) => (
            <div key={i}>
              <div className="flex justify-end mb-1.5">
                <div className="bg-brand-navy text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] leading-relaxed break-words">
                  {pair.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-brand-bg border border-brand-border text-sm text-brand-navy rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] leading-relaxed break-words">
                  {pair.answer}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {error && (
        <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {exhausted ? (
        // Allowance spent. The component stays mounted so the answers above
        // remain visible — we only swap the input for an upsell prompt.
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-sm font-semibold text-amber-800 mb-1">
            That&apos;s your {MAX_FOLLOWUP_QUESTIONS} free questions
          </p>
          <p className="text-xs text-amber-700 leading-relaxed">
            Every report includes unlimited follow-up chat — purchase below to
            continue the conversation.
          </p>
        </div>
      ) : (
        <>
          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
              placeholder="Ask something about your situation…"
              maxLength={1000}
              className="input flex-1 text-sm"
              disabled={loading}
              aria-label="Follow-up question"
            />
            <button
              onClick={handleAsk}
              disabled={!input.trim() || loading}
              className="px-4 py-2.5 bg-brand-navy text-white text-sm font-semibold rounded-xl disabled:opacity-40 transition-opacity flex-shrink-0 flex items-center gap-2"
            >
              {loading ? <LoadingSpinner size={14} color="white" /> : 'Ask'}
            </button>
          </div>
          <p className="text-[11px] text-brand-muted mt-2">
            {remaining} free {remaining === 1 ? 'question' : 'questions'} remaining
          </p>
        </>
      )}
    </div>
  )
}

// ─── Checkmark icon ───────────────────────────────────────────────────────────

function Check() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
      <circle cx="7" cy="7" r="6.5" fill="#F0FDF4" stroke="#86EFAC" />
      <path d="M4 7l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PreviewPage() {
  const router = useRouter()
  const { flow, preview, sessionId } = useSessionStore()

  const [purchasing, setPurchasing]       = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)

  useEffect(() => {
    if (!flow) router.replace('/')
    else if (!preview || !sessionId) router.replace('/intake')
  }, [flow, preview, sessionId, router])

  if (!flow || !preview || !sessionId) return null

  // The flow chosen at intake determines the product. We only offer the
  // package that matches this session's flow — checkout rejects a mismatched
  // product, so showing the other package's purchase button would only error.
  const primaryPackage = PACKAGES.find(p => p.flow === flow)!

  const handlePurchase = async (product: Product) => {
    setPurchaseError(null)
    setPurchasing(true)
    track('checkout_started', { product })
    try {
      const res  = await fetch('/api/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, product }),
      })
      const json: { url: string } | { error: string } = await res.json()
      if (!res.ok || 'error' in json) {
        setPurchaseError(('error' in json ? json.error : null) ?? 'Checkout failed. Please try again.')
        setPurchasing(false)
        return
      }
      window.location.href = (json as { url: string }).url
    } catch {
      setPurchaseError('Network error. Please try again.')
      setPurchasing(false)
    }
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <NavBar step="Step 3 of 3" onBack={() => router.push('/questions')} />

      <div className="max-w-xl mx-auto px-5 pt-8 pb-16">
        <ProgressBar step={3} total={3} />

        {/* ── Free preview header ──────────────────────────────────────── */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-200 rounded-full">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-[11px] font-semibold text-emerald-700">Free preview</span>
          </div>
          <p className="text-xs text-brand-muted">No payment required to see this</p>
        </div>

        <h1 className="text-2xl font-bold text-brand-navy mb-6">
          Here&apos;s what we found.
        </h1>

        {/* ── Issue summary ────────────────────────────────────────────── */}
        <div className="bg-white border border-brand-border rounded-xl p-5 mb-3">
          <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-[0.05em] mb-2.5">
            Issue Summary
          </p>
          <p className="text-sm text-brand-navy leading-relaxed">{preview.summary}</p>
        </div>

        {/* ── Severity + cost ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
          <div className="bg-white border border-brand-border rounded-xl p-5">
            <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3">
              Severity
            </p>
            <SeverityBadge severity={preview.severity} className="mb-3" />
            <p className="text-xs text-brand-muted leading-relaxed">{preview.severityReason}</p>
          </div>
          <div className="bg-white border border-brand-border rounded-xl p-5">
            <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3">
              Typical Cost Range
            </p>
            <p className="text-2xl font-bold text-brand-navy mb-1 tabular-nums break-words">
              ${preview.costMin.toLocaleString()}–${preview.costMax.toLocaleString()}
            </p>
            <p className="text-xs text-brand-muted">For this type of issue in your area</p>
          </div>
        </div>

        {/* ── Key insight ──────────────────────────────────────────────── */}
        <div className="bg-white border-l-[3px] border-l-brand-amber border border-brand-border rounded-xl rounded-l-none p-5 mb-8">
          <p className="text-[11px] font-semibold text-brand-amber-deep uppercase tracking-[0.05em] mb-2.5">
            Key Insight
          </p>
          <p className="text-sm text-brand-navy leading-relaxed">{preview.keyInsight}</p>
        </div>

        {/* ── Follow-up Q&A ────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="border border-brand-amber rounded-xl overflow-hidden">
            <div className="px-5 pt-4 pb-3 border-b border-brand-border">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brand-navy">
                  Have a question about this?
                </p>
                <span className="text-[11px] text-brand-muted">
                  {MAX_FOLLOWUP_QUESTIONS} free questions included
                </span>
              </div>
            </div>
            <div className="p-5 bg-white">
              <FollowupQA sessionId={sessionId} />
            </div>
          </div>
        </div>

        {/* ── Unlock section ───────────────────────────────────────────── */}
        <div>
          <div className="flex items-center gap-3 mb-6">
            <div className="flex-1 h-px bg-brand-border" />
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em]">
              Unlock the full report
            </p>
            <div className="flex-1 h-px bg-brand-border" />
          </div>

          <p className="text-sm text-brand-muted leading-relaxed mb-3">
            Your free preview is the start. The full report gives you everything
            you need to move forward with confidence — including unlimited
            follow-up chat for your entire window.
          </p>
          <p className="mb-6">
            <a
              href="/sample"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-semibold text-brand-amber-deep hover:text-brand-navy underline underline-offset-2"
            >
              See a sample report first →
            </a>
          </p>

          {/* Primary package — prominent */}
          <div className="border-2 border-brand-navy rounded-2xl overflow-hidden mb-3">
            <div className="bg-brand-navy px-5 sm:px-6 py-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md mb-2 ${primaryPackage.badgeClass}`}>
                  {primaryPackage.badge}
                </span>
                <h3 className="text-base font-bold text-white break-words">{primaryPackage.label}</h3>
                <p className="text-xs text-white opacity-60 mt-0.5">{primaryPackage.tagline}</p>
              </div>
              <div className="text-right flex-shrink-0 max-w-[42%]">
                <p className="text-3xl font-bold text-white">{primaryPackage.price}</p>
                <p className="text-[11px] text-white opacity-70 mt-0.5">{primaryPackage.meta}</p>
              </div>
            </div>

            <div className="bg-white px-6 py-5">
              <ul className="space-y-2.5 mb-5">
                {primaryPackage.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check />
                    <span className="text-xs text-brand-muted leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              {purchaseError && (
                <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">{purchaseError}</p>
                </div>
              )}

              <Button
                size="lg"
                full
                onClick={() => handlePurchase(primaryPackage.product)}
                loading={purchasing}
                loadingLabel="Redirecting to checkout…"
              >
                {`Get ${primaryPackage.label} — ${primaryPackage.price}`}
              </Button>

              <p className="text-xs text-brand-muted text-center mt-2.5">
                Secure checkout via Stripe · One-time payment · No subscription
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-brand-border">
                <ShieldIcon size={14} className="text-emerald-600 flex-shrink-0" />
                <p className="text-xs font-semibold text-brand-navy">
                  Money-back guarantee — not useful? Email us for a full refund.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
