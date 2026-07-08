'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { NavBar } from '@/components/ui/NavBar'
import { ChatInterface } from '@/components/ui/ChatInterface'
import { DisclaimerFooter } from '@/components/ui/DisclaimerFooter'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { SeverityBadge } from '@/components/ui/SeverityBadge'
import { QuoteComparison } from './QuoteComparison'
import { EmailedReportNote } from '@/components/ui/EmailedReportNote'
import type { Severity } from '@/lib/types'
import { ALLOWED_MIME_TYPES, MAX_FILES_PER_REQUEST } from '@/lib/validators'
import { readAndValidateFiles, toUploadedFiles, type LocalFile } from '@/lib/clientFiles'
import type {
  AnalyzedQuote,
  ChatMessage,
  QuoteComparison as QuoteComparisonData,
  QuoteShieldReport,
  UpdateReportResponse,
  UploadedFile,
  UpdateType,
} from '@/lib/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  report: QuoteShieldReport | undefined
  categoryLabel: string
  sessionId: string
  paidAt: string
  createdAt: string
  daysRemaining: number
  updatesExpired: boolean
  product: string
  initialChatMessages: ChatMessage[]
  reportFailed?: boolean
  reportError?: string
  /** Carried from the preview (single source of truth for severity). */
  severity?: string
  /** Multi-quote comparison set (present once ≥2 quotes have been analyzed). */
  quotes?: AnalyzedQuote[]
  comparison?: QuoteComparisonData
  /** True while a pre-purchase second-quote comparison is still generating. */
  comparisonPending?: boolean
  /** Read-only shared view: hides chat, uploads, tabs, and recovery. */
  readOnly?: boolean
  /** When present (owner view), shows a Share button that copies this link. */
  shareUrl?: string
  /** True when a report link was emailed (email configured + payer email on file). */
  emailedCopy?: boolean
}

// ─── Sub-types ────────────────────────────────────────────────────────────────

type Tab = 'report' | 'compare' | 'activity'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VERDICT_CONFIG = {
  scope: {
    'Matches Problem': { bg: 'bg-emerald-50', text: 'text-emerald-800' },
    'Partial Match':   { bg: 'bg-amber-50',   text: 'text-amber-800' },
    'Scope Mismatch':  { bg: 'bg-red-50',     text: 'text-red-800' },
  },
  pricing: {
    Fair:        { bg: 'bg-emerald-50', text: 'text-emerald-800' },
    'High End':  { bg: 'bg-amber-50',   text: 'text-amber-800' },
    Inflated:    { bg: 'bg-red-50',     text: 'text-red-800' },
  },
}

const UPDATE_TYPE_LABELS: Record<UpdateType, string> = {
  new_quote:      'New contractor quote',
  revised_quote:  'Revised quote (after negotiating)',
  contract:       'Signed contract',
  invoice:        'Final invoice',
  note:           'Note from contractor conversation',
  photo:          'Additional photos',
}

function VerdictBadge({ verdict, type }: { verdict: string; type: 'scope' | 'pricing' }) {
  const cfg =
    (type === 'scope'
      ? VERDICT_CONFIG.scope[verdict as keyof typeof VERDICT_CONFIG.scope]
      : VERDICT_CONFIG.pricing[verdict as keyof typeof VERDICT_CONFIG.pricing]) ??
    { bg: 'bg-brand-bg', text: 'text-brand-muted' }

  return (
    <span className={`text-xs font-semibold px-2.5 py-1.5 rounded-lg ${cfg.bg} ${cfg.text}`}>
      {verdict}
    </span>
  )
}

