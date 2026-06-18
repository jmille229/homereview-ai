'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import {
  CATEGORY_IDS,
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  MAX_TOTAL_UPLOAD_BYTES,
  ALLOWED_MIME_TYPES,
} from '@/lib/validators'
import { CATEGORY_LABELS } from '@/lib/constants'
import type { Flow, UploadedFile } from '@/lib/types'
import { savePendingFiles } from '@/lib/pendingFiles'
import { Button } from '@/components/ui/Button'
import { TurnstileGate, turnstileRequired } from '@/components/ui/TurnstileGate'
import {
  CATEGORY_ICONS,
  AlertTriangleIcon,
  ClipboardIcon,
  PaperclipIcon,
  PlusIcon,
  SearchIcon,
} from '@/components/ui/icons'

type AllowedMime = typeof ALLOWED_MIME_TYPES[number]

interface LocalFile {
  name: string; type: AllowedMime; size: number; dataUrl: string
}

const FLOW_OPTIONS: Array<{
  value: Flow; Icon: typeof SearchIcon; title: string; sub: string
}> = [
  {
    value: 'pre',
    Icon:  SearchIcon,
    title: 'I have a home problem',
    sub:   "I haven't contacted a contractor yet",
  },
  {
    value: 'post',
    Icon:  ClipboardIcon,
    title: 'I have a quote to evaluate',
    sub:   'I want to know if it\'s fair',
  },
]


// ─── File upload area ─────────────────────────────────────────────────────────
//
// Defined at module scope — not inside IntakePage — so React never recreates
// the component type on re-render. Recreating a component type inside a parent
// causes React to unmount and remount, resetting the file input ref.

interface FileUploadAreaProps {
  prominent?:      boolean
  fileRef:         { current: HTMLInputElement | null }
  files:           LocalFile[]
  fileError:       string | null
  onFileChange:    (e: React.ChangeEvent<HTMLInputElement>) => void
  onRemoveFile:    (i: number) => void
}

