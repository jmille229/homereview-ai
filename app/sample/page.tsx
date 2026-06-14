import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { ChatIcon, DocumentIcon } from '@/components/ui/icons'

export const metadata = {
  title: 'Sample Quote Shield report — HomeReview AI',
  description: 'See exactly what a Quote Shield report looks like before you buy.',
}

// Representative (fictional) data so prospects can see the real format.
const SAMPLE = {
  category: 'HVAC (Heating, Cooling & Air Quality)',
  scopeVerdict: 'Partial Match',
  scopeAnalysis:
    'The quote proposes a full system replacement, but the described symptom (no cooling, ice on the lines) is consistent with a low-refrigerant condition that often stems from a repairable leak. A full replacement may be premature without a pressure test confirming compressor failure.',
  pricingVerdict: 'High End',
  pricingAnalysis:
    'At $8,900 for a 3-ton system, this sits 15–25% above the regional median for comparable equipment. The labor line ($2,400) is high for a standard changeout, and the quote bundles a premium thermostat that wasn’t requested.',
  fairMin: 6200,
  fairMax: 7600,
  upsells: [
    { item: 'Premium smart thermostat', amount: 450, reason: 'Added without request; a standard programmable unit performs identically for this setup.' },
    { item: 'Whole-home surge protector', amount: 380, reason: 'Reasonable add-on, but presented as required — it is optional.' },
  ],
  redFlags: [
    'Recommends replacement before any pressure test or leak search was performed.',
    'Quote is valid "today only" — a pressure tactic, not a real constraint.',
  ],
  greenFlags: [
    'Itemized labor and materials (most quotes are not).',
    'Manufacturer and model numbers are specified.',
  ],
  question: {
    q: 'Did you pressure-test the system and attempt a leak search before recommending full replacement?',
    good: 'Yes — here are the readings, and the compressor specifically failed because…',
    bad: 'Replacement is just the better long-term option (with no diagnostic basis given).',
  },
  beforeYouSign: [
    'Get the model numbers in writing and confirm the SEER rating matches the price.',
    'Require a written warranty on both parts and labor.',
    'Ask for the diagnostic findings that justify replacement over repair.',
  ],
}

function Banner() {
  return (
    <div className="bg-brand-navy rounded-xl p-5 mb-6 flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="text-sm font-bold text-white">This is a sample report</p>
        <p className="text-xs text-white opacity-70 mt-0.5 leading-relaxed">
          Your real Quote Shield is personalized to your actual quote, region, and situation.
        </p>
      </div>
      <Link href="/intake" className="text-xs font-semibold px-4 py-2 bg-brand-amber-deep text-white rounded-lg flex-shrink-0 whitespace-nowrap">
        Start free →
      </Link>
    </div>
  )
}