function SectionCard({ title, badge, updated, children }: {
  title: string
  badge?: React.ReactNode
  updated?: boolean
  children: React.ReactNode
}) {
  return (
    <div className="card mb-2.5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <p className="section-label mb-0 break-words">{title}</p>
          {updated && (
            <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
              Updated
            </span>
          )}
        </div>
        {badge && <div className="flex-shrink-0">{badge}</div>}
      </div>
      {children}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuoteShield({
  report: initialReport,
  categoryLabel,
  sessionId,
  paidAt,
  daysRemaining,
  updatesExpired,
  product,
  initialChatMessages,
  reportFailed,
  reportError,
  severity,
  quotes: initialQuotes,
  comparison: initialComparison,
  comparisonPending = false,
  readOnly = false,
  shareUrl,
  emailedCopy = false,
}: Props) {
  const router = useRouter()
  const [report, setReport] = useState<QuoteShieldReport | undefined>(initialReport)
  const [quotes, setQuotes] = useState<AnalyzedQuote[] | undefined>(initialQuotes)
  const [comparison, setComparison] = useState<QuoteComparisonData | undefined>(initialComparison)
  const [tab, setTab] = useState<Tab>('report')

  // Sync state when the server re-renders with freshly stored data (after a
  // router.refresh below picks up a background pre-purchase comparison, or the
  // report itself was still generating at first paint). useState seeds only
  // once, so without these effects a refresh would keep showing stale props. (#12)
  useEffect(() => {
    if (initialReport) setReport(initialReport)
  }, [initialReport])

  useEffect(() => {
    if (initialComparison && initialQuotes) {
      setComparison(initialComparison)
      setQuotes(initialQuotes)
    }
  }, [initialComparison, initialQuotes])

  const [comparePollExpired, setComparePollExpired] = useState(false)

  // A pre-purchase comparison runs in the background after the base report is
  // ready. Poll until it lands, then refresh to pull it into the page. Bounded
  // so a background timeout can't leave the spinner running forever.
  useEffect(() => {
    if (readOnly || comparison || !comparisonPending) return
    let active = true
    let tries = 0
    const MAX_TRIES = 40 // ~2 minutes at 3s
    const id = setInterval(async () => {
      tries += 1
      if (tries > MAX_TRIES) { active = false; clearInterval(id); setComparePollExpired(true); return }
      try {
        const res = await fetch(`/api/report/status/${sessionId}`)
        const json = await res.json()
        if (active && json?.comparisonPending === false) {
          active = false
          clearInterval(id)
          router.refresh()
        }
      } catch { /* transient — try again next tick */ }
    }, 3000)
    return () => { active = false; clearInterval(id) }
  }, [readOnly, comparison, comparisonPending, sessionId, router])
  const [copied, setCopied] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const [updateType, setUpdateType] = useState<UpdateType>('new_quote')
  const [files, setFiles] = useState<LocalFile[]>([])
  const [note, setNote] = useState('')
  const [fileError, setFileError] = useState<string | null>(null)
  const [updating, setUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  // ── File handling ────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const selected = Array.from(e.target.files ?? [])
    if (!selected.length) return

    const result = await readAndValidateFiles(selected, {
      existing:     files,
      maxCount:     MAX_FILES_PER_REQUEST,
      currentCount: files.length,
    })
    if (!result.ok) { setFileError(result.error); return }

    setFiles((prev) => [...prev, ...result.files].slice(0, MAX_FILES_PER_REQUEST))
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Submit update ────────────────────────────────────────────────────────

  const handleUpdate = async () => {
    setUpdateError(null)
    setUpdating(true)

    const uploadedFiles: UploadedFile[] = toUploadedFiles(files)

    try {
      const res = await fetch('/api/report', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, updateType, files: uploadedFiles, note: note || undefined }),
      })

      const json: UpdateReportResponse | { error: string } = await res.json()

      if (!res.ok || 'error' in json) {
        setUpdateError(('error' in json ? json.error : null) ?? 'Update failed. Please try again.')
        setUpdating(false)
        return
      }

      const resp = json as UpdateReportResponse
      setReport(resp.report)
      setShowUpdate(false)
      setFiles([])
      setNote('')
      // A new quote returns a comparison — surface it directly.
      if (resp.quotes && resp.comparison) {
        setQuotes(resp.quotes)
        setComparison(resp.comparison)
        setTab('compare')
      } else {
        setTab('activity')
      }
    } catch {
      setUpdateError('Network error. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const handlePrint = () => window.print()

  // ── Section numbering ────────────────────────────────────────────────────
  //
  // Upsells, missing-scope, and the flags pair are conditionally rendered.
  // Numbering is computed from what actually renders so a clean quote with no
  // upsells reads 1,2,3… instead of 1,2,4… (which looks like a rendering bug).
  const sections = report ? (() => {
    let n = 0
    const next = () => ++n
    return {
      scope:       next(),
      pricing:     next(),
      upsells:     report.upsells.length > 0 ? next() : 0,
      missing:     report.missingItems.length > 0 ? next() : 0,
      flags:       report.redFlags.length > 0 || report.greenFlags.length > 0 ? next() : 0,
      negotiation: next(),
      questions:   next(),
      secondQuote: next(),
      beforeSign:  next(),
    }
  })() : null
  const bothFlags = !!report && report.redFlags.length > 0 && report.greenFlags.length > 0

  // ── Tab buttons ──────────────────────────────────────────────────────────

  const hasComparison = !!comparison && !!quotes && quotes.length >= 2
  const comparePreparing = !hasComparison && comparisonPending && !readOnly
  const showCompareTab = hasComparison || comparePreparing
  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'report', label: 'Report' },
    ...(showCompareTab ? [{ id: 'compare' as Tab, label: hasComparison ? `Compare (${quotes!.length})` : 'Compare' }] : []),
    { id: 'activity', label: `Activity (${report?.updates?.length ?? 0})` },
  ]

  return (
    <main className="min-h-screen bg-brand-bg print:bg-white">
      <NavBar />
      <div className="max-w-xl mx-auto px-5 py-8">

        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-brand-amber-deep uppercase tracking-[0.06em] mb-1">
              Quote Shield
            </p>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl sm:text-2xl font-bold text-brand-navy break-words">{categoryLabel}</h1>
              {readOnly ? (
                <span className="text-[11px] font-medium px-2.5 py-1 bg-brand-bg text-brand-muted rounded-md">
                  Shared · read-only
                </span>
              ) : !updatesExpired ? (
                <span className="text-[11px] font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                  Active · {daysRemaining}d remaining
                </span>
              ) : (
                <span className="text-[11px] font-medium px-2.5 py-1 bg-brand-bg text-brand-muted rounded-md">
                  Updates expired
                </span>
              )}
            </div>
            <p className="text-sm text-brand-muted">
              Post-quote analysis · Purchased {formatDate(paidAt)}
            </p>
            {severity && (
              <div className="mt-2.5">
                <SeverityBadge severity={severity as Severity} />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0 print:hidden">
            {shareUrl && !readOnly && (
              <button
                onClick={() => { navigator.clipboard?.writeText(shareUrl); setCopied(true); setTimeout(() => setCopied(false), 2000) }}
                className="text-xs text-brand-muted hover:text-brand-navy border border-brand-border rounded-lg px-3 py-2"
              >
                {copied ? 'Copied!' : 'Share'}
              </button>
            )}
            <button
              onClick={handlePrint}
              className="text-xs text-brand-muted hover:text-brand-navy border border-brand-border rounded-lg px-3 py-2"
              aria-label="Save as PDF"
            >
              Save PDF
            </button>
          </div>
        </div>

        {/* Emailed-copy + spam reminder (owner view, when email is configured) */}
        {emailedCopy && !readOnly && <EmailedReportNote className="mb-4" />}

        {/* Update button — only when report exists and not failed */}
        {!updatesExpired && !reportFailed && report && !readOnly && (
          <button
            onClick={() => setShowUpdate((v) => !v)}
            className="w-full mb-4 px-4 py-2.5 bg-white border border-dashed border-brand-border-dark rounded-xl
                       text-sm text-brand-muted hover:border-brand-navy transition-colors text-left
                       flex items-center justify-between gap-3 print:hidden"
            aria-expanded={showUpdate}
          >
            <span className="min-w-0">+ Add a quote, contract, or invoice to update this report</span>
            <span className="text-[11px] font-medium text-blue-600 flex-shrink-0">
              Living report
            </span>
          </button>
        )}

        {/* Update panel */}
        {showUpdate && !updatesExpired && !reportFailed && report && !readOnly && (
          <div className="card bg-blue-50 border-blue-200 mb-4 print:hidden">
            <p className="text-sm font-semibold text-brand-navy mb-1">Update your report</p>
            <p className="text-xs text-brand-muted mb-4">
              {updateType === 'new_quote'
                ? 'Upload another contractor\'s quote for the same job and we\'ll compare them side-by-side — adjusted prices, scope gaps, and a best-value pick.'
                : 'Each upload triggers a fresh AI analysis. Affected sections are updated and logged in Activity.'}
            </p>

            {/* Update type */}
            <label className="section-label">What are you adding?</label>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {(Object.keys(UPDATE_TYPE_LABELS) as UpdateType[]).map((type) => (
                <button
                  key={type}
                  onClick={() => setUpdateType(type)}
                  className={`p-3 rounded-xl text-left text-xs border transition-colors ${
                    updateType === type
                      ? 'border-brand-navy bg-white text-brand-navy font-medium'
                      : 'border-brand-border bg-white text-brand-muted hover:border-brand-border-dark'
                  }`}
                >
                  {UPDATE_TYPE_LABELS[type]}
                </button>
              ))}
            </div>

            {/* File upload */}
            <label className="section-label">
              Upload files{' '}
              <span className="font-normal normal-case tracking-normal">(optional)</span>
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-brand-border-dark rounded-xl p-4 text-center
                         hover:bg-white transition-colors cursor-pointer mb-2"
            >
              <p className="text-xs text-brand-muted">Tap to upload (JPEG, PNG, PDF — max 3MB each, 3MB total)</p>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept={ALLOWED_MIME_TYPES.join(',')}
                onChange={handleFileChange}
                className="hidden"
                aria-hidden="true"
              />
            </button>

            {fileError && (
              <p role="alert" className="text-xs text-red-600 mb-2">{fileError}</p>
            )}

            {files.length > 0 && (
              <ul className="flex flex-wrap gap-2 mb-3">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-1.5 px-2.5 py-1.5 bg-white border border-brand-border rounded-md text-xs"
                  >
                    <span className="truncate max-w-[140px]">{f.name}</span>
                    <button
                      onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
                      aria-label={`Remove ${f.name}`}
                      className="text-brand-muted hover:text-brand-navy"
                    >×</button>
                  </li>
                ))}
              </ul>
            )}

            {/* Optional note */}
            {(updateType === 'note' || updateType === 'revised_quote') && (
              <div className="mb-3">
                <label className="section-label">Note (optional)</label>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, 2000))}
                  rows={3}
                  placeholder="e.g. The contractor called and said they'd drop to $2,900 if we decide by Friday."
                  className="input resize-none text-xs"
                />
              </div>
            )}

            {updateError && (
              <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">{updateError}</p>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={handleUpdate}
                disabled={
                  updating ||
                  (updateType === 'new_quote'
                    ? files.length === 0
                    : files.length === 0 && !note.trim())
                }
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5"
              >
                {updating ? (
                  <>
                    <LoadingSpinner size={14} color="white" />
                    <span>{updateType === 'new_quote' ? 'Comparing quotes…' : 'Updating report…'}</span>
                  </>
                ) : (
                  updateType === 'new_quote' ? 'Compare this quote' : 'Update my report'
                )}
              </button>
              <button
                onClick={() => { setShowUpdate(false); setFiles([]); setNote(''); setFileError(null) }}
                className="px-4 py-2.5 text-xs text-brand-muted border border-brand-border rounded-xl hover:border-brand-border-dark transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Failed state banner */}
        {reportFailed && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-sm font-semibold text-red-800 mb-1">Report generation failed</p>
            <p className="text-xs text-red-700 leading-relaxed">
              {reportError ?? 'We were unable to generate your report.'}
              {' '}Your payment has been processed. Please use the chat below,
              or email{' '}
              <a href="mailto:support@homereviewai.com" className="underline">
                support@homereviewai.com
              </a>.
            </p>
          </div>
        )}

        {/* Tabs — only shown when report is available */}
        {!reportFailed && report && !readOnly && (
          <div className="flex mb-4 print:hidden" role="tablist" aria-label="Report sections">
            {tabs.map(({ id, label }, i) => (
              <button
                key={id}
                id={`tab-${id}`}
                role="tab"
                aria-selected={tab === id}
                aria-controls={`panel-${id}`}
                tabIndex={tab === id ? 0 : -1}
                onClick={() => setTab(id)}
                onKeyDown={(e) => {
                  // Roving tabindex + arrow-key navigation per the WAI-ARIA tabs pattern.
                  let next = -1
                  if (e.key === 'ArrowRight') next = (i + 1) % tabs.length
                  else if (e.key === 'ArrowLeft') next = (i - 1 + tabs.length) % tabs.length
                  else if (e.key === 'Home') next = 0
                  else if (e.key === 'End') next = tabs.length - 1
                  if (next === -1) return
                  e.preventDefault()
                  setTab(tabs[next].id)
                  document.getElementById(`tab-${tabs[next].id}`)?.focus()
                }}
                className={`flex-1 py-2 text-sm transition-colors border ${
                  i === 0 ? 'rounded-l-xl' : 'border-l-0'
                } ${i === tabs.length - 1 ? 'rounded-r-xl' : ''} ${
                  tab === id
                    ? 'bg-brand-navy text-white border-brand-navy font-medium'
                    : 'bg-white text-brand-muted border-brand-border hover:border-brand-border-dark'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}

        {/* ── REPORT TAB ─────────────────────────────────────────────────────── */}
        {!reportFailed && tab === 'report' && report && sections && (
          <div role="tabpanel" id="panel-report" aria-labelledby="tab-report">
            {/* Scope */}
            <SectionCard title={`${sections.scope}. Scope Confirmation`} badge={<VerdictBadge verdict={report.scopeVerdict} type="scope" />}>
              <p className="text-sm text-brand-muted leading-relaxed">{report.scopeAnalysis}</p>
            </SectionCard>

            {/* Pricing */}
            <SectionCard title={`${sections.pricing}. Pricing Verdict`} badge={<VerdictBadge verdict={report.pricingVerdict} type="pricing" />}>
              <p className="text-sm text-brand-muted leading-relaxed mb-3">{report.pricingAnalysis}</p>
              <div className="inline-block px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-[11px] text-blue-700 font-semibold uppercase tracking-wider mb-0.5">Fair range</p>
                <p className="text-xl font-semibold text-blue-800">
                  ${report.estimatedFairMin.toLocaleString()}–${report.estimatedFairMax.toLocaleString()}
                </p>
              </div>
            </SectionCard>

            {/* Upsells */}
            {report.upsells.length > 0 && (
              <SectionCard title={`${sections.upsells}. Upsell & Padding Detection`}>
                <ul className="space-y-2">
                  {report.upsells.map((u, i) => (
                    <li key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-xs font-semibold text-red-800 min-w-0 break-words">{u.item}</p>
                        {u.amount > 0 && (
                          <p className="text-xs font-semibold text-red-800 flex-shrink-0 tabular-nums">${u.amount.toLocaleString()}</p>
                        )}
                      </div>
                      <p className="text-xs text-red-700 leading-relaxed break-words">{u.reason}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Missing scope */}
            {report.missingItems.length > 0 && (
              <SectionCard title={`${sections.missing}. Missing Scope — Should Be in the Quote`}>
                <ul className="space-y-2">
                  {report.missingItems.map((item, i) => (
                    <li key={i} className="flex gap-2.5">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0 mt-[7px]" aria-hidden="true" />
                      <span className="text-sm text-brand-muted leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* Red & green flags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
              {report.redFlags.length > 0 && (
                <div className="card">
                  <p className="section-label text-red-600">{`${sections.flags}${bothFlags ? 'a' : ''}. Red Flags`}</p>
                  <ul className="space-y-2">
                    {report.redFlags.map((f, i) => (
                      <li key={i} className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 leading-relaxed">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.greenFlags.length > 0 && (
                <div className="card">
                  <p className="section-label text-emerald-700">{`${sections.flags}${bothFlags ? 'b' : ''}. Green Flags`}</p>
                  <ul className="space-y-2">
                    {report.greenFlags.map((f, i) => (
                      <li key={i} className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 leading-relaxed">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* Negotiation guide */}
            <SectionCard title={`${sections.negotiation}. Negotiation Guide`}>
              <p className="text-sm text-brand-muted leading-relaxed">{report.negotiationGuide}</p>
            </SectionCard>

            {/* Contractor questions */}
            <SectionCard title={`${sections.questions}. ${report.contractorQuestions.length} Questions for This Contractor`}>
              <ol className="space-y-5">
                {report.contractorQuestions.map((q, i) => (
                  <li key={i} className={`${i < report.contractorQuestions.length - 1 ? 'pb-5 border-b border-brand-border' : ''}`}>
                    <p className="text-sm font-semibold text-brand-navy mb-3">{i + 1}. {q.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-3 bg-emerald-50 rounded-xl">
                        <p className="text-[11px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">Good answer</p>
                        <p className="text-xs text-emerald-800 leading-relaxed">{q.goodAnswer}</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-xl">
                        <p className="text-[11px] font-semibold text-red-700 uppercase tracking-wider mb-1.5">Concerning</p>
                        <p className="text-xs text-red-800 leading-relaxed">{q.concerningAnswer}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>

            {/* Second quote + before you sign */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="card">
                <p className="section-label">{sections.secondQuote}. Get a Second Quote?</p>
                <span className={`inline-block text-xs font-semibold px-2.5 py-1.5 rounded-lg mb-2.5 ${
                  report.getSecondQuote ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  {report.getSecondQuote ? 'Recommended' : 'Not necessary'}
                </span>
                <p className="text-sm text-brand-muted leading-relaxed">{report.secondQuoteReason}</p>
              </div>
              <div className="card">
                <p className="section-label text-emerald-700">{sections.beforeSign}. Before You Sign</p>
                <ul className="space-y-2">
                  {report.beforeYouSign.map((item, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 flex-shrink-0 mt-[7px]" aria-hidden="true" />
                      <span className="text-xs text-brand-muted leading-relaxed">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="mt-4 p-3.5 bg-white border border-brand-border rounded-xl">
              <p className="text-xs text-brand-muted leading-relaxed">
                HomeReview AI provides informational analysis, not licensed professional advice.
                This report is for guidance only and does not constitute legal or financial advice.
              </p>
            </div>
          </div>
        )}

        {/* ── COMPARE TAB ────────────────────────────────────────────────────── */}
        {!reportFailed && tab === 'compare' && (
          <div role="tabpanel" id="panel-compare" aria-labelledby="tab-compare">
        {hasComparison && (
          <QuoteComparison quotes={quotes!} comparison={comparison!} />
        )}
        {!hasComparison && comparePreparing && (
          comparePollExpired ? (
            <div className="card text-center py-10">
              <p className="text-sm font-semibold text-brand-navy mb-1">Your comparison is taking longer than usual</p>
              <p className="text-xs text-brand-muted leading-relaxed max-w-sm mx-auto mb-4">
                It should be ready shortly. Refresh to check — your second quote is safely on file.
              </p>
              <button
                onClick={() => router.refresh()}
                className="text-xs font-semibold text-brand-navy border border-brand-border rounded-lg px-4 py-2 hover:border-brand-border-dark transition-colors"
              >
                Refresh
              </button>
            </div>
          ) : (
            <div className="card text-center py-10" role="status">
              <LoadingSpinner size={24} color="#B8722E" className="mx-auto mb-4" />
              <p className="text-sm font-semibold text-brand-navy mb-1">Preparing your side-by-side…</p>
              <p className="text-xs text-brand-muted leading-relaxed max-w-sm mx-auto">
                We&apos;re comparing your two quotes — adjusted prices, scope gaps, red flags, and a
                best-value pick. This usually takes under a minute and will appear here automatically.
              </p>
            </div>
          )
        )}
          </div>
        )}

        {/* ── ACTIVITY TAB ───────────────────────────────────────────────────── */}
        {!reportFailed && tab === 'activity' && report && (
          <div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity">
            <div className="card">
              <p className="text-sm font-semibold text-brand-navy mb-5">Report Activity</p>
              <ol className="relative" aria-label="Report update history">
                {/* Initial creation */}
                <li className="flex gap-3 pb-6">
                  <div className="flex flex-col items-center flex-shrink-0">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 mt-1" />
                    {report.updates && report.updates.length > 0 && (
                      <div className="w-px flex-1 bg-brand-border mt-1.5" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1 flex-wrap">
                      <p className="text-sm font-semibold text-brand-navy">Report created</p>
                      <p className="text-xs text-brand-muted">{formatDate(report.updates?.[0] ? paidAt : paidAt)}</p>
                    </div>
                    <p className="text-xs text-brand-muted leading-relaxed">
                      Initial Quote Shield generated. Pricing verdict:{' '}
                      <strong className="text-brand-navy">{report.pricingVerdict}</strong>.{' '}
                      {report.upsells.length > 0
                        ? `${report.upsells.length} potential upsell(s) detected.`
                        : 'No upsells detected.'}
                    </p>
                  </div>
                </li>

                {/* Updates */}
                {report.updates?.map((update, i) => (
                  <li key={i} className={`flex gap-3 ${i < report.updates!.length - 1 ? 'pb-6' : ''}`}>
                    <div className="flex flex-col items-center flex-shrink-0">
                      <div className="w-2 h-2 rounded-full bg-amber-400 mt-1" />
                      {i < report.updates!.length - 1 && (
                        <div className="w-px flex-1 bg-brand-border mt-1.5" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-brand-navy">
                          {UPDATE_TYPE_LABELS[update.updateType]}
                        </p>
                        <span className="text-[11px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
                          Report updated
                        </span>
                        <p className="text-xs text-brand-muted ml-auto">{formatDate(update.timestamp)}</p>
                      </div>
                      <p className="text-xs text-brand-muted leading-relaxed mb-2">{update.summary}</p>
                      {update.changedSections.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {update.changedSections.map((s) => (
                            <span
                              key={s}
                              className="text-[11px] px-2 py-0.5 bg-brand-bg text-brand-muted rounded"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                ))}

                {/* Next steps prompt */}
                {!updatesExpired && (
                  <li className="flex gap-3 pt-1">
                    <div className="w-2 h-2 rounded-full border border-dashed border-brand-border mt-1 flex-shrink-0" />
                    <div>
                      <p className="text-xs text-brand-muted mb-2">What would update your report?</p>
                      <div className="flex flex-wrap gap-2">
                        {(['new_quote', 'revised_quote', 'contract', 'invoice'] as UpdateType[]).map((type) => (
                          <button
                            key={type}
                            onClick={() => { setUpdateType(type); setShowUpdate(true); setTab('report') }}
                            className="text-[11px] px-2.5 py-1 border border-dashed border-brand-border text-brand-muted rounded-lg hover:border-brand-border-dark transition-colors"
                          >
                            {UPDATE_TYPE_LABELS[type]}
                          </button>
                        ))}
                      </div>
                    </div>
                  </li>
                )}
              </ol>
            </div>
          </div>
        )}
        {/* Chat — activated state signals ongoing support, not an appended feature.
            Hidden in print and on shared read-only views. */}
        {!readOnly && (
          <div className="mt-5 border border-brand-navy rounded-xl overflow-hidden print:hidden">
            <div className="bg-brand-navy px-5 py-3 flex items-center gap-2.5">
              <div className="w-2 h-2 rounded-full bg-brand-amber flex-shrink-0" aria-hidden="true" />
              <p className="text-sm font-semibold text-white">Your advisor is ready</p>
              <span className="ml-auto text-xs text-white opacity-60">60 days included</span>
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
        )}

        {/* How to return later */}
        {!readOnly && (
          <p className="text-[11px] text-brand-muted text-center mt-6 print:hidden">
            Closed this tab? Reopen your report (and keep uploading quotes) anytime — go to{' '}
            <a href="/recover" className="underline font-semibold hover:text-brand-navy">My report</a>
            {' '}and enter your checkout email.
          </p>
        )}

        {/* Shared read-only footer CTA */}
        {readOnly && (
          <p className="text-[11px] text-brand-muted text-center mt-6">
            Shared via HomeReview AI · <a href="/" className="underline font-semibold hover:text-brand-navy">Get your own report</a>
          </p>
        )}

        {/* Full legal disclaimer — always shown on report pages */}
        <DisclaimerFooter />
      </div>
    </main>
  )
}