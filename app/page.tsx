'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { Button } from '@/components/ui/Button'
import { ScaleIcon, ShieldIcon, DocumentIcon, ChatIcon, SearchIcon, ClipboardIcon, PaperclipIcon } from '@/components/ui/icons'
import { QuoteScanVisual } from '@/components/ui/QuoteScanVisual'
import type { Flow } from '@/lib/types'

const SAMPLE_PREVIEW = {
  issue:   'AC running but not cooling — ice on outdoor copper lines',
  summary: 'Classic refrigerant undercharge: the indoor fan is running normally but the system cannot transfer heat because refrigerant is depleted. The icing on copper lines confirms this. Likely cause is a slow leak at a fitting or coil joint — though a failed metering device or severely restricted filter are possible secondary causes requiring professional confirmation.',
  severity: 'Urgent',
  costMin: 800,
  costMax: 2800,
  insight: 'Running the system with low refrigerant causes the compressor to work without lubrication — burnout typically occurs within days to weeks, converting an $800–$1,500 repair into a $3,500–$6,000+ compressor replacement. Turn off the system until diagnosed.',
}

// The two products map to two moments on one timeline — something's wrong and
// you haven't called anyone (Brief), or you have a quote and haven't signed
// (Shield). Presenting them as a sequence makes the relationship self-evident,
// so the cards need no framing sentence above them. Styling is identical:
// equal weight, the user self-locates by their moment, and we instrument the
// click so the hierarchy can be settled with data rather than opinion.
const PRODUCTS = [
  {
    flow:    'pre' as Flow,
    Icon:    SearchIcon,
    moment:  'Before you call',
    badge:   'Diagnostic Brief',
    label:   'I have a home problem.',
    sub:     'Understand it before you call anyone.',
    features: [
      'Plain-language diagnosis of the likely root cause',
      'Severity rating & how long it\'s safe to wait',
      'DIY vs. pro — and exactly which type of pro',
      '8 questions to ask before you hire',
    ],
    cta:     'Diagnose my problem — free preview',
  },
  {
    flow:    'post' as Flow,
    Icon:    ClipboardIcon,
    moment:  'Before you sign',
    badge:   'Quote Shield',
    label:   'I have a contractor\'s quote.',
    sub:     'See how it compares before you commit.',
    features: [
      'Line-by-line pricing vs. regional benchmarks',
      'Verdict: Fair / High End / Inflated',
      'Upsell & padding detection, missing scope',
      'Negotiation guide with exact language to use',
    ],
    cta:     'Review my quote — free preview',
  },
]

const TRUST_STRIP = [
  { Icon: ScaleIcon,    text: 'No contractor incentives' },
  { Icon: ShieldIcon,   text: 'Conservative AI guardrails' },
  { Icon: DocumentIcon, text: 'Plain-language reports' },
  { Icon: ChatIcon,     text: 'Chat support included' },
]

// Product-neutral — works whether the visitor is diagnosing a problem or
// evaluating a quote. (The old steps assumed a quote upload, which misdescribed
// the Diagnostic Brief path.)
const HOW_IT_WORKS = [
  {
    n:     '01',
    Icon:  PaperclipIcon,
    title: 'Tell us what\'s going on',
    body:  'Describe the problem or upload the contractor\'s quote — a photo or PDF, plus a line or two of context. Takes about two minutes.',
  },
  {
    n:     '02',
    Icon:  SearchIcon,
    title: 'Independent AI analysis',
    body:  'Our AI works only for you — no referrals, no kickbacks. It diagnoses the likely cause, benchmarks fair cost, and flags anything that doesn\'t add up.',
  },
  {
    n:     '03',
    Icon:  ShieldIcon,
    title: 'Free preview, then the full report',
    body:  'See the headline finding free. Unlock the full breakdown, the questions to ask, negotiation language, and follow-up chat.',
  },
]

