'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { Button } from '@/components/ui/Button'
import { ScaleIcon, ShieldIcon, DocumentIcon, ChatIcon } from '@/components/ui/icons'
import type { Flow } from '@/lib/types'

const SAMPLE_PREVIEW = {
  issue:   'AC running but not cooling — ice on outdoor copper lines',
  summary: 'Classic refrigerant undercharge: the indoor fan is running normally but the system cannot transfer heat because refrigerant is depleted. The icing on copper lines confirms this. Likely cause is a slow leak at a fitting or coil joint — though a failed metering device or severely restricted filter are possible secondary causes requiring professional confirmation.',
  severity: 'Urgent',
  costMin: 800,
  costMax: 2800,
  insight: 'Running the system with low refrigerant causes the compressor to work without lubrication — burnout typically occurs within days to weeks, converting an $800–$1,500 repair into a $3,500–$6,000+ compressor replacement. Turn off the system until diagnosed.',
}

const PRODUCTS = [
  {
    flow:       'pre' as Flow,
    badge:      'Diagnostic Brief',
    badgeStyle: 'bg-blue-50 text-blue-700',
    label:      'I have a home problem.',
    sub:        "Help me understand it before I call anyone.",
    features: [
      'Plain-language diagnosis of the likely root cause',
      'Severity rating & how long it\'s safe to wait',
      'DIY vs. pro — and exactly which type of pro',
      '8 questions to ask before picking a contractor',
      'Hiring red flags + cost preparation guide',
      '30-day follow-up chat included',
    ],
  },
  {
    flow:       'post' as Flow,
    badge:      'Quote Shield',
    badgeStyle: 'bg-emerald-50 text-emerald-700',
    label:      'I have a quote to evaluate.',
    sub:        'Tell me if it\'s fair — and help me push back.',
    features: [
      'Line-by-line analysis with regional benchmarks',
      'Pricing verdict: Fair / High End / Inflated',
      'Upsell & padding detection, missing scope',
      'Tailored negotiation guide with exact language',
      'Living report — upload revised quotes for 60 days',
      '60-day follow-up chat included',
    ],
  },
]

const TRUST_STRIP = [
  { Icon: ScaleIcon,    text: 'No contractor incentives' },
  { Icon: ShieldIcon,   text: 'Conservative AI guardrails' },
  { Icon: DocumentIcon, text: 'Plain-language reports' },
  { Icon: ChatIcon,     text: 'Chat support included' },
]

const HOW_IT_WORKS = [
  {
    n:     '01',
    title: 'Tell us what\'s going on',
    body:  'Describe the issue, upload photos, and — for Quote Shield — attach the contractor\'s estimate. Takes about two minutes.',
  },
  {
    n:     '02',
    title: 'Get a free preview instantly',
    body:  'We surface the likely cause, a conservative severity rating, and a regional cost bracket. No payment required to see this.',
  },
  {
    n:     '03',
    title: 'Unlock the right report',
    body:  'Diagnostic Brief for pre-quote clarity. Quote Shield for full quote analysis with 60 days of free updates as the project evolves.',
  },
]

