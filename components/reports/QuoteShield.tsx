'use client'

import { useRef, useState } from 'react'
import { NavBar } from '@/components/ui/NavBar'
import { ChatInterface } from '@/components/ui/ChatInterface'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ALLOWED_MIME_TYPES, MAX_FILE_SIZE_BYTES, MAX_FILES_PER_REQUEST } from '@/lib/validators'
import type {
  ChatMessage,
  QuoteShieldReport,
  UpdateReportResponse,
  UploadedFile,
  UpdateType,
} from '@/lib/types'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  report: QuoteShieldReport
  categoryLabel: string
  sessionId: string
  paidAt: string
  createdAt: string
  daysRemaining: number
  updatesExpired: boolean
  product: string
  initialChatMessages: ChatMessage[]
}

// ─── Sub-types ────────────────────────────────────────────────────────────────

type Tab = 'report' | 'activity'

type AllowedMime = typeof ALLOWED_MIME_TYPES[number]

interface LocalFile {
  name: string
  type: AllowedMime
  size: number
  dataUrl: string
}

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
    { bg: 'bg-gray-100', text: 'text-gray-700' }

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
        <div className="flex items-center gap-2 flex-wrap">
          <p className="section-label mb-0">{title}</p>
          {updated && (
            <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
              Updated
            </span>
          )}
        </div>
        {badge}
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
}: Props) {
  const [report, setReport] = useState<QuoteShieldReport>(initialReport)
  const [tab, setTab] = useState<Tab>('report')
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

    if (files.length + selected.length > MAX_FILES_PER_REQUEST) {
      setFileError(`Maximum ${MAX_FILES_PER_REQUEST} files allowed.`)
      return
    }

    const validated: LocalFile[] = []
    for (const file of selected) {
      if (!ALLOWED_MIME_TYPES.includes(file.type as AllowedMime)) {
        setFileError('Only JPEG, PNG, WebP images and PDFs are accepted.')
        return
      }
      if (file.size > MAX_FILE_SIZE_BYTES) {
        setFileError(`"${file.name}" exceeds the 2MB limit.`)
        return
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('File read failed'))
        reader.readAsDataURL(file)
      })
      validated.push({ name: file.name, type: file.type as AllowedMime, size: file.size, dataUrl })
    }
    setFiles((prev) => [...prev, ...validated].slice(0, MAX_FILES_PER_REQUEST))
    if (fileRef.current) fileRef.current.value = ''
  }

  // ── Submit update ────────────────────────────────────────────────────────

  const handleUpdate = async () => {
    setUpdateError(null)
    setUpdating(true)

    const uploadedFiles: UploadedFile[] = files.map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      data: f.dataUrl.split(',')[1] ?? '',
    }))

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

      setReport((json as UpdateReportResponse).report)
      setShowUpdate(false)
      setFiles([])
      setNote('')
      setTab('activity')
    } catch {
      setUpdateError('Network error. Please try again.')
    } finally {
      setUpdating(false)
    }
  }

  const handlePrint = () => window.print()

  // ── Tab buttons ──────────────────────────────────────────────────────────

  const tabs: Array<{ id: Tab; label: string }> = [
    { id: 'report', label: 'Report' },
    { id: 'activity', label: `Activity (${report.updates?.length ?? 0})` },
  ]

  return (
    <main className="min-h-screen bg-brand-bg print:bg-white">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar />

        {/* Header */}
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <h1 className="text-xl font-semibold text-brand-navy">Quote Shield</h1>
              {!updatesExpired ? (
                <span className="text-[11px] font-medium px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-md">
                  Active · {daysRemaining}d remaining
                </span>
              ) : (
                <span className="text-[11px] font-medium px-2.5 py-1 bg-gray-100 text-gray-500 rounded-md">
                  Updates expired
                </span>
              )}
            </div>
            <p className="text-sm text-brand-muted">
              {categoryLabel} · Post-quote · Purchased {formatDate(paidAt)}
            </p>
          </div>
          <button
            onClick={handlePrint}
            className="text-xs text-brand-muted hover:text-brand-navy border border-brand-border rounded-lg px-3 py-2 print:hidden flex-shrink-0"
            aria-label="Save as PDF"
          >
            Save PDF
          </button>
        </div>

        {/* Update button */}
        {!updatesExpired && (
          <button
            onClick={() => setShowUpdate((v) => !v)}
            className="w-full mb-4 px-4 py-2.5 bg-white border border-dashed border-brand-border-dark rounded-xl
                       text-sm text-brand-muted hover:border-brand-navy transition-colors text-left
                       flex items-center justify-between print:hidden"
            aria-expanded={showUpdate}
          >
            <span>+ Add a quote, contract, or invoice to update this report</span>
            <span className="text-[11px] font-medium text-blue-600 flex-shrink-0 ml-3">
              Living report
            </span>
          </button>
        )}

        {/* Update panel */}
        {showUpdate && !updatesExpired && (
          <div className="card bg-blue-50 border-blue-200 mb-4 print:hidden">
            <p className="text-sm font-semibold text-brand-navy mb-1">Update your report</p>
            <p className="text-xs text-brand-muted mb-4">
              Each upload triggers a fresh AI analysis. Affected sections are updated and logged in Activity.
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
              <p className="text-xs text-brand-muted">Tap to upload (JPEG, PNG, PDF — max 2MB each)</p>
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
                disabled={updating || (files.length === 0 && !note.trim())}
                className="flex-1 btn-primary flex items-center justify-center gap-2 py-2.5"
              >
                {updating ? (
                  <><LoadingSpinner size={14} color="white" /><span>Updating report…</span></>
                ) : (
                  'Update my report'
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

        {/* Tabs */}
        <div className="flex mb-4 print:hidden" role="tablist">
          {tabs.map(({ id, label }, i) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`flex-1 py-2 text-sm transition-colors border ${
                i === 0 ? 'rounded-l-xl' : 'rounded-r-xl border-l-0'
              } ${
                tab === id
                  ? 'bg-brand-navy text-white border-brand-navy font-medium'
                  : 'bg-white text-brand-muted border-brand-border hover:border-brand-border-dark'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── REPORT TAB ─────────────────────────────────────────────────────── */}
        {tab === 'report' && (
          <div role="tabpanel" aria-label="Report">
            {/* 1. Scope */}
            <SectionCard title="1. Scope Confirmation" badge={<VerdictBadge verdict={report.scopeVerdict} type="scope" />}>
              <p className="text-sm text-brand-muted leading-relaxed">{report.scopeAnalysis}</p>
            </SectionCard>

            {/* 2. Pricing */}
            <SectionCard title="2. Pricing Verdict" badge={<VerdictBadge verdict={report.pricingVerdict} type="pricing" />}>
              <p className="text-sm text-brand-muted leading-relaxed mb-3">{report.pricingAnalysis}</p>
              <div className="inline-block px-4 py-2.5 bg-blue-50 border border-blue-200 rounded-xl">
                <p className="text-[10px] text-blue-600 font-semibold uppercase tracking-wider mb-0.5">Fair range</p>
                <p className="text-xl font-semibold text-blue-800">
                  ${report.estimatedFairMin.toLocaleString()}–${report.estimatedFairMax.toLocaleString()}
                </p>
              </div>
            </SectionCard>

            {/* 3. Upsells */}
            {report.upsells.length > 0 && (
              <SectionCard title="3. Upsell & Padding Detection">
                <ul className="space-y-2">
                  {report.upsells.map((u, i) => (
                    <li key={i} className="p-3 bg-red-50 border border-red-100 rounded-xl">
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs font-semibold text-red-800">{u.item}</p>
                        {u.amount > 0 && (
                          <p className="text-xs font-semibold text-red-800">${u.amount.toLocaleString()}</p>
                        )}
                      </div>
                      <p className="text-xs text-red-700 leading-relaxed">{u.reason}</p>
                    </li>
                  ))}
                </ul>
              </SectionCard>
            )}

            {/* 4. Missing scope */}
            {report.missingItems.length > 0 && (
              <SectionCard title="4. Missing Scope — Should Be in the Quote">
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

            {/* 5. Red & green flags */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-2.5">
              {report.redFlags.length > 0 && (
                <div className="card">
                  <p className="section-label text-red-600">5a. Red Flags</p>
                  <ul className="space-y-2">
                    {report.redFlags.map((f, i) => (
                      <li key={i} className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2 leading-relaxed">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {report.greenFlags.length > 0 && (
                <div className="card">
                  <p className="section-label text-emerald-700">5b. Green Flags</p>
                  <ul className="space-y-2">
                    {report.greenFlags.map((f, i) => (
                      <li key={i} className="text-xs text-emerald-800 bg-emerald-50 rounded-lg px-3 py-2 leading-relaxed">{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {/* 6. Negotiation guide */}
            <SectionCard title="6. Negotiation Guide">
              <p className="text-sm text-brand-muted leading-relaxed">{report.negotiationGuide}</p>
            </SectionCard>

            {/* 7. Contractor questions */}
            <SectionCard title={`7. ${report.contractorQuestions.length} Questions for This Contractor`}>
              <ol className="space-y-5">
                {report.contractorQuestions.map((q, i) => (
                  <li key={i} className={`${i < report.contractorQuestions.length - 1 ? 'pb-5 border-b border-brand-border' : ''}`}>
                    <p className="text-sm font-semibold text-brand-navy mb-3">{i + 1}. {q.question}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div className="p-3 bg-emerald-50 rounded-xl">
                        <p className="text-[10px] font-semibold text-emerald-700 uppercase tracking-wider mb-1.5">Good answer</p>
                        <p className="text-xs text-emerald-800 leading-relaxed">{q.goodAnswer}</p>
                      </div>
                      <div className="p-3 bg-red-50 rounded-xl">
                        <p className="text-[10px] font-semibold text-red-700 uppercase tracking-wider mb-1.5">Concerning</p>
                        <p className="text-xs text-red-800 leading-relaxed">{q.concerningAnswer}</p>
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            </SectionCard>

            {/* 8 & 9. Second quote + before you sign */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="card">
                <p className="section-label">8. Get a Second Quote?</p>
                <span className={`inline-block text-xs font-semibold px-2.5 py-1.5 rounded-lg mb-2.5 ${
                  report.getSecondQuote ? 'bg-amber-50 text-amber-800' : 'bg-emerald-50 text-emerald-800'
                }`}>
                  {report.getSecondQuote ? 'Recommended' : 'Not necessary'}
                </span>
                <p className="text-sm text-brand-muted leading-relaxed">{report.secondQuoteReason}</p>
              </div>
              <div className="card">
                <p className="section-label text-emerald-700">9. Before You Sign</p>
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
            <div className="mt-4 p-3.5 bg-gray-50 border border-brand-border rounded-xl">
              <p className="text-[11px] text-brand-muted leading-relaxed">
                HomeReview AI provides informational analysis, not licensed professional advice.
                This report is for guidance only and does not constitute legal or financial advice.
              </p>
            </div>
          </div>
        )}

        {/* ── ACTIVITY TAB ───────────────────────────────────────────────────── */}
        {tab === 'activity' && (
          <div role="tabpanel" aria-label="Activity timeline">
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
                  <div>
                    <div className="flex items-center gap-3 mb-1">
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
                    <div>
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <p className="text-sm font-semibold text-brand-navy">
                          {UPDATE_TYPE_LABELS[update.updateType]}
                        </p>
                        <span className="text-[10px] font-semibold px-2 py-0.5 bg-amber-50 text-amber-700 rounded">
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
                              className="text-[10px] px-2 py-0.5 bg-gray-100 text-brand-muted rounded"
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
      </div>
    </main>
  )
}
