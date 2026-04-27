'use client'

import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/store/session'

const HOW_IT_WORKS = [
  {
    step: '01',
    title: 'Describe your situation',
    body: 'Tell us about your home issue or paste in a contractor quote. Upload photos or documents if you have them.',
  },
  {
    step: '02',
    title: 'Get instant free insights',
    body: 'Our AI analyzes your situation and returns a free preview — severity rating, cost range, and a key insight — in under 60 seconds.',
  },
  {
    step: '03',
    title: 'Unlock the full picture',
    body: 'Choose the report that fits your situation. Get a detailed diagnosis, contractor questions, and negotiation guidance.',
  },
]

const VALUE_PROPS = [
  {
    icon: '⚖️',
    title: 'Completely independent',
    body: 'We have no financial relationship with any contractor. Our only job is to give you accurate, unbiased information.',
  },
  {
    icon: '⚡',
    title: 'In under 60 seconds',
    body: 'No scheduling, no waiting for a call back. Describe your issue and get real insights immediately.',
  },
  {
    icon: '🎯',
    title: 'Specific to your situation',
    body: "Not generic advice from a forum. Analysis tailored to your issue, your region, and your contractor's actual quote.",
  },
  {
    icon: '🔒',
    title: 'No referral incentives',
    body: 'We never recommend contractors or earn referral fees. What you read is what we actually think.',
  },
]

