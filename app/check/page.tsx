import Link from 'next/link'
import type { Metadata } from 'next'
import { NavBar } from '@/components/ui/NavBar'
import { JsonLd } from '@/components/seo/JsonLd'
import { LANDING_PAGES } from '@/lib/landing'
import { breadcrumbJsonLd } from '@/lib/structuredData'

export const metadata: Metadata = {
  title:       'Is My Contractor Quote Fair? Quote Checks by Trade | HomeReview AI',
  description: 'Typical prices, red flags, and questions to ask for HVAC, roofing, water heater and other contractor quotes, from an advisor with no contractor ties.',
  alternates:  { canonical: '/check' },
}

export default function CheckIndexPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <JsonLd data={breadcrumbJsonLd([['Home', '/'], ['Quote checks', '/check']])} />
      <NavBar variant="site" />
      <div className="max-w-2xl mx-auto px-5 py-8">
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-brand-amber" aria-hidden="true" />
            <span className="text-xs font-semibold text-brand-amber-deep tracking-[0.08em]">QUOTE CHECKS</span>
          </div>
          <h1 className="text-3xl font-semibold text-brand-navy leading-tight mb-4">Is my contractor quote fair?</h1>
          <p className="text-base text-brand-muted leading-relaxed">
            What common jobs typically cost, the red flags that signal padding, and the questions to ask
            before you sign. Pick your trade.
          </p>
        </div>
        <ul className="space-y-3">
          {LANDING_PAGES.map((p) => (
            <li key={p.slug}>
              <Link
                href={`/check/${p.slug}`}
                className="block bg-white border border-brand-border rounded-2xl p-5 hover:border-brand-border-dark transition-colors"
              >
                <p className="text-base font-semibold text-brand-navy mb-1">{p.h1}</p>
                <p className="text-sm text-brand-muted leading-relaxed">{p.metaDescription}</p>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
