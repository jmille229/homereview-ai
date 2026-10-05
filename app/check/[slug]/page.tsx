import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { NavBar } from '@/components/ui/NavBar'
import { JsonLd } from '@/components/seo/JsonLd'
import { LandingCta } from '@/components/landing/LandingCta'
import { LANDING_PAGES, getLandingPage } from '@/lib/landing'
import { priceDisplay } from '@/lib/pricing'
import { absoluteUrl } from '@/lib/site'
import { breadcrumbJsonLd, faqJsonLd, serviceJsonLd } from '@/lib/structuredData'

/**
 * Search-intent landing page template ("Is my HVAC quote fair?"). Content lives
 * in lib/landing.ts; every entry there is statically generated here. Unknown
 * slugs 404 rather than rendering on demand.
 */

interface Props {
  params: { slug: string }
}

export const dynamicParams = false

export function generateStaticParams() {
  return LANDING_PAGES.map(({ slug }) => ({ slug }))
}

export function generateMetadata({ params }: Props): Metadata {
  const page = getLandingPage(params.slug)
  if (!page) return {}
  const path = `/check/${page.slug}`
  return {
    title:       `${page.metaTitle} | HomeReview AI`,
    description: page.metaDescription,
    alternates:  { canonical: path },
    openGraph: {
      title:       page.metaTitle,
      description: page.metaDescription,
      type:        'article',
      url:         path,
    },
  }
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-4">{children}</h2>
  )
}

export default function LandingPage({ params }: Props) {
  const page = getLandingPage(params.slug)
  if (!page) notFound()

  const path      = `/check/${page.slug}`
  const product   = page.flow === 'post' ? 'shield' : 'brief'
  const ctaLabel  = page.flow === 'post' ? 'Check my quote, free preview' : 'Diagnose my problem, free preview'
  const others    = LANDING_PAGES.filter((p) => p.slug !== page.slug)

  return (
    <main className="min-h-screen bg-brand-bg">
      <JsonLd
        data={[
          faqJsonLd(page.faqs),
          breadcrumbJsonLd([['Home', '/'], ['Quote checks', '/check'], [page.shortTitle, path]]),
          serviceJsonLd(product, { url: absoluteUrl(path) }),
        ]}
      />
      <NavBar variant="site" />

      <article className="max-w-2xl mx-auto px-5 py-8">
        <nav aria-label="Breadcrumb" className="text-xs text-brand-muted">
          <Link href="/check" className="font-semibold text-brand-amber-deep hover:text-brand-navy">
            ← All quote checks
          </Link>
        </nav>

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <header className="mt-6 mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-xs font-semibold text-brand-amber-deep tracking-[0.08em] uppercase">
              {page.eyebrow}
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-brand-navy leading-tight tracking-tight mb-4">
            {page.h1}
          </h1>
          <p className="text-base text-brand-muted leading-relaxed mb-6">{page.lede}</p>
          <LandingCta slug={page.slug} flow={page.flow} category={page.category} label={ctaLabel} />
          <p className="text-[11px] text-brand-muted mt-2.5">
            Free preview · No account · Full report {priceDisplay(product)} · No contractor referrals
          </p>
        </header>

        {/* ── Typical costs ────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionLabel>What it typically costs</SectionLabel>
          <div className="bg-white border border-brand-border rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <caption className="text-left text-[11px] text-brand-muted px-5 pt-4 pb-2">
                {page.costTable.caption}
              </caption>
              <thead className="sr-only">
                <tr><th scope="col">Job</th><th scope="col">Typical range</th></tr>
              </thead>
              <tbody>
                {page.costTable.rows.map(({ item, range, note }) => (
                  <tr key={item} className="border-t border-brand-border align-top">
                    <th scope="row" className="text-left font-normal px-5 py-3">
                      <span className="text-brand-navy">{item}</span>
                      {note && <span className="block text-[11px] text-brand-muted mt-0.5">{note}</span>}
                    </th>
                    <td className="px-5 py-3 text-right font-semibold text-brand-navy whitespace-nowrap tabular-nums">
                      {range}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-[11px] text-brand-muted mt-2 leading-relaxed">
            Prices vary by region, home, and season. Your report benchmarks against your ZIP code.
          </p>
        </section>

        {/* ── Price drivers ────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionLabel>What drives the price</SectionLabel>
          <ul className="space-y-2.5">
            {page.priceDrivers.map((d) => (
              <li key={d} className="flex gap-3 text-sm text-brand-muted leading-relaxed">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-amber mt-2 flex-shrink-0" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Red flags ────────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionLabel>Red flags in a quote</SectionLabel>
          <ul className="space-y-3">
            {page.redFlags.map((f) => (
              <li key={f} className="border-l-2 border-red-300 pl-4 text-sm text-brand-navy leading-relaxed">
                {f}
              </li>
            ))}
          </ul>
        </section>

        {/* ── Questions ────────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionLabel>Questions to ask before you sign</SectionLabel>
          <ol className="space-y-2.5">
            {page.questions.map((q, i) => (
              <li key={q} className="flex gap-3 text-sm text-brand-navy leading-relaxed">
                <span className="text-brand-amber-deep font-semibold tabular-nums w-5 flex-shrink-0">{i + 1}.</span>
                {q}
              </li>
            ))}
          </ol>
        </section>

        {/* ── Mid-page CTA ─────────────────────────────────────────────── */}
        <section className="mb-10 bg-white border border-brand-border rounded-2xl p-6 text-center">
          <p className="text-base font-semibold text-brand-navy mb-1.5">
            {page.flow === 'post' ? 'Get your actual quote checked' : 'Get your actual problem diagnosed'}
          </p>
          <p className="text-sm text-brand-muted mb-5 leading-relaxed">
            {page.flow === 'post'
              ? 'Upload a photo or PDF. We check every line against typical ranges for your area, flag padding and missing scope, and give you the exact questions and negotiation language to use.'
              : 'Describe what is happening. We explain the likely cause, how urgent it is, the fair cost range, and what to ask the contractor.'}
          </p>
          <LandingCta slug={page.slug} flow={page.flow} category={page.category} label={ctaLabel} size="md" />
          <p className="text-xs text-brand-muted mt-4">
            <Link href="/sample" className="font-semibold text-brand-amber-deep hover:text-brand-navy underline underline-offset-2">
              See a sample report
            </Link>
          </p>
        </section>

        {/* ── FAQ ──────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionLabel>Common questions</SectionLabel>
          <div className="space-y-6">
            {page.faqs.map(({ q, a }) => (
              <div key={q}>
                <h3 className="text-sm font-semibold text-brand-navy mb-1.5">{q}</h3>
                <p className="text-sm text-brand-muted leading-relaxed">{a}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Related ──────────────────────────────────────────────────── */}
        {others.length > 0 && (
          <section className="mb-10 border-t border-brand-border pt-8">
            <SectionLabel>Other quote checks</SectionLabel>
            <ul className="flex flex-wrap gap-2">
              {others.map((p) => (
                <li key={p.slug}>
                  <Link
                    href={`/check/${p.slug}`}
                    className="inline-block px-3 py-2 rounded-full border border-brand-border bg-white text-xs font-medium text-brand-navy hover:border-brand-border-dark"
                  >
                    {p.h1}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <p className="text-[11px] text-brand-muted leading-relaxed">
          General information, not professional advice. HomeReview AI takes no referral fees and has no
          contractor partnerships. Always confirm with a licensed professional before work begins.
        </p>
      </article>
    </main>
  )
}
