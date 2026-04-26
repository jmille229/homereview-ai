'use client'

import { NavBar } from '@/components/ui/NavBar'
import type { DiagnosticBriefReport } from '@/lib/types'

interface Props {
  report: DiagnosticBriefReport
  categoryLabel: string
}

const DIY_CONFIG: Record<string, { bg: string; text: string }> = {
  None:   { bg: 'bg-red-50',    text: 'text-red-800' },
  Low:    { bg: 'bg-amber-50',  text: 'text-amber-800' },
  Medium: { bg: 'bg-blue-50',   text: 'text-blue-800' },
  High:   { bg: 'bg-emerald-50',text: 'text-emerald-800' },
}

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card mb-2.5">
      <p className="section-label">{title}</p>
      {children}
    </div>
  )
}

function BulletList({ items, color = 'bg-brand-amber' }: { items: string[]; color?: string }) {
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2.5">
          <span
            className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0 mt-[7px]`}
            aria-hidden="true"
          />
          <span className="text-sm text-brand-muted leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}

export function DiagnosticBrief({ report, categoryLabel }: Props) {
  const diy = DIY_CONFIG[report.diyFeasibility] ?? DIY_CONFIG.Medium

  const handlePrint = () => window.print()

  return (
    <main className="min-h-screen bg-brand-bg print:bg-white">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar />

        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-xl font-semibold text-brand-navy">Diagnostic Brief</h1>
              <span className="text-[11px] font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                Complete
              </span>
            </div>
            <p className="text-sm text-brand-muted">{categoryLabel} · Pre-quote analysis</p>
          </div>
          <button
            onClick={handlePrint}
            className="text-xs text-brand-muted hover:text-brand-navy border border-brand-border rounded-lg px-3 py-2 print:hidden"
            aria-label="Save as PDF"
          >
            Save PDF
          </button>
        </div>

        {/* 1. Diagnosis */}
        <SectionCard title="1. Complete Diagnosis">
          <p className="text-sm text-brand-navy leading-relaxed">{report.diagnosis}</p>
        </SectionCard>

        {/* 2 & 3. Urgency + DIY */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
          <div className="card">
            <p className="section-label">2. Urgency Timeline</p>
            <p className="text-sm text-brand-muted leading-relaxed">{report.urgencyTimeline}</p>
          </div>
          <div className="card">
            <p className="section-label">3. DIY Feasibility</p>
            <span
              className={`inline-block text-xs font-semibold px-2.5 py-1.5 rounded-lg mb-2.5 ${diy.bg} ${diy.text}`}
            >
              {report.diyFeasibility}
            </span>
            <p className="text-sm text-brand-muted leading-relaxed">{report.diyDetails}</p>
          </div>
        </div>

        {/* 4. Who to hire */}
        <SectionCard title="4. Who to Hire">
          <div className="space-y-2.5 mb-4">
            <div>
              <span className="text-xs font-medium text-brand-navy">Contractor type: </span>
              <span className="text-sm text-brand-muted">{report.contractorType}</span>
            </div>
            <div>
              <span className="text-xs font-medium text-brand-navy">License required: </span>
              <span className="text-sm text-brand-muted">{report.licenseRequired}</span>
            </div>
          </div>
          <p className="text-xs font-semibold text-brand-navy mb-2">Verify these credentials:</p>
          <BulletList items={report.verifyCredentials} />
        </SectionCard>

        {/* 5. Cost preparation */}
        <SectionCard title="5. Cost Preparation Guide">
          <p className="text-sm text-brand-muted mb-3">
            Key factors that affect cost for this type of work:
          </p>
          <BulletList items={report.costFactors} />
        </SectionCard>

        {/* 6. Questions to ask */}
        <SectionCard title="6. Questions to Ask Every Contractor">
          <ol className="space-y-5">
            {report.questionsToAsk.map((q, i) => (
              <li
                key={i}
                className={`${i < report.questionsToAsk.length - 1 ? 'pb-5 border-b border-brand-border' : ''}`}
              >
                <p className="text-sm font-semibold text-brand-navy mb-1.5">
                  {i + 1}. {q.question}
                </p>
                <p className="text-sm text-brand-muted leading-relaxed">{q.whyItMatters}</p>
              </li>
            ))}
          </ol>
        </SectionCard>

        {/* 7 & 8. Red flags + insist on writing */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          <div className="card">
            <p className="section-label text-red-600">7. Hiring Red Flags</p>
            <ul className="space-y-2">
              {report.redFlags.map((flag, i) => (
                <li
                  key={i}
                  className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 leading-relaxed"
                >
                  {flag}
                </li>
              ))}
            </ul>
          </div>
          <div className="card">
            <p className="section-label text-emerald-700">8. Insist On in Writing</p>
            <ul className="space-y-2">
              {report.insistOnWriting.map((item, i) => (
                <li
                  key={i}
                  className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 leading-relaxed"
                >
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Disclaimer */}
        <div className="mt-4 p-3.5 bg-gray-50 border border-brand-border rounded-xl">
          <p className="text-[11px] text-brand-muted leading-relaxed">
            HomeReview AI provides informational analysis, not licensed professional advice.
            Consult a qualified professional before making repair decisions.
          </p>
        </div>
      </div>
    </main>
  )
}
