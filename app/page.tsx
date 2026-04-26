'use client'

import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/store/session'
import type { Flow } from '@/lib/types'

const FLOWS: Array<{
  type: Flow
  badge: string
  badgeClass: string
  title: string
  description: string
  product: string
  price: string
}> = [
  {
    type: 'pre',
    badge: 'Pre-quote',
    badgeClass: 'bg-blue-50 text-blue-700',
    title: 'I have a home issue',
    description:
      'Understand the problem, severity, and cost range before calling anyone.',
    product: 'Diagnostic Brief',
    price: '$14',
  },
  {
    type: 'post',
    badge: 'Post-quote',
    badgeClass: 'bg-green-50 text-green-700',
    title: 'I have a quote to evaluate',
    description:
      'Find out if the scope and price are fair before you sign anything.',
    product: 'Quote Shield',
    price: '$34',
  },
]

export default function HomePage() {
  const router = useRouter()
  const { setFlow, reset } = useSessionStore()

  const handleSelect = (flow: Flow) => {
    reset()
    setFlow(flow)
    router.push('/category')
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-10 sm:py-16">
        {/* Wordmark */}
        <div className="flex items-center gap-2 mb-12">
          <div className="w-2 h-2 rounded-full bg-brand-amber" />
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
        <p className="text-base text-brand-muted leading-relaxed mb-10">
          AI-powered analysis of your home issue or contractor quote — objective,
          on-demand, and always on your side.
        </p>

        {/* Flow cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
          {FLOWS.map((opt) => (
            <button
              key={opt.type}
              onClick={() => handleSelect(opt.type)}
              className="card text-left hover:border-brand-border-dark active:scale-[0.99] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-amber"
              aria-label={`${opt.title} — ${opt.product} for ${opt.price}`}
            >
              <span
                className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md mb-3 ${opt.badgeClass}`}
              >
                {opt.badge}
              </span>
              <p className="text-[15px] font-semibold text-brand-navy mb-2">
                {opt.title}
              </p>
              <p className="text-[13px] text-brand-muted leading-relaxed mb-5">
                {opt.description}
              </p>
              <div className="border-t border-brand-border pt-3 flex items-baseline justify-between">
                <span className="text-xs text-brand-muted">{opt.product}</span>
                <span className="text-xl font-semibold text-brand-navy">
                  {opt.price}
                </span>
              </div>
            </button>
          ))}
        </div>

        {/* Trust indicators */}
        <div className="flex flex-wrap gap-x-5 gap-y-1.5">
          {[
            'Free preview included',
            'No account needed',
            'No contractor referrals',
            'US homeowners (v1)',
          ].map((t) => (
            <span key={t} className="text-xs text-brand-muted">
              {t}
            </span>
          ))}
        </div>
      </div>
    </main>
  )
}