export default function HomePage() {
  const router = useRouter()
  const { reset, setFlow } = useSessionStore()

  const handleStart = (flow: Flow) => {
    reset()
    setFlow(flow)
    router.push('/intake')
  }

  return (
    <div className="min-h-screen bg-brand-bg">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <NavBar variant="site" onStart={() => handleStart('pre')} />

      <main>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="max-w-3xl mx-auto px-5 pt-16 pb-12 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-brand-border rounded-full mb-8">
            <ShieldIcon size={13} className="text-brand-amber-deep" />
            <span className="text-[11px] font-medium text-brand-muted">
              Independent — no contractor referrals, no kickbacks
            </span>
          </div>

          <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-[1.1] tracking-tight mb-5">
            Know what you&apos;re{' '}
            <span className="text-brand-amber italic">actually</span>{' '}
            paying for.
          </h1>
          <p className="text-lg text-brand-muted leading-relaxed mb-10 max-w-xl mx-auto">
            HomeReview AI is the independent advisor homeowners turn to before —
            and after — they call a contractor. Two reports, built for two very different moments.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center mb-5">
            <Button size="lg" onClick={() => handleStart('pre')}>
              I have a problem — get a Diagnostic Brief →
            </Button>
            <Button size="lg" variant="secondary" onClick={() => handleStart('post')}>
              I have a quote — get Quote Shield
            </Button>
          </div>
          <p className="text-xs text-brand-muted">
            Free preview in under 2 minutes · No credit card required
          </p>
        </section>

        {/* ── Trust strip ───────────────────────────────────────────────────── */}
        <section className="border-y border-brand-border bg-white" aria-label="Trust indicators">
          <div className="max-w-4xl mx-auto px-5 py-4 flex flex-wrap justify-center gap-x-8 gap-y-3">
            {TRUST_STRIP.map(({ Icon, text }) => (
              <div key={text} className="flex items-center gap-2">
                <Icon size={15} className="text-brand-amber-deep flex-shrink-0" />
                <span className="text-xs text-brand-muted font-medium">{text}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Products ──────────────────────────────────────────────────────── */}
        <section id="products" className="max-w-4xl mx-auto px-5 py-16">
          <div className="text-center mb-10">
            <h2 className="text-3xl font-bold text-brand-navy mb-3">Two reports, two moments.</h2>
            <p className="text-base text-brand-muted">Pick the one that matches where you are right now.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {PRODUCTS.map((p) => (
              <div key={p.flow} className="bg-white border border-brand-border rounded-2xl p-6 flex flex-col">
                <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-md mb-4 self-start ${p.badgeStyle}`}>
                  {p.badge}
                </span>
                <p className="text-lg font-bold text-brand-navy leading-snug mb-1">{p.label}</p>
                <p className="text-sm text-brand-muted mb-5">{p.sub}</p>
                <ul className="space-y-2.5 mb-6 flex-1">
                  {p.features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                        <circle cx="7" cy="7" r="6.5" fill="#F0FDF4" stroke="#86EFAC" />
                        <path d="M4 7l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs text-brand-muted leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => handleStart(p.flow)}
                  className="text-sm font-semibold text-brand-amber-deep hover:text-brand-navy transition-colors text-left"
                >
                  Start free preview →
                </button>
              </div>
            ))}
          </div>
          <p className="text-center mt-6">
            <Link href="/sample" className="text-sm font-semibold text-brand-muted hover:text-brand-navy underline underline-offset-2">
              See a sample Quote Shield report →
            </Link>
          </p>
        </section>

        {/* ── How it works ──────────────────────────────────────────────────── */}
        <section id="how-it-works" className="border-t border-brand-border bg-white py-16">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="text-3xl font-bold text-brand-navy text-center mb-12">How it works</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map(({ n, title, body }) => (
                <div key={n}>
                  <p className="text-3xl font-bold text-brand-amber mb-3">{n}</p>
                  <p className="text-base font-semibold text-brand-navy mb-2">{title}</p>
                  <p className="text-sm text-brand-muted leading-relaxed">{body}</p>
                </div>
              ))}
            </div>
            <div className="mt-10 flex items-center justify-center gap-2.5 p-4 bg-brand-bg border border-brand-border rounded-xl">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="6.5" stroke="#B8722E" strokeWidth="1.5"/>
                <path d="M8 4v4l2 2" stroke="#B8722E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <p className="text-sm text-brand-muted">
                Quote Shield is a <strong className="text-brand-navy">living report</strong> — keep uploading revised quotes, contracts, and invoices for 60 days.
              </p>
            </div>
          </div>
        </section>

        {/* ── Sample preview CTA (dark navy) ────────────────────────────────── */}
        <section className="py-16 px-5">
          <div className="max-w-4xl mx-auto bg-brand-navy rounded-2xl p-8 sm:p-12">
            <div className="grid sm:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white leading-tight mb-4">
                  Walk into every contractor call prepared.
                </h2>
                <p className="text-sm text-white opacity-70 leading-relaxed mb-8">
                  Take a breath — we&apos;ll help you figure this out together.
                  Independent, jargon-free, squarely on your side.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  {/* amber-deep: white text on the lighter brand amber fails AA at this size */}
                  <button
                    onClick={() => handleStart('pre')}
                    className="px-5 py-3 bg-brand-amber-deep text-white text-sm font-semibold rounded-xl hover:bg-opacity-90 transition-all"
                  >
                    Start a Diagnostic Brief →
                  </button>
                  <button
                    onClick={() => handleStart('post')}
                    className="px-5 py-3 bg-white bg-opacity-10 border border-white border-opacity-20 text-white text-sm font-semibold rounded-xl hover:bg-opacity-20 transition-all"
                  >
                    Evaluate a quote
                  </button>
                </div>
              </div>

              {/* Sample preview card */}
              <div className="bg-white bg-opacity-[0.06] border border-white border-opacity-10 rounded-xl p-5">
                <p className="text-[11px] font-semibold text-white opacity-60 uppercase tracking-[0.08em] mb-3">
                  Sample free preview
                </p>
                <p className="text-xs text-white opacity-70 mb-3 leading-relaxed">
                  Issue: {SAMPLE_PREVIEW.issue}
                </p>
                <p className="text-sm text-white font-semibold leading-snug mb-4">
                  {SAMPLE_PREVIEW.summary}
                </p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  <div className="bg-white bg-opacity-[0.08] rounded-lg p-3">
                    <p className="text-[11px] text-white opacity-70 mb-1.5">Severity</p>
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-red-400 flex-shrink-0" aria-hidden="true" />
                      <span className="text-sm font-semibold text-white">{SAMPLE_PREVIEW.severity}</span>
                    </div>
                  </div>
                  <div className="bg-white bg-opacity-[0.08] rounded-lg p-3">
                    <p className="text-[11px] text-white opacity-70 mb-1.5">Typical cost</p>
                    <p className="text-sm font-semibold text-white">
                      ${SAMPLE_PREVIEW.costMin.toLocaleString()}–${SAMPLE_PREVIEW.costMax.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="border-t border-white border-opacity-10 pt-3">
                  <p className="text-[11px] text-white opacity-60 uppercase tracking-[0.06em] mb-1.5">Key insight</p>
                  <p className="text-xs text-white opacity-80 leading-relaxed">{SAMPLE_PREVIEW.insight}</p>
                </div>
                <p className="text-[11px] text-white opacity-60 mt-3">
                  + full diagnosis, red flags &amp; negotiation guide unlock with report
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <footer className="border-t border-brand-border">
          <div className="max-w-4xl mx-auto px-5 py-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-brand-amber" aria-hidden="true" />
                <span className="text-[11px] font-semibold text-brand-amber-deep tracking-[0.08em]">HOMEREVIEW</span>
              </div>
              <nav className="flex flex-wrap gap-x-5 gap-y-1" aria-label="Footer navigation">
                {[
                  { href: '/learn',   label: 'Learn' },
                  { href: '/about',   label: 'About' },
                  { href: '/recover', label: 'My report' },
                  { href: '/privacy', label: 'Privacy' },
                  { href: '/terms',   label: 'Terms' },
                ].map(({ href, label }) => (
                  <Link key={href} href={href} className="text-xs text-brand-muted hover:text-brand-navy transition-colors">
                    {label}
                  </Link>
                ))}
              </nav>
            </div>
            <p className="text-xs text-brand-muted leading-relaxed mt-5">
              HomeReview AI provides general informational analysis only — not professional
              contractor, engineering, or legal advice.{' '}
              <Link href="/terms" className="underline underline-offset-2 hover:text-brand-navy transition-colors">
                Full terms and disclaimer →
              </Link>
            </p>
          </div>
        </footer>

      </main>
    </div>
  )
}
