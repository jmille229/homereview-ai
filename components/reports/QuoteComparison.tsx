'use client'

import { useState } from 'react'
import type { AnalyzedQuote, QuoteComparison as Comparison } from '@/lib/types'

interface Props {
  quotes: AnalyzedQuote[]
  comparison: Comparison
}

// ─── Verdict colors ─────────────────────────────────────────────────────────────

const GOOD = 'bg-emerald-50 text-emerald-800'
const MID  = 'bg-amber-50 text-amber-800'
const BAD  = 'bg-red-50 text-red-800'

function verdictClass(value: string): string {
  switch (value) {
    case 'Fair':
    case 'Matches Problem':
    case 'Sound':
      return GOOD
    case 'High End':
    case 'Partial Match':
    case 'Questionable':
      return MID
    case 'Inflated':
    case 'Scope Mismatch':
    case 'Unsupported':
      return BAD
    default:
      return 'bg-brand-bg text-brand-muted'
  }
}

const money = (n?: number) => (typeof n === 'number' ? `$${n.toLocaleString()}` : '—')

function Pill({ value }: { value: string }) {
  return (
    <span className={`inline-block text-[11px] font-semibold px-2 py-1 rounded-md ${verdictClass(value)}`}>
      {value}
    </span>
  )
}

// ─── Matrix row helper ──────────────────────────────────────────────────────────

