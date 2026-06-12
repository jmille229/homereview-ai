'use client'

import { useState } from 'react'
import { NavBar } from '@/components/ui/NavBar'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { ChatInterface } from '@/components/ui/ChatInterface'
import { AlertTriangleIcon, CheckIcon } from '@/components/ui/icons'
import type { ChatMessage, DiagnosticBriefReport } from '@/lib/types'
import { DisclaimerFooter } from '@/components/ui/DisclaimerFooter'

interface Props {
  report:              DiagnosticBriefReport | undefined
  categoryLabel:       string
  sessionId:           string
  product:             string
  paidAt:              string
  initialChatMessages: ChatMessage[]
  reportFailed?:       boolean
  reportError?:        string
  /** From preview — surfaced on the report so the user has the cost context */
  costMin?:            number
  costMax?:            number
  /** From preview — surfaced alongside the cost range for quick reference */
  severity?:           string
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
        className="w-full text-left flex items-start gap-3"
        aria-expanded={open}
      >
        <span className="text-xs font-semibold text-brand-amber-deep mt-0.5 w-5 flex-shrink-0 tabular-nums">
          {index + 1}.
        </span>
        <span className="text-sm font-semibold text-brand-navy leading-snug flex-1">
          {question}
        </span>
        <span
          className="text-brand-muted flex-shrink-0 mt-0.5 transition-transform duration-200 print:hidden"
          style={{ transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
          aria-hidden="true"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 5l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>
      {/* Collapsed answers still render in print — homeowners hand this PDF
          to contractors, so the "why it matters" context must survive export. */}
      <p className={`text-sm text-brand-muted leading-relaxed mt-2 ml-8 ${open ? '' : 'hidden print:block'}`}>
        {whyItMatters}
      </p>
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
  costMin,
  costMax,
  severity,
}: Props) {
  const handlePrint = () => window.print()

  return (
    <main className="min-h-screen bg-brand-bg print:bg-white">
      <NavBar />
      <div className="max-w-xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-6 pb-5 border-b border-brand-border">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-brand-amber-deep uppercase tracking-[0.06em] mb-1">
              Diagnostic Brief
            </p>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-navy mb-1 break-words">{categoryLabel}</h1>
            <div className="flex items-center gap-2">
              <p className="text-sm text-brand-muted">Pre-quote analysis</p>
              {!reportFailed && (
                <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded-md">
                  ✓ Complete
                </span>
              )}
            </div>
          </div>
          {!reportFailed && (
            <button
              onClick={handlePrint}
              className="text-xs text-brand-muted hover:text-brand-navy border border-brand-border rounded-lg px-3 py-2 print:hidden transition-colors flex-shrink-0"
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

              {/* Cost range + severity — passed from preview, always present */}
              {(costMin !== undefined && costMax !== undefined) && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
                  <div className="card">
                    <p className="section-label">Severity</p>
                    {severity && (
                      <SeverityBadge
                        severity={severity as import('@/lib/types').Severity}
                        className="mt-1"
                      />
                    )}
                  </div>
                  <div className="card">
                    <p className="section-label">Typical Cost Range</p>
                    <p className="text-2xl font-bold text-brand-navy mt-1 tabular-nums break-words">
                      ${costMin.toLocaleString()}–${costMax.toLocaleString()}
                    </p>
                    <p className="text-[11px] text-brand-muted mt-1">
                      For this type of issue in your area
                    </p>
                  </div>
                </div>
              )}

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
                <p className="text-xs text-brand-muted mb-4 print:hidden">
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
                        <AlertTriangleIcon size={13} className="flex-shrink-0 mt-0.5" />
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
                        <CheckIcon size={13} className="flex-shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          )
        })()}

        {/* Chat — activated state for paid users. Hidden in print: the PDF is
            the report artifact, an empty chat box adds nothing on paper. */}
        <div className="mt-5 border border-brand-navy rounded-xl overflow-hidden print:hidden">
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

        {/* How to return later */}
        <p className="text-[11px] text-brand-muted text-center mt-6 print:hidden">
          Closed this tab? Reopen your report anytime — go to{' '}
          <a href="/recover" className="underline font-semibold hover:text-brand-navy">My report</a>
          {' '}and enter your checkout email.
        </p>

        {/* Full legal disclaimer — always shown on report pages */}
        <DisclaimerFooter />
      </div>
    </main>
  )
}
