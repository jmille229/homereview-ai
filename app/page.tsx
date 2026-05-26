'use client'

import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/store/session'

const TRUST_POINTS = [
  { icon: '⚖️', text: 'No contractor referrals — ever' },
  { icon: '🔒', text: 'Independent analysis, always on your side' },
  { icon: '⚡', text: 'Free preview before you decide anything' },
]

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Describe your situation',
    body: 'Tell us what\'s happening. Upload a photo or a contractor quote if you have one.',
  },
  {
    step: '02',
    title: 'Get a free preview',
    body: 'Severity rating, cost range, and a key clinical insight — in under 60 seconds.',
  },
  {
    step: '03',
    title: 'Unlock the full report',
    body: 'Complete diagnosis, contractor questions, and negotiation guidance specific to your situation.',
  },
]

export default function HomePage() {
  const router = useRouter()
  const { reset } = useSessionStore()

  const handleStart = () => {
    reset()
    router.push('/intake')
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-10 sm:py-16">

        {/* Wordmark */}
        <div className="flex items-center gap-2 mb-12">
          <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
          <span className="text-xs font-semibold text-brand-amber tracking-[0.08em]">
            HOMEREVIEW
          </span>
        </div>

        {/* Hero */}
        <h1 className="text-3xl sm:text-4xl font-semibold text-brand-navy leading-tight mb-4">
          Your independent
          <br />
          home repair advisor.
        </h1>
        <p className="text-base text-brand-muted leading-relaxed mb-8">
          AI-powered analysis of your home issue or contractor quote —
          objective, on-demand, and always on your side.
        </p>

        {/* Trust moment */}
        <div className="flex flex-col gap-2.5 mb-8 p-4 bg-white border border-brand-border rounded-xl">
          {TRUST_POINTS.map(({ icon, text }) => (
            <div key={text} className="flex items-center gap-3">
              <span className="text-base w-5 text-center flex-shrink-0" aria-hidden="true">
                {icon}
              </span>
              <span className="text-sm text-brand-muted">{text}</span>
            </div>
          ))}
        </div>

        {/* Single CTA — no pre/post choice, no prices */}
        <button
          onClick={handleStart}
          className="btn-primary mb-3 text-base py-4"
        >
          Get started — it&apos;s free →
        </button>
        <p className="text-xs text-brand-muted text-center mb-12">
          Free preview included · No account needed
        </p>

        {/* How it works */}
        <div className="border-t border-brand-border pt-10">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.06em] mb-6">
            How it works
          </p>
          <div className="space-y-6">
            {HOW_IT_WORKS.map(({ step, title, body }) => (
              <div key={step} className="flex gap-4">
                <span className="text-2xl font-bold text-brand-border leading-none flex-shrink-0 tabular-nums w-8">
                  {step}
                </span>
                <div>
                  <p className="text-sm font-semibold text-brand-navy mb-1">{title}</p>
                  <p className="text-sm text-brand-muted leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer trust */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 mt-10 pt-8 border-t border-brand-border mb-5">
          {[
            'Free preview on every issue',
            'No account needed',
            'US homeowners (v1)',
          ].map((t) => (
            <span key={t} className="text-xs text-brand-muted">{t}</span>
          ))}
        </div>
        <p className="text-[11px] text-brand-muted leading-relaxed">
          HomeReview AI provides general informational analysis only — not professional
          contractor, engineering, or legal advice. See our{' '}
          <a href="/terms" className="underline underline-offset-2 hover:text-brand-navy transition-colors">
            terms of service
          </a>
          {' '}for full disclaimer and limitation of liability.
        </p>

      </div>
    </main>
  )
}
