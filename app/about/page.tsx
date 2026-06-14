import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'

export const metadata = {
  title: 'About — HomeReview AI',
  description: 'Why we built HomeReview AI and what makes it different.',
}

const VALUES = [
  {
    title: 'Independent — always',
    body: 'We take no referral fees, no contractor partnerships, no advertising revenue. Our only customer is the homeowner. That independence is structural — it cannot be compromised because it is not for sale.',
  },
  {
    title: 'Specific over generic',
    body: 'General advice is everywhere. What homeowners actually need is a specific assessment of their specific situation. We built every prompt, every output format, and every report section around answering the question in front of them — not the average question.',
  },
  {
    title: 'Honest about limitations',
    body: "AI analysis is not a home inspection. It cannot see your house. What it can do is give you the knowledge framework to ask the right questions, recognize red flags, and understand whether a quote is fair. We're explicit about where professional diagnosis is required and where our analysis ends.",
  },
  {
    title: 'Priced fairly',
    body: 'A professional consultation costs $200–$500. A contractor service call to diagnose a problem costs $75–$150. We charge $29 for a Diagnostic Brief and $79 for a Quote Shield — less than one service call, available in under a minute, at 2am if that\'s when you need it.',
  },
]

const HOW_IT_WORKS_DETAIL = [
  {
    step: '01',
    title: 'You describe the situation',
    body: 'Text, photos, or an uploaded contractor quote. The more detail you provide, the more specific the analysis.',
  },
  {
    step: '02',
    title: 'We ask targeted clarifying questions',
    body: 'The AI generates 2–4 questions specific to your situation and category — not generic questionnaire items. Your answers refine the analysis before it begins.',
  },
  {
    step: '03',
    title: 'You get a free preview',
    body: 'Severity classification, cost range, and a key clinical insight — delivered in under 60 seconds. No payment required to see this.',
  },
  {
    step: '04',
    title: 'Unlock the full report',
    body: 'The complete analysis: root cause diagnosis, contractor guidance, cost factors, red flags, negotiation language, and unlimited follow-up chat for your window.',
  },
]

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-2xl mx-auto px-5 py-8">

        {/* Hero */}
        <div className="mb-12">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-xs font-semibold text-brand-amber-deep tracking-[0.08em]">
              ABOUT
            </span>
          </div>
          <h1 className="text-3xl font-semibold text-brand-navy leading-tight mb-5">
            The homeowner&apos;s side of the table.
          </h1>
          <p className="text-base text-brand-muted leading-relaxed mb-4">
            HomeReview AI was built out of a simple observation: the information gap
            between contractors and homeowners is enormous, and almost every tool in
            the home services industry is built to benefit the contractor.
          </p>
          <p className="text-base text-brand-muted leading-relaxed">
            Referral platforms take fees from contractors. Review sites accept advertising.
            The entire ecosystem is funded by the people doing the work — which means
            their incentives are not aligned with the person writing the check.
          </p>
        </div>

        {/* Problem */}
        <div className="card mb-10">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-4">
            The problem we&apos;re solving
          </p>
          <p className="text-sm text-brand-muted leading-relaxed mb-4">
            A homeowner with a broken furnace at 11pm faces a contractor the next morning
            with no technical vocabulary, no cost benchmarks, and no way to know whether
            the diagnosis is accurate or the quote is fair. They are making a $2,000–$10,000
            decision with a knowledge gap measured in decades of trade experience.
          </p>
          <p className="text-sm text-brand-muted leading-relaxed">
            That gap gets closed one of two ways: expensive professional consultation,
            or nothing. HomeReview AI is a third option — immediate, affordable,
            and structurally independent.
          </p>
        </div>

        {/* Values */}
        <div className="mb-12">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-6">
            How we operate
          </p>
          <div className="space-y-6">
            {VALUES.map(({ title, body }) => (
              <div key={title} className="border-l-2 border-brand-amber pl-5">
                <p className="text-sm font-semibold text-brand-navy mb-1.5">{title}</p>
                <p className="text-sm text-brand-muted leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </div>

        {/* How it works detail */}
        <div className="mb-12">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-6">
            How it works
          </p>
          <div className="space-y-6">
            {HOW_IT_WORKS_DETAIL.map(({ step, title, body }) => (
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

        {/* What we are not */}
        <div className="p-5 bg-amber-50 border border-amber-200 rounded-xl mb-12">
          <p className="text-sm font-semibold text-amber-800 mb-2">What we are not</p>
          <p className="text-sm text-amber-700 leading-relaxed">
            HomeReview AI is not a licensed home inspector, structural engineer, or
            contractor. Our analysis is informational — it gives you the knowledge
            to have a better conversation with a professional, not to replace one.
            For any issue involving structural integrity, electrical systems, or
            active safety risk, always consult a licensed professional.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center border-t border-brand-border pt-10">
          <p className="text-sm text-brand-muted mb-5">
            Ready to get a straight answer about your home issue?
          </p>
          <Link
            href="/"
            className="btn-primary inline-block"
          >
            Get started — it&apos;s free →
          </Link>
          <p className="text-xs text-brand-muted mt-3">
            Free preview · No account needed
          </p>
        </div>

        {/* Footer nav */}
        <div className="flex gap-5 justify-center mt-10 pt-8 border-t border-brand-border">
          {[
            { href: '/',        label: 'Home' },
            { href: '/learn',   label: 'Learn' },
            { href: '/privacy', label: 'Privacy' },
            { href: '/terms',   label: 'Terms' },
          ].map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-xs text-brand-muted hover:text-brand-navy transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>

      </div>
    </main>
  )
}