function FileUploadArea({
  prominent,
  fileRef,
  files,
  fileError,
  onFileChange,
  onRemoveFile,
}: FileUploadAreaProps) {
  return (
    <div>
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className={`w-full rounded-xl text-center transition-all cursor-pointer ${
          prominent
            ? 'border-2 border-dashed border-brand-navy border-opacity-40 p-6 hover:border-opacity-70 hover:bg-white'
            : 'border border-dashed border-brand-border p-4 hover:bg-white hover:border-brand-border-dark'
        }`}
        aria-label="Upload files"
      >
        <div className="flex flex-col items-center gap-1.5">
          {prominent
            ? <PaperclipIcon size={20} className="text-brand-navy" />
            : <PlusIcon size={18} className="text-brand-muted" />}
          {prominent ? (
            <>
              <p className="text-sm font-semibold text-brand-navy">Upload the contractor quote</p>
              <p className="text-xs text-brand-muted">PDF or photo — enables line-by-line analysis</p>
            </>
          ) : (
            <>
              <p className="text-xs font-medium text-brand-navy">Add photos or documents</p>
              <p className="text-[11px] text-brand-muted">Photos of damage, service records</p>
            </>
          )}
          <p className="text-[11px] text-brand-muted mt-1">
            JPEG · PNG · WebP · PDF · Max 3MB each · 3MB total
          </p>
        </div>
        <input
          ref={fileRef}
          type="file"
          multiple
          accept={ALLOWED_MIME_TYPES.join(',')}
          onChange={onFileChange}
          className="hidden"
          aria-hidden="true"
        />
      </button>

      {fileError && <p role="alert" className="text-xs text-red-600 mt-2">{fileError}</p>}

      {files.length > 0 && (
        <ul className="flex flex-wrap gap-2 mt-3" aria-label="Uploaded files">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-brand-border rounded-full text-xs text-brand-navy">
              <span className="truncate max-w-[140px]">{f.name}</span>
              <button
                type="button"
                onClick={() => onRemoveFile(i)}
                aria-label={`Remove ${f.name}`}
                className="text-brand-muted hover:text-red-500 transition-colors p-1.5 -m-1"
              >×</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function IntakePage() {
  const router = useRouter()
  const {
    flow, category, relatedAreas, description, zip,
    setFlow, setCategory, toggleRelatedArea, setDescription, setZip, setQuestions,
  } = useSessionStore()

  const [files, setFiles]                     = useState<LocalFile[]>([])
  const [fileError, setFileError]             = useState<string | null>(null)
  const [submitError, setSubmitError]         = useState<string | null>(null)
  const [submitting, setSubmitting]           = useState(false)
  const [descriptionTouched, setDescTouched] = useState(false)
  // When the flow was already chosen (homepage CTA), show a compact confirmed
  // row instead of re-asking the same question — the user can still change it.
  const [pickerExpanded, setPickerExpanded]   = useState(false)
  // Cloudflare Turnstile token (only when the bot gate is configured).
  const [gateToken, setGateToken]             = useState<string | null>(null)
  // Quote Shield (post flow) with no uploaded quote — show a steering notice.
  const [showQuoteWarning, setShowQuoteWarning] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const gateRequired = turnstileRequired()

  const showFlowPicker = !flow || pickerExpanded
  const selectedFlow   = FLOW_OPTIONS.find(o => o.value === flow)

  // ── File handling ─────────────────────────────────────────────────────────

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
        setFileError(`"${file.name}" exceeds the ${Math.round(MAX_FILE_SIZE_BYTES / 1024 / 1024)}MB per-file limit.`)
        return
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('File read failed'))
        reader.readAsDataURL(file)
      })
      validated.push({ name: file.name, type: file.type as AllowedMime, size: file.size, dataUrl })
    }
    const totalBytes = [...files, ...validated].reduce((sum, f) => sum + f.size, 0)
    if (totalBytes > MAX_TOTAL_UPLOAD_BYTES) {
      setFileError(`Combined size must be under ${Math.round(MAX_TOTAL_UPLOAD_BYTES / 1024 / 1024)}MB. Try removing a file or using smaller scans.`)
      return
    }
    setFiles(prev => [...prev, ...validated].slice(0, MAX_FILES_PER_REQUEST))
    if (validated.length > 0) setShowQuoteWarning(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeFile = (i: number) => setFiles(prev => prev.filter((_, j) => j !== i))

  // ── Submit ────────────────────────────────────────────────────────────────

  // Switch this session to the pre-quote product (Diagnostic Brief) and reset
  // the user to the top so they re-orient to the changed form.
  const switchToBrief = () => {
    setShowQuoteWarning(false)
    setFlow('pre')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleSubmit = async (opts?: { bypassQuote?: boolean }) => {
    if (!flow) { setSubmitError('Please select where you are in the process.'); return }
    if (!category) { setSubmitError('Please select the area of your home.'); return }
    if (description.trim().length < 20) { setSubmitError('Please describe the situation in a bit more detail.'); return }
    // Catch partial zips here — otherwise the server rejects them at the END of
    // the flow (after the user has answered questions), which is far worse UX.
    if (zip.length > 0 && zip.length < 5) { setSubmitError('Please enter all 5 digits of your zip code, or leave it blank.'); return }

    // Quote Shield is built around a real quote — steer no-quote users before
    // anything else. They can upload, switch to Diagnostic Brief, or knowingly
    // continue (Quote Shield also supports a text-only / verbal quote).
    if (flow === 'post' && files.length === 0 && !opts?.bypassQuote) {
      setSubmitError(null)
      setShowQuoteWarning(true)
      return
    }

    if (gateRequired && !gateToken) { setSubmitError('Please complete the verification below to continue.'); return }

    setShowQuoteWarning(false)
    setSubmitError(null)
    setSubmitting(true)

    // Exchange the Turnstile token for a short-lived preview pass before the
    // questions page fires its AI call. Skipped entirely when the gate is off.
    if (gateRequired && gateToken) {
      try {
        const res = await fetch('/api/gate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token: gateToken }),
        })
        if (!res.ok) {
          setSubmitError('Verification failed. Please try the checkbox again.')
          setGateToken(null)
          setSubmitting(false)
          return
        }
      } catch {
        setSubmitError('Network error during verification. Please try again.')
        setSubmitting(false)
        return
      }
    }

    savePendingFiles(files.map(f => ({
      name: f.name, type: f.type, size: f.size,
      data: f.dataUrl.split(',')[1] ?? '',
    }) as UploadedFile))
    setQuestions([])
    router.push('/questions')
  }

  const zipValid  = zip.length === 0 || zip.length === 5
  const canSubmit = !!flow && !!category && description.trim().length >= 20 && zipValid
    && (!gateRequired || !!gateToken) && !submitting

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-bg">
      <NavBar step="Step 1 of 3" onBack={() => router.push('/')} />

      <div className="max-w-xl mx-auto px-5 pt-8 pb-12">
        <ProgressBar step={1} total={3} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-brand-navy mb-2">
            Tell us what&apos;s going on.
          </h1>
          <p className="text-sm text-brand-muted leading-relaxed">
            The more specific you are, the more useful your free preview will be.
          </p>
        </div>

        {/* ── Step 1: Where are you in the process? ────────────────────── */}
        <div className="mb-7">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3">
            Where are you right now?
          </p>

          {/* Already chosen on the homepage — confirm, don't re-ask */}
          {!showFlowPicker && selectedFlow ? (
            <div className="flex items-center justify-between gap-3 p-4 bg-white border border-brand-navy rounded-xl shadow-sm">
              <div className="flex items-center gap-2.5 min-w-0">
                <selectedFlow.Icon size={18} className="text-brand-navy flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-brand-navy leading-tight">{selectedFlow.title}</p>
                  <p className="text-xs text-brand-muted mt-0.5">{selectedFlow.sub}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPickerExpanded(true)}
                className="text-xs font-semibold text-brand-amber-deep hover:text-brand-navy transition-colors flex-shrink-0"
              >
                Change
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {FLOW_OPTIONS.map(({ value, Icon, title, sub }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setFlow(value)}
                  aria-pressed={flow === value}
                  className={`p-4 rounded-xl border text-left transition-all duration-150 ${
                    flow === value
                      ? 'border-brand-navy bg-white shadow-sm'
                      : 'border-brand-border bg-white hover:border-brand-border-dark'
                  }`}
                >
                  <div className="flex items-center gap-2.5 mb-1.5">
                    <Icon size={18} className={flow === value ? 'text-brand-navy' : 'text-brand-muted'} />
                    <p className={`text-sm font-semibold leading-tight ${
                      flow === value ? 'text-brand-navy' : 'text-brand-muted'
                    }`}>
                      {title}
                    </p>
                  </div>
                  <p className="text-xs text-brand-muted pl-[30px]">{sub}</p>
                  {flow === value && (
                    <div className="mt-2.5 pl-[30px]">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-amber-deep">
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                          <circle cx="4" cy="4" r="3.5" fill="currentColor"/>
                        </svg>
                        Selected
                      </span>
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ── Post-quote: quote upload first ───────────────────────────── */}
        {flow === 'post' && (
          <div className="mb-7">
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3">
              Upload the contractor quote
            </p>
            <FileUploadArea prominent fileRef={fileRef} files={files} fileError={fileError} onFileChange={handleFileChange} onRemoveFile={removeFile} />
            <p className="text-[11px] text-brand-muted mt-2 leading-relaxed">
              Uploading the actual quote document enables line-by-line pricing analysis.
              Text description alone gives you a less specific assessment.
            </p>
          </div>
        )}

        {/* ── Description ──────────────────────────────────────────────── */}
        <div className="mb-7">
          <label
            htmlFor="description"
            className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3 block"
          >
            {flow === 'post'
              ? 'Describe the situation and what the contractor told you'
              : 'Describe what you\'re seeing'}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            onBlur={() => setDescTouched(true)}
            rows={6}
            maxLength={4000}
            placeholder={
              flow === 'post'
                ? "e.g. My AC stopped cooling. A contractor quoted $3,200 for a full replacement. The unit is 8 years old. I'm not sure replacement is really necessary — it seemed to stop suddenly."
                : "e.g. My furnace runs but shuts off after 2 minutes. The house is getting cold. The unit is 12 years old and has never been serviced. I hear a clicking noise before it stops."
            }
            className="input resize-y leading-relaxed text-sm"
            aria-describedby="desc-hint"
          />
          <div id="desc-hint" className="flex items-start justify-between gap-3 mt-1.5">
            <p className="text-[11px] text-brand-muted leading-relaxed min-w-0">
              {descriptionTouched && description.trim().length > 0 && description.trim().length < 20
                ? 'Please add a bit more detail for an accurate analysis.'
                : 'Include duration, symptoms, and any prior repairs — the more context, the better.'}
            </p>
            <p className="text-[11px] text-brand-muted flex-shrink-0 tabular-nums">
              {description.length}/4000
            </p>
          </div>
        </div>

        {/* ── Pre-quote: optional file upload ──────────────────────────── */}
        {flow === 'pre' && (
          <div className="mb-7">
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3">
              Photos or documents{' '}
              <span className="font-normal normal-case tracking-normal">
                — optional, helpful for visible damage
              </span>
            </p>
            <FileUploadArea fileRef={fileRef} files={files} fileError={fileError} onFileChange={handleFileChange} onRemoveFile={removeFile} />
          </div>
        )}

        {/* ── Category ─────────────────────────────────────────────────── */}
        <div className="mb-7">
          <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3">
            Primary area of the home
          </p>
          <div className="flex flex-wrap gap-2">
            {CATEGORY_IDS.map((id) => {
              const Icon = CATEGORY_ICONS[id]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setCategory(id)}
                  aria-pressed={category === id}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium transition-all duration-150 ${
                    category === id
                      ? 'border-brand-navy bg-brand-navy text-white'
                      : 'border-brand-border bg-white text-brand-muted hover:border-brand-border-dark hover:text-brand-navy'
                  }`}
                >
                  <Icon size={14} className="flex-shrink-0" />
                  {CATEGORY_LABELS[id]}
                </button>
              )
            })}
          </div>

          {/* Optional secondary areas — appear once a primary is chosen. The
              report stays focused on the primary; these add cross-system context. */}
          {category && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-1.5">
                Also affects{' '}
                <span className="font-normal normal-case tracking-normal">
                  — optional, if the issue spans more than one area
                </span>
              </p>
              <p className="text-[11px] text-brand-muted mb-3 leading-relaxed">
                Your report stays focused on the primary area above. Add others only
                if they&apos;re genuinely part of the same problem (e.g. a roof leak
                affecting electrical).
              </p>
              <div className="flex flex-wrap gap-2">
                {CATEGORY_IDS.filter((id) => id !== category).map((id) => {
                  const Icon = CATEGORY_ICONS[id]
                  const selected = relatedAreas.includes(id)
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => toggleRelatedArea(id)}
                      aria-pressed={selected}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-full border text-xs font-medium transition-all duration-150 ${
                        selected
                          ? 'border-brand-amber-deep bg-brand-amber-deep/10 text-brand-amber-deep'
                          : 'border-brand-border bg-white text-brand-muted hover:border-brand-border-dark hover:text-brand-navy'
                      }`}
                    >
                      <Icon size={14} className="flex-shrink-0" />
                      {CATEGORY_LABELS[id]}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── Zip code ─────────────────────────────────────────────────── */}
        <div className="mb-8">
          <label
            htmlFor="zip"
            className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3 block"
          >
            Zip code
            <span className="font-normal normal-case tracking-normal text-brand-muted ml-1">
              — for regional cost data
            </span>
          </label>
          <input
            id="zip"
            type="text"
            inputMode="numeric"
            value={zip}
            onChange={e => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g. 19004"
            maxLength={5}
            className="input"
            style={{ maxWidth: 160 }}
          />
          {zip.length === 0 && (
            <p className="text-xs text-brand-muted mt-1.5">
              Without a zip code, cost estimates use national medians and may be
              $1,000–$3,000+ off for your area.
            </p>
          )}
          {zip.length > 0 && zip.length < 5 && (
            <p role="alert" className="text-xs text-red-600 mt-1.5">
              Enter all 5 digits, or leave blank to use national medians.
            </p>
          )}
        </div>

        {/* ── Disclaimer ───────────────────────────────────────────────── */}
        <p className="text-xs text-brand-muted leading-relaxed mb-6 px-4 py-3 bg-white border border-brand-border rounded-xl">
          By continuing, you acknowledge that HomeReview AI provides general informational
          analysis only — not professional contractor, engineering, or legal advice.
          Always consult a licensed professional before major repairs.
        </p>

        {/* ── Error + Submit ────────────────────────────────────────────── */}
        {submitError && <ErrorBanner message={submitError} />}

        {/* Quote Shield: no-quote steering notice */}
        {showQuoteWarning && (
          <div role="alert" className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <div className="flex gap-2.5">
              <AlertTriangleIcon size={18} className="text-amber-700 flex-shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-amber-900 mb-1">You haven&apos;t added a quote</p>
                <p className="text-xs text-amber-800 leading-relaxed mb-3.5">
                  Quote Shield reviews a real contractor quote line by line — pricing, scope, and red
                  flags. Without one, there&apos;s little for it to evaluate. Don&apos;t have a quote yet?
                  Diagnostic Brief explains your issue and what a fair price looks like.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => { setShowQuoteWarning(false); fileRef.current?.click() }}
                    className="px-3.5 py-2 bg-brand-navy text-white text-xs font-semibold rounded-lg hover:bg-opacity-90 transition-colors"
                  >
                    Upload my quote
                  </button>
                  <button
                    type="button"
                    onClick={switchToBrief}
                    className="px-3.5 py-2 bg-white border border-brand-border text-brand-navy text-xs font-semibold rounded-lg hover:border-brand-border-dark transition-colors"
                  >
                    Switch to Diagnostic Brief
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSubmit({ bypassQuote: true })}
                    className="text-xs text-amber-800 underline underline-offset-2 hover:text-amber-900 ml-0.5"
                  >
                    Continue without a quote
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bot gate — renders only when configured (NEXT_PUBLIC_TURNSTILE_SITE_KEY) */}
        <TurnstileGate onToken={setGateToken} />

        <Button
          size="lg"
          full
          onClick={() => handleSubmit()}
          disabled={!canSubmit}
          loading={submitting}
          loadingLabel="Continuing…"
        >
          Continue →
        </Button>
        <p className="text-xs text-brand-muted text-center mt-2.5">
          Free preview included · No payment required
        </p>
      </div>
    </div>
  )
}