function Verdict({ label, tone }: { label: string; tone: 'good' | 'warn' | 'bad' }) {
  const cls = tone === 'good' ? 'bg-emerald-50 text-emerald-800'
    : tone === 'warn' ? 'bg-amber-50 text-amber-800'
    : 'bg-red-50 text-red-800'
  return <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${cls}`}>{label}</span>
}

export default function SamplePage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-xl mx-auto px-5 py-8">
        <Banner />

        {/* Header */}
        <div className="mb-4">
          <p className="text-[11px] font-semibold text-brand-amber-deep uppercase tracking-[0.06em] mb-1">Quote Shield</p>
          <h1 className="text-xl sm:text-2xl font-bold text-brand-navy break-words">{SAMPLE.category}</h1>
          <p className="text-sm text-brand-muted mt-1">Post-quote analysis · Sample</p>
        </div>

        {/* Scope */}
        <div className="card mb-2.5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="section-label mb-0">1. Scope Confirmation</p>
            <div className="flex-shrink-0"><Verdict label={SAMPLE.scopeVerdict} tone="warn" /></div>
          </div>
          <p className="text-sm text-brand-muted leading-relaxed">{SAMPLE.scopeAnalysis}</p>
        </div>

        {/* Pricing */}
        <div className="card mb-2.5">
          <div className="flex items-start justify-between gap-3 mb-3">
            <p className="section-label mb-0">2. Pricing Verdict</p>
            <div className="flex-shrink-0"><Verdict label={SAMPLE.pricingVerdict} tone="warn" /></div>
          </div>
          <p className="text-sm text-brand-muted leading-relaxed mb-3">{SAMPLE.pricingAnalysis}</p>
          <div className="inline-block px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider mb-0.5">Fair range</p>
            <p className="text-xl font-semibold text-blue-800 tabular-nums">${SAMPLE.fairMin.toLocaleString()}–${SAMPLE.fairMax.toLocaleString()}</p>
          </div>
        </div>

        {/* Upsells */}
        <div className="card mb-2.5">
          <p className="section-label mb-3">3. Upsell &amp; Padding Detection</p>
          <ul className="space-y-2">
            {SAMPLE.upsells.map((u) => (
              <li key={u.item} className="p-3 bg-red-50 border border-red-100 rounded-xl">
                <div className="flex items-start justify-between gap-2 mb-1">
                  <p className="text-xs font-semibold text-red-800 min-w-0 break-words">{u.item}</p>
                  <p className="text-xs font-semibold text-red-800 flex-shrink-0 tabular-nums">${u.amount}</p>
                </div>
                <p className="text-xs text-red-700 leading-relaxed">{u.reason}</p>
              </li>
            ))}
          </ul>
        </div>

        {/* Flags */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
          <div className="card">
            <p className="section-label text-red-600">4a. Red Flags</p>
            <ul className="space-y-2">
              {SAMPLE.redFlags.map((f) => (
                <li key={f} className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 leading-relaxed">{f}</li>
              ))}
            </ul>
          </div>
          <div className="card">
            <p className="section-label text-emerald-700">4b. Green Flags</p>
            <ul className="space-y-2">
              {SAMPLE.greenFlags.map((f) => (
                <li key={f} className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 leading-relaxed">{f}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Contractor question */}
        <div className="card mb-2.5">
          <p className="section-label mb-3">5. Questions for This Contractor</p>
          <p className="text-sm font-semibold text-brand-navy mb-3">1. {SAMPLE.question.q}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="p-3 bg-emerald-50 rounded-xl">
              <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">Good answer</p>
              <p className="text-xs text-emerald-800 leading-relaxed">{SAMPLE.question.good}</p>
            </div>
            <div className="p-3 bg-red-50 rounded-xl">
              <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1.5">Concerning</p>
              <p className="text-xs text-red-800 leading-relaxed">{SAMPLE.question.bad}</p>
            </div>
          </div>
        </div>

        {/* Before you sign */}
        <div className="card">
          <p className="section-label text-emerald-700">6. Before You Sign</p>
          <ul className="space-y-2">
            {SAMPLE.beforeYouSign.map((item) => (
              <li key={item} className="flex gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-[7px]" aria-hidden="true" />
                <span className="text-xs text-brand-muted leading-relaxed">{item}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Included note */}
        <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="card flex items-center gap-2.5">
            <ChatIcon size={18} className="text-brand-navy flex-shrink-0" />
            <p className="text-xs text-brand-muted leading-relaxed">Unlimited follow-up chat with your advisor</p>
          </div>
          <div className="card flex items-center gap-2.5">
            <DocumentIcon size={18} className="text-brand-navy flex-shrink-0" />
            <p className="text-xs text-brand-muted leading-relaxed">Living report — upload revised quotes for 60 days</p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-8 pt-6 border-t border-brand-border">
          <p className="text-sm text-brand-muted mb-4">Get this analysis for your own quote.</p>
          <Link href="/intake" className="btn-primary inline-block">Start your free preview →</Link>
          <p className="text-[11px] text-brand-muted mt-3">Free preview · No payment required to see it</p>
        </div>
      </div>
    </main>
  )
}