export default function HomePage() {
  const router = useRouter()
  const { reset, setFlow } = useSessionStore()

  const handleStart = (flow: Flow) => {
    track('homepage_path_click', { path: flow === 'pre' ? 'brief' : 'shield' })
    reset()
    setFlow(flow)
    router.push('/intake')
  }

  // Nav "Start free" is path-neutral — no flow preset, so the intake page shows
  // its own picker and the user self-selects there.
  const handleStartNeutral = () => {
    track('homepage_path_click', { path: 'nav' })
    reset()
    router.push('/intake')
  }

  return (
    <div className="min-h-screen bg-brand-bg">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <NavBar variant="site" onStart={handleStartNeutral} />

      <main>

        {/* ── Hero: unified message, moment-first ───────────────────────────── */}
        <section className="max-w-5xl mx-auto px-5 pt-14 pb-10">
          <div className="grid md:grid-cols-2 gap-10 md:gap-8 items-center">
            {/* Copy */}
            <div className="text-center md:text-left">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 bg-white border border-brand-border rounded-full mb-6">
                <ShieldIcon size={13} className="text-brand-amber-deep" />
                <span className="text-[11px] font-medium text-brand-muted">
                  Independent — no contractor referrals, no kickbacks
                </span>
              </div>

              <h1 className="text-4xl sm:text-5xl font-bold text-brand-navy leading-[1.08] tracking-tight mb-5">
                Never face a contractor{' '}
                <span className="text-brand-amber-deep italic">unprepared.</span>
              </h1>
              <p className="text-lg text-brand-muted leading-relaxed">
                An independent AI advisor that helps you understand what&apos;s likely
                going on, what similar jobs typically cost, and how your quote
                compares — before you call anyone or sign anything. Always on your side.
              </p>
            </div>

            {/* Visual */}
            <div className="px-2 sm:px-6 md:px-0 pt-2 md:pt-0">
              <QuoteScanVisual />
            </div>
          </div>
        </section>

        {/* ── The fork: two equal paths on one timeline ─────────────────────── */}
        <section id="products" className="max-w-4xl mx-auto px-5 pb-14">
          <div className="grid md:grid-cols-2 gap-4">
            {PRODUCTS.map(({ flow, Icon, moment, badge, label, sub, features, cta }) => (
              <div
                key={flow}
                className="flex flex-col bg-white border border-brand-border rounded-2xl p-6 sm:p-7 hover:border-brand-border-dark transition-colors"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-amber-deep uppercase tracking-[0.06em]">
                    <span className="w-1.5 h-1.5 rounded-full bg-brand-amber-deep" aria-hidden="true" />
                    {moment}
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-brand-muted">
                    <Icon size={13} className="text-brand-muted" />
                    {badge}
                  </span>
                </div>

                <h2 className="text-xl font-bold text-brand-navy leading-snug mb-1">{label}</h2>
                <p className="text-sm text-brand-muted mb-5">{sub}</p>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {features.map(f => (
                    <li key={f} className="flex items-start gap-2.5">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className="flex-shrink-0 mt-0.5" aria-hidden="true">
                        <circle cx="7" cy="7" r="6.5" fill="#F0FDF4" stroke="#86EFAC" />
                        <path d="M4 7l2 2 4-4" stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span className="text-xs text-brand-muted leading-relaxed">{f}</span>
                    </li>
                  ))}
                </ul>

                <Button full onClick={() => handleStart(flow)}>{cta} →</Button>
                <p className="text-[11px] text-brand-muted text-center mt-2.5">
                  Free preview · No credit card required
                </p>
              </div>
            ))}
          </div>

          <p className="text-center text-xs text-brand-muted mt-5">
            Curious what you get?{' '}
            <Link href="/sample" className="font-semibold text-brand-amber-deep hover:text-brand-navy underline underline-offset-2">
              See a sample report →
            </Link>
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

        {/* ── How it works (product-neutral) ────────────────────────────────── */}
        <section id="how-it-works" className="bg-white py-16">
          <div className="max-w-4xl mx-auto px-5">
            <h2 className="text-3xl font-bold text-brand-navy text-center mb-12">How it works</h2>
            <div className="grid sm:grid-cols-3 gap-8">
              {HOW_IT_WORKS.map(({ n, Icon, title, body }) => (
                <div key={n}>
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-brand-bg border border-brand-border flex items-center justify-center flex-shrink-0">
                      <Icon size={18} className="text-brand-amber-deep" />
                    </div>
                    <span className="text-2xl font-bold text-brand-border tabular-nums">{n}</span>
                  </div>
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
        <section className="py-16 px-5 border-t border-brand-border">
          <div className="max-w-4xl mx-auto bg-brand-navy rounded-2xl p-8 sm:p-12">
            <div className="grid sm:grid-cols-2 gap-10 items-center">
              <div>
                <h2 className="text-3xl font-bold text-white leading-tight mb-4">
                  Walk into every contractor conversation prepared.
                </h2>
                <p className="text-sm text-white opacity-70 leading-relaxed mb-8">
                  Take a breath — we&apos;ll help you figure this out together.
                  Independent, jargon-free, squarely on your side.
                </p>
                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => handleStart('pre')}
                    className="px-5 py-3 bg-white bg-opacity-10 border border-white border-opacity-20 text-white text-sm font-semibold rounded-xl hover:bg-opacity-20 transition-all"
                  >
                    Diagnose a problem →
                  </button>
                  <button
                    onClick={() => handleStart('post')}
                    className="px-5 py-3 bg-white bg-opacity-10 border border-white border-opacity-20 text-white text-sm font-semibold rounded-xl hover:bg-opacity-20 transition-all"
                  >
                    Review a quote →
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
