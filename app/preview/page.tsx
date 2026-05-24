'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { FollowupResponse, Product } from '@/lib/types'
import { MAX_FOLLOWUP_QUESTIONS } from '@/lib/validators'
import { ProgressBar } from '@/components/ui/ProgressBar'

// ─── Package definitions ──────────────────────────────────────────────────────

const PACKAGES = [
  {
    product: 'brief' as Product,
    flow:    'pre' as const,
    badge:      'Pre-quote',
    badgeClass: 'bg-blue-50 text-blue-700',
    label:   'Diagnostic Brief',
    tagline: "Know what you're dealing with before you call anyone.",
    price:   '$14',
    meta:    'Instant · PDF included · 30-day chat included',
    features: [
      'Complete diagnosis & most likely root cause',
      "DIY feasibility — what you can and can't self-fix",
      'Exactly who to hire and what credentials to verify',
      'Regional cost range with what drives variation',
      '8 tailored questions to ask every contractor',
      'Hiring red flags specific to this trade',
      'What to insist on in writing before work begins',
      '30 days of unlimited follow-up chat about your issue',
    ],
  },
  {
    product: 'shield' as Product,
    flow:    'post' as const,
    badge:      'Post-quote',
    badgeClass: 'bg-green-50 text-green-700',
    label:   'Quote Shield',
    tagline: "Find out if the price is fair before you sign anything.",
    price:   '$34',
    meta:    'Instant · Living report · 60 days of updates & chat',
    features: [
      'Line-by-line analysis of your quote',
      'Upsell & padding detection',
      'Pricing verdict with specific dollar reasoning',
      "Missing scope — what should be in the quote but isn't",
      "Red flags & green flags in this contractor's approach",
      'Negotiation guide with exact language to use',
      '8–12 questions tailored to this specific contractor',
      'Update free for 60 days as new quotes come in',
      '60 days of unlimited follow-up chat about your situation',
    ],
  },
]

// ─── Followup Q&A component ───────────────────────────────────────────────────

interface FollowupQAProps {
  sessionId:  string
  flow:       string
  onExhausted: () => void
}

interface QAPair {
  question: string
  answer:   string
}