export default function HomePage() {
  const router = useRouter()
  const { reset } = useSessionStore()

  const handleStart = () => {
    reset()
    router.push('/category')
  }

  return (
    <div className="min-h-screen bg-brand-bg">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <nav className="border-b border-brand-border bg-brand-bg sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-xs font-semibold text-brand-amber tracking-[0.1em]">
              HOMEREVIEW
            </span>
          </div>
          <button
            onClick={handleStart}
            className="text-xs font-medium text-brand-navy border border-brand-border rounded-lg px-4 py-2 hover:border-brand-border-dark transition-colors"
          >
            Get Started
          </button>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 pt-16 pb-20 sm:pt-24 sm:pb-28 text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-brand-border rounded-full mb-8">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" aria-hidden="true" />
          <span className="text-xs text-brand-muted font-medium">
            Independent · No contractor referrals · US homeowners
          </span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-semibold text-brand-navy leading-[1.1] tracking-tight mb-6">
          Stop guessing what your
          <br className="hidden sm:block" />
          {' '}home repair should cost.
        </h1>

        <p className="text-lg sm:text-xl text-brand-muted leading-relaxed max-w-xl mx-auto mb-10">
          Get an objective AI analysis of your home issue or contractor quote — 
          specific to your situation, completely unbiased, in under 60 seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            onClick={handleStart}
            className="w-full sm:w-auto px-8 py-4 bg-brand-navy text-white text-sm font-semibold rounded-xl hover:bg-opacity-90 active:scale-[0.98] transition-all"
          >
            Get Started — It&apos;s Free →
          </button>
          <p className="text-xs text-brand-muted">
            Free preview · No account required
          </p>
        </div>
      </section>

      {/* ── Social proof bar ────────────────────────────────────────────────── */}
      <div className="border-y border-brand-border bg-white">
        <div className="max-w-3xl mx-auto px-5 py-5 flex flex-wrap justify-center gap-x-10 gap-y-3">
          {[
            'Free preview on every issue',
            'No account needed to start',
            'No contractor referral fees — ever',
            'Regional cost benchmarking',
          ].map((item) => (
            <div key={item} className="flex items-center gap-2">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="6.5" stroke="#D4A06A" />
                <path d="M4 7l2 2 4-4" stroke="#D4A06A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="text-xs text-brand-muted">{item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 py-20 sm:py-28">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-brand-amber tracking-[0.12em] uppercase mb-3">
            How it works
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-brand-navy">
            Answers in three steps
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {HOW_IT_WORKS.map(({ step, title, body }) => (
            <div key={step} className="relative">
              <div className="text-4xl font-bold text-brand-border mb-4 leading-none select-none" aria-hidden="true">
                {step}
              </div>
              <h3 className="text-sm font-semibold text-brand-navy mb-2">{title}</h3>
              <p className="text-sm text-brand-muted leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Two use cases ───────────────────────────────────────────────────── */}
      <section className="bg-white border-y border-brand-border">
        <div className="max-w-3xl mx-auto px-5 py-20 sm:py-28">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-brand-amber tracking-[0.12em] uppercase mb-3">
              Two situations, one tool
            </p>
            <h2 className="text-3xl sm:text-4xl font-semibold text-brand-navy">
              Wherever you are in the process
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div className="bg-brand-bg border border-brand-border rounded-2xl p-7">
              <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-5 text-lg" aria-hidden="true">
                🔍
              </div>
              <h3 className="text-base font-semibold text-brand-navy mb-2">
                Before you call anyone
              </h3>
              <p className="text-sm text-brand-muted leading-relaxed mb-5">
                Something&apos;s wrong and you don&apos;t know how serious it is, what it costs, 
                or who to call. We give you the knowledge to enter that conversation with confidence.
              </p>
              <ul className="space-y-2">
                {['Severity & urgency assessment', 'Regional cost range', 'Who to hire and what to verify', '8 questions to ask every contractor'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-xs text-brand-muted">
                    <div className="w-1 h-1 rounded-full bg-brand-amber flex-shrink-0" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="bg-brand-bg border border-brand-border rounded-2xl p-7">
              <div className="w-10 h-10 rounded-xl bg-green-50 flex items-center justify-center mb-5 text-lg" aria-hidden="true">
                🛡️
              </div>
              <h3 className="text-base font-semibold text-brand-navy mb-2">
                After you receive a quote
              </h3>
              <p className="text-sm text-brand-muted leading-relaxed mb-5">
                You have a number in front of you and you don&apos;t know if it&apos;s fair. 
                We analyze the quote line by line — and flag anything that looks off.
              </p>
              <ul className="space-y-2">
                {['Line-by-line quote analysis', 'Upsell and padding detection', 'Negotiation guide with exact language', 'Living report — update as quotes come in'].map(item => (
                  <li key={item} className="flex items-center gap-2 text-xs text-brand-muted">
                    <div className="w-1 h-1 rounded-full bg-brand-amber flex-shrink-0" aria-hidden="true" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ── Value props ─────────────────────────────────────────────────────── */}
      <section className="max-w-3xl mx-auto px-5 py-20 sm:py-28">
        <div className="text-center mb-14">
          <p className="text-xs font-semibold text-brand-amber tracking-[0.12em] uppercase mb-3">
            Why HomeReview
          </p>
          <h2 className="text-3xl sm:text-4xl font-semibold text-brand-navy">
            Built for the homeowner, not the contractor
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {VALUE_PROPS.map(({ icon, title, body }) => (
            <div key={title} className="flex gap-4">
              <div className="text-2xl flex-shrink-0 mt-0.5" aria-hidden="true">{icon}</div>
              <div>
                <h3 className="text-sm font-semibold text-brand-navy mb-1.5">{title}</h3>
                <p className="text-sm text-brand-muted leading-relaxed">{body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="bg-brand-navy">
        <div className="max-w-xl mx-auto px-5 py-20 text-center">
          <h2 className="text-3xl sm:text-4xl font-semibold text-white mb-4 leading-tight">
            Know before you commit.
          </h2>
          <p className="text-base text-white opacity-70 mb-10 leading-relaxed">
            Start with a free preview — no account, no payment, no pressure.
          </p>
          <button
            onClick={handleStart}
            className="px-8 py-4 bg-brand-amber text-white text-sm font-semibold rounded-xl hover:bg-opacity-90 active:scale-[0.98] transition-all"
          >
            Get Started — It&apos;s Free →
          </button>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-brand-border bg-brand-bg">
        <div className="max-w-5xl mx-auto px-5 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-xs font-semibold text-brand-amber tracking-[0.1em]">HOMEREVIEW</span>
          </div>
          <p className="text-xs text-brand-muted text-center">
            HomeReview AI provides informational analysis, not licensed professional advice.
            US homeowners · v1
          </p>
        </div>
      </footer>

    </div>
  )
}