function Row({
  label,
  quotes,
  render,
}: {
  label: string
  quotes: AnalyzedQuote[]
  render: (q: AnalyzedQuote) => React.ReactNode
}) {
  return (
    <tr className="border-t border-brand-border align-top">
      <th
        scope="row"
        className="sticky left-0 z-10 bg-brand-bg text-left text-[11px] font-semibold text-brand-muted uppercase tracking-[0.04em] py-3 pr-3 pl-3 min-w-[120px]"
      >
        {label}
      </th>
      {quotes.map((q) => (
        <td key={q.id} className="py-3 px-3 text-sm text-brand-navy min-w-[150px]">
          {render(q)}
        </td>
      ))}
    </tr>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────

export function QuoteComparison({ quotes, comparison }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const recommended = quotes.find((q) => q.id === comparison.recommendedQuoteId)

  const list = (items: string[], tone: 'muted' | 'red' | 'emerald' = 'muted') =>
    items.length === 0 ? (
      <span className="text-xs text-brand-muted">—</span>
    ) : (
      <ul className="space-y-1.5">
        {items.map((it, i) => (
          <li
            key={i}
            className={`text-xs leading-relaxed ${
              tone === 'red' ? 'text-red-700' : tone === 'emerald' ? 'text-emerald-800' : 'text-brand-muted'
            }`}
          >
            {it}
          </li>
        ))}
      </ul>
    )

  return (
    <div role="tabpanel" aria-label="Quote comparison">
      {/* Recommendation header */}
      {recommended && (
        <div className="card border-emerald-200 bg-emerald-50 mb-2.5">
          <div className="flex items-center gap-2 mb-1.5 flex-wrap">
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-emerald-600 text-white rounded uppercase tracking-wide">
              Best value
            </span>
            <p className="text-sm font-bold text-emerald-900 break-words">{recommended.label}</p>
            {typeof recommended.adjustedTotal === 'number' && (
              <span className="text-xs text-emerald-800">
                adjusted {money(recommended.adjustedTotal)}
              </span>
            )}
          </div>
          <p className="text-sm text-emerald-900 leading-relaxed">{comparison.recommendationReason}</p>
        </div>
      )}

      {/* Comparison matrix */}
      <div className="card mb-2.5 overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-brand-bg text-left text-[11px] font-semibold text-brand-muted uppercase tracking-[0.04em] py-3 pl-3 pr-3 min-w-[120px]" />
              {quotes.map((q) => {
                const isRec = q.id === comparison.recommendedQuoteId
                return (
                  <th key={q.id} scope="col" className="py-3 px-3 text-left min-w-[150px]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-sm font-bold text-brand-navy break-words">{q.label}</span>
                      {isRec && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 bg-emerald-600 text-white rounded">
                          Pick
                        </span>
                      )}
                    </div>
                    {q.contractorName && q.contractorName !== q.label && (
                      <p className="text-[11px] text-brand-muted font-normal mt-0.5 break-words">{q.contractorName}</p>
                    )}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            <Row label="Quoted total" quotes={quotes} render={(q) => (
              <span className="font-semibold tabular-nums">{money(q.quotedTotal)}</span>
            )} />
            <Row label="Adjusted (apples-to-apples)" quotes={quotes} render={(q) => (
              <span className="font-semibold tabular-nums text-brand-navy">{money(q.adjustedTotal)}</span>
            )} />
            <Row label="Pricing" quotes={quotes} render={(q) => <Pill value={q.pricingVerdict} />} />
            <Row label="Fair range" quotes={quotes} render={(q) => (
              <span className="text-xs text-brand-muted tabular-nums">{money(q.fairMin)}–{money(q.fairMax)}</span>
            )} />
            <Row label="Scope" quotes={quotes} render={(q) => <Pill value={q.scopeVerdict} />} />
            <Row label="Diagnosis" quotes={quotes} render={(q) => <Pill value={q.diagnosisVerdict} />} />
            <Row label="Warranty" quotes={quotes} render={(q) => (
              <span className="text-xs text-brand-muted">{q.warranty || '—'}</span>
            )} />
            <Row label="Timeline" quotes={quotes} render={(q) => (
              <span className="text-xs text-brand-muted">{q.timeline || '—'}</span>
            )} />
            <Row label="Red flags" quotes={quotes} render={(q) => (
              q.redFlags.length === 0
                ? <span className="text-xs text-emerald-700 font-medium">None</span>
                : <span className="text-xs font-semibold text-red-700">{q.redFlags.length}</span>
            )} />
            <Row label="Missing scope" quotes={quotes} render={(q) => (
              q.missingItems.length === 0
                ? <span className="text-xs text-emerald-700 font-medium">Complete</span>
                : <span className="text-xs font-semibold text-amber-700">{q.missingItems.length} item(s)</span>
            )} />
          </tbody>
        </table>
      </div>

      {/* Negotiation leverage */}
      {comparison.negotiationLeverage.length > 0 && (
        <div className="card mb-2.5">
          <p className="section-label">Negotiation Leverage</p>
          <ul className="space-y-2">
            {comparison.negotiationLeverage.map((it, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-amber-deep flex-shrink-0 mt-[7px]" aria-hidden="true" />
                <span className="text-sm text-brand-muted leading-relaxed">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Key differences */}
      {comparison.keyDifferences.length > 0 && (
        <div className="card mb-2.5">
          <p className="section-label">What Actually Differs</p>
          <ul className="space-y-2">
            {comparison.keyDifferences.map((it, i) => (
              <li key={i} className="flex gap-2.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-border-dark flex-shrink-0 mt-[7px]" aria-hidden="true" />
                <span className="text-sm text-brand-muted leading-relaxed">{it}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Per-quote drill-down */}
      <div className="card">
        <p className="section-label mb-3">Quote Details</p>
        <div className="space-y-2">
          {quotes.map((q) => {
            const open = openId === q.id
            return (
              <div key={q.id} className="border border-brand-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setOpenId(open ? null : q.id)}
                  aria-expanded={open}
                  className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left hover:bg-brand-bg transition-colors"
                >
                  <span className="min-w-0">
                    <span className="text-sm font-semibold text-brand-navy break-words">{q.label}</span>
                    <span className="text-xs text-brand-muted ml-2 tabular-nums">{money(q.quotedTotal)}</span>
                  </span>
                  <span className="text-brand-muted flex-shrink-0 text-xs">{open ? '▲' : '▼'}</span>
                </button>
                {open && (
                  <div className="px-4 pb-4 pt-1 border-t border-brand-border">
                    <p className="text-sm text-brand-muted leading-relaxed mb-3">{q.summary}</p>
                    <div className="grid sm:grid-cols-2 gap-x-4 gap-y-3">
                      <div>
                        <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Included</p>
                        {list(q.includedItems, 'emerald')}
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold text-amber-700 uppercase tracking-wide mb-1.5">Missing scope</p>
                        {list(q.missingItems)}
                      </div>
                      {q.upsells.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1.5">Upsells / padding</p>
                          <ul className="space-y-1.5">
                            {q.upsells.map((u, i) => (
                              <li key={i} className="text-xs text-red-700 leading-relaxed">
                                <span className="font-semibold">{u.item}</span>
                                {u.amount > 0 && <span className="tabular-nums"> · {money(u.amount)}</span>}
                                <span className="block text-red-600">{u.reason}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {q.redFlags.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1.5">Red flags</p>
                          {list(q.redFlags, 'red')}
                        </div>
                      )}
                      {q.greenFlags.length > 0 && (
                        <div>
                          <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Green flags</p>
                          {list(q.greenFlags, 'emerald')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-[11px] text-brand-muted text-center mt-4">
        Comparison is informational guidance, not licensed professional advice. Adjusted prices
        normalize for scope differences and are estimates.
      </p>
    </div>
  )
}