function FollowupQA({ sessionId, onExhausted }: FollowupQAProps) {
  const [input, setInput]           = useState('')
  const [history, setHistory]       = useState<QAPair[]>([])
  const [remaining, setRemaining]   = useState(MAX_FOLLOWUP_QUESTIONS)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [history])

  const handleAsk = async () => {
    const question = input.trim()
    if (!question || loading) return

    setInput('')
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/followup', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, question }),
      })
      const json: FollowupResponse | { error: string } = await res.json()

      if (res.status === 403) {
        onExhausted()
        return
      }

      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Could not get an answer. Please try again.')
        return
      }

      const { answer, questionsRemaining } = json as FollowupResponse
      setHistory(prev => [...prev, { question, answer }])
      setRemaining(questionsRemaining)

      if (questionsRemaining === 0) {
        onExhausted()
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="mt-8 pt-8 border-t border-brand-border">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-base font-semibold text-brand-navy">Have a question?</h3>
        <span className="text-xs text-brand-muted">
          {remaining} free {remaining === 1 ? 'question' : 'questions'} remaining
        </span>
      </div>

      {history.length > 0 && (
        <div className="space-y-4 mb-4">
          {history.map((pair, i) => (
            <div key={i}>
              <div className="flex justify-end mb-1.5">
                <div className="bg-brand-navy text-white text-sm rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[85%] leading-relaxed">
                  {pair.question}
                </div>
              </div>
              <div className="flex justify-start">
                <div className="bg-white border border-brand-border text-sm text-brand-navy rounded-2xl rounded-tl-sm px-4 py-2.5 max-w-[85%] leading-relaxed">
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

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAsk() } }}
          placeholder="Ask a question about your situation…"
          maxLength={1000}
          className="input flex-1"
          disabled={loading}
          aria-label="Ask a follow-up question"
        />
        <button
          onClick={handleAsk}
          disabled={!input.trim() || loading}
          className="px-4 py-2.5 bg-brand-navy text-white text-sm rounded-xl disabled:opacity-40 transition-opacity flex-shrink-0 flex items-center gap-2"
        >
          {loading ? <LoadingSpinner size={14} color="white" /> : 'Ask'}
        </button>
      </div>
      <p className="text-[11px] text-brand-muted mt-2">
        Purchase the full report for unlimited follow-up chat.
      </p>
    </div>
  )
}

// ─── Main preview page ────────────────────────────────────────────────────────

export default function PreviewPage() {
  const router = useRouter()
  const { flow, preview, sessionId } = useSessionStore()
  const [purchasing, setPurchasing]     = useState(false)
  const [purchaseError, setPurchaseError] = useState<string | null>(null)
  const [followupExhausted, setFollowupExhausted] = useState(false)

  useEffect(() => {
    if (!flow) router.replace('/')
    else if (!preview || !sessionId) router.replace('/intake')
  }, [flow, preview, sessionId, router])

  if (!flow || !preview || !sessionId) return null

  const primaryPackage   = PACKAGES.find(p => p.flow === flow)!
  const secondaryPackage = PACKAGES.find(p => p.flow !== flow)!

  const handlePurchase = async (product: Product) => {
    setPurchaseError(null)
    setPurchasing(true)
    try {
      const res = await fetch('/api/checkout', {
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
      setPurchaseError('Network error. Please check your connection and try again.')
      setPurchasing(false)
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar onBack={() => router.push('/questions')} />
        <ProgressBar step={3} total={3} />

        {/* ── Free preview header ──────────────────────────────────────────── */}
        <div className="mb-5">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-brand-border rounded-full mb-4">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-xs font-medium text-brand-muted">Free preview</span>
          </div>
          <h2 className="text-2xl font-semibold text-brand-navy">Here&apos;s what we found</h2>
        </div>

        {/* ── Issue summary ────────────────────────────────────────────────── */}
        <div className="card mb-2.5">
          <p className="section-label">Issue Summary</p>
          <p className="text-sm text-brand-navy leading-relaxed">{preview.summary}</p>
        </div>

        {/* ── Severity + cost ──────────────────────────────────────────────── */}
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

        {/* ── Key insight ──────────────────────────────────────────────────── */}
        <div className="card border-l-[3px] border-l-brand-amber rounded-l-none mb-6">
          <p className="section-label text-brand-amber">Key Insight</p>
          <p className="text-sm text-brand-navy leading-relaxed">{preview.keyInsight}</p>
        </div>

        {/* ── Pre-purchase follow-up Q&A — surfaced as an invitation ────── */}
        <div className="mb-8">
          {!followupExhausted ? (
            <div className="border border-brand-amber rounded-xl overflow-hidden">
              <div className="bg-brand-amber bg-opacity-[0.06] px-5 pt-4 pb-3 border-b border-brand-amber border-opacity-20">
                <p className="text-sm font-semibold text-brand-navy mb-0.5">
                  Have a question about this?
                </p>
                <p className="text-xs text-brand-muted">
                  Ask up to {MAX_FOLLOWUP_QUESTIONS} free questions before purchasing.
                </p>
              </div>
              <div className="bg-white px-5 pb-5 pt-4 rounded-b-xl">
                <FollowupQA
                  sessionId={sessionId}
                  flow={flow}
                  onExhausted={() => setFollowupExhausted(true)}
                />
              </div>
            </div>
          ) : (
            <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm font-semibold text-amber-800 mb-1">
                Free questions used
              </p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Every report includes unlimited follow-up chat — continue the conversation after purchasing.
              </p>
            </div>
          )}
        </div>

        {/* ── Upsell section ───────────────────────────────────────────────── */}
        <div>
          <h3 className="text-xl font-semibold text-brand-navy mb-1.5">
            Want the full picture?
          </h3>
          <p className="text-sm text-brand-muted mb-6">
            Your free preview is just the start. Every report includes unlimited follow-up chat for the duration of your window.
          </p>

          {/* Primary package */}
          <div className="border-2 border-brand-navy rounded-2xl overflow-hidden mb-3">
            <div className="px-6 pt-6 pb-5">
              <div className="flex items-start justify-between mb-1">
                <div>
                  <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md mb-2 ${primaryPackage.badgeClass}`}>
                    {primaryPackage.badge}
                  </span>
                  <h4 className="text-base font-semibold text-brand-navy">{primaryPackage.label}</h4>
                  <p className="text-xs text-brand-muted mt-0.5">{primaryPackage.tagline}</p>
                </div>
                <div className="text-right flex-shrink-0 ml-4">
                  <p className="text-2xl font-semibold text-brand-navy">{primaryPackage.price}</p>
                  <p className="text-[10px] text-brand-muted">{primaryPackage.meta}</p>
                </div>
              </div>
            </div>

            <div className="px-6 pb-5">
              <ul className="space-y-2 mb-5">
                {primaryPackage.features.map(f => (
                  <li key={f} className="flex items-start gap-2.5">
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                      <circle cx="7" cy="7" r="6.5" fill="#F0FDF4" stroke="#86EFAC" />
                      <path d="M4 7l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    <span className="text-xs text-brand-muted leading-relaxed">{f}</span>
                  </li>
                ))}
              </ul>

              {purchaseError && (
                <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs text-red-700">{purchaseError}</p>
                </div>
              )}

              <button
                onClick={() => handlePurchase(primaryPackage.product)}
                disabled={purchasing}
                className="btn-primary flex items-center justify-center gap-2"
              >
                {purchasing ? (
                  <><LoadingSpinner size={15} color="white" /><span>Redirecting to checkout…</span></>
                ) : (
                  `Get ${primaryPackage.label} — ${primaryPackage.price}`
                )}
              </button>
            </div>
          </div>


          {/* Secondary package */}
          <div className="bg-white border border-brand-border rounded-xl px-5 py-4">
            <div className="flex items-center justify-between">
              <div>
                <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded mb-1 ${secondaryPackage.badgeClass}`}>
                  {secondaryPackage.badge}
                </span>
                <p className="text-xs font-semibold text-brand-navy">{secondaryPackage.label}</p>
                <p className="text-[11px] text-brand-muted mt-0.5">{secondaryPackage.tagline}</p>
              </div>
              <div className="text-right flex-shrink-0 ml-4">
                <p className="text-sm font-semibold text-brand-navy mb-1">{secondaryPackage.price}</p>
                <button
                  onClick={() => handlePurchase(secondaryPackage.product)}
                  disabled={purchasing}
                  className="text-xs text-brand-muted hover:text-brand-navy border border-brand-border rounded-lg px-3 py-1.5 transition-colors whitespace-nowrap"
                >
                  Get this instead
                </button>
              </div>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-brand-muted text-center mt-4">
          Secure checkout powered by Stripe · No subscription · One-time purchase
        </p>
      </div>
    </main>
  )
}
