'use client'

import { useState } from 'react'
import { NavBar } from '@/components/ui/NavBar'
import { ChatInterface } from '@/components/ui/ChatInterface'
import type { ChatMessage, DiagnosticBriefReport } from '@/lib/types'

interface Props {
  report: DiagnosticBriefReport | undefined
  categoryLabel: string
  sessionId: string
  product: string
  paidAt: string
  initialChatMessages: ChatMessage[]
  reportFailed?: boolean
  reportError?: string
}

const DIY_CONFIG: Record<string, { bg: string; text: string }> = {
  None:   { bg: 'bg-red-50',     text: 'text-red-800' },
  Low:    { bg: 'bg-amber-50',   text: 'text-amber-800' },
  Medium: { bg: 'bg-blue-50',    text: 'text-blue-800' },
  High:   { bg: 'bg-emerald-50', text: 'text-emerald-800' },
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
          <span className={`w-1.5 h-1.5 rounded-full ${color} flex-shrink-0 mt-[7px]`} aria-hidden="true" />
          <span className="text-sm text-brand-muted leading-relaxed">{item}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Accordion row for contractor questions.
 * Question is always visible; whyItMatters is revealed on tap.
 * This reduces the visual density of 8 questions with explanations
 * from a wall of text to a scannable, interactive list.
 */
function QuestionRow({
  index,
  question,
  whyItMatters,
}: {
  index: number
  question: string
  whyItMatters: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <li className={index > 0 ? 'border-t border-brand-border pt-3' : ''}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full text-left flex items-start gap-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-amber"
        aria-expanded={open}
      >
        <span className="text-xs font-semibold text-brand-amber mt-0.5 w-5 flex-shrink-0 tabular-nums">
          {index + 1}.
        </span>
        <span className="text-sm font-semibold text-brand-navy leading-snug flex-1">
          {question}
        </span>
        <span
          className="text-brand-muted flex-shrink-0 mt-0.5 transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {open && (
        <p className="text-sm text-brand-muted leading-relaxed mt-2 ml-8">
          {whyItMatters}
        </p>
      )}
    </li>
  )
}

export function DiagnosticBrief({
  report,
  categoryLabel,
  sessionId,
  product,
  paidAt,
  initialChatMessages,
  reportFailed,
  reportError,
}: Props) {
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
              {!reportFailed && (
                <span className="text-[11px] font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                  Complete
                </span>
              )}
            </div>
            <p className="text-sm text-brand-muted">{categoryLabel} · Pre-quote analysis</p>
          </div>
          {!reportFailed && (
            <button
              onClick={handlePrint}
              className="text-xs text-brand-muted hover:text-brand-navy border border-brand-border rounded-lg px-3 py-2 print:hidden transition-colors"
              aria-label="Save as PDF"
            >
              Save PDF
            </button>
          )}
        </div>

        {/* Failed state */}
        {reportFailed && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-800 mb-1">Report generation failed</p>
            <p className="text-xs text-red-700 leading-relaxed">
              {reportError ?? 'We were unable to generate your report.'}
              {' '}Your payment has been processed. Please use the chat below, or email{' '}
              <a href="mailto:support@homereviewai.com" className="underline">
                support@homereviewai.com
              </a>.
            </p>
          </div>
        )}

        {/* Report sections */}
        {!reportFailed && report && (() => {
          const diy = DIY_CONFIG[report.diyFeasibility] ?? DIY_CONFIG.Medium
          return (
            <>
              <SectionCard title="1. Complete Diagnosis">
                <p className="text-sm text-brand-navy leading-relaxed">{report.diagnosis}</p>
              </SectionCard>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                <div className="card">
                  <p className="section-label">2. Urgency Timeline</p>
                  <p className="text-sm text-brand-muted leading-relaxed">{report.urgencyTimeline}</p>
                </div>
                <div className="card">
                  <p className="section-label">3. DIY Feasibility</p>
                  <span className={`inline-block text-xs font-semibold px-2.5 py-1.5 rounded-lg mb-2.5 ${diy.bg} ${diy.text}`}>
                    {report.diyFeasibility}
                  </span>
                  <p className="text-sm text-brand-muted leading-relaxed">{report.diyDetails}</p>
                </div>
              </div>

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

              <SectionCard title="5. Cost Preparation Guide">
                <p className="text-sm text-brand-muted mb-3">
                  Factors that drive cost variation for this type of work:
                </p>
                <BulletList items={report.costFactors} />
              </SectionCard>

              {/* Questions — accordion for scannability */}
              <SectionCard title="6. Questions to Ask Every Contractor">
                <p className="text-xs text-brand-muted mb-4">
                  Tap a question to see why it matters.
                </p>
                <ol className="space-y-3">
                  {report.questionsToAsk.map((q, i) => (
                    <QuestionRow
                      key={i}
                      index={i}
                      question={q.question}
                      whyItMatters={q.whyItMatters}
                    />
                  ))}
                </ol>
              </SectionCard>

              {/* Red flags and protections — distinct visual registers */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="card border-l-2 border-l-red-400">
                  <p className="section-label text-red-600">7. Hiring Red Flags</p>
                  <p className="text-xs text-brand-muted mb-3">Watch for these warning signs.</p>
                  <ul className="space-y-2">
                    {report.redFlags.map((flag, i) => (
                      <li key={i} className="flex gap-2 text-xs text-red-700 leading-relaxed">
                        <span className="flex-shrink-0 mt-0.5" aria-hidden="true">⚠</span>
                        <span>{flag}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="card border-l-2 border-l-emerald-500">
                  <p className="section-label text-emerald-700">8. Insist On in Writing</p>
                  <p className="text-xs text-brand-muted mb-3">Require these before work begins.</p>
                  <ul className="space-y-2">
                    {report.insistOnWriting.map((item, i) => (
                      <li key={i} className="flex gap-2 text-xs text-emerald-800 leading-relaxed">
                        <span className="flex-shrink-0 mt-0.5" aria-hidden="true">✓</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )
        })()}

        {/* Chat — activated state for paid users */}
        <div className="mt-5 border border-brand-navy rounded-xl overflow-hidden">
          <div className="bg-brand-navy px-5 py-3 flex items-center gap-2.5">
            <div className="w-2 h-2 rounded-full bg-brand-amber flex-shrink-0" aria-hidden="true" />
            <p className="text-sm font-semibold text-white">Your advisor is ready</p>
            <span className="ml-auto text-xs text-white opacity-60">Included with your report</span>
          </div>
          <div className="bg-white p-5">
            <ChatInterface
              sessionId={sessionId}
              product={product}
              paidAt={paidAt}
              initialMessages={initialChatMessages}
            />
          </div>
        </div>

        {/* Disclaimer */}
        {!reportFailed && (
          <div className="mt-4 p-3.5 bg-gray-50 border border-brand-border rounded-xl">
            <p className="text-[11px] text-brand-muted leading-relaxed">
              HomeReview AI provides informational analysis, not licensed professional advice.
              Consult a qualified professional before making repair decisions.
            </p>
          </div>
        )}
      </div>
    </main>
  )
}
