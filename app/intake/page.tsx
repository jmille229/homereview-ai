'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
} from '@/lib/validators'
import type { AnalyzeResponse, Flow, UploadedFile } from '@/lib/types'

const CATEGORY_LABELS: Record<string, string> = {
  hvac: 'HVAC', plumbing: 'Plumbing', electrical: 'Electrical',
  roofing: 'Roofing & Exterior', foundation: 'Foundation & Structure',
  appliances: 'Appliances', pest: 'Pest & Mold', maintenance: 'General Maintenance',
}

const PROCESSING_MESSAGES = [
  'Analyzing your issue…',
  'Checking regional cost data…',
  'Preparing your free preview…',
]

type AllowedMime = typeof ALLOWED_MIME_TYPES[number]

interface LocalFile {
  name: string
  type: AllowedMime
  size: number
  dataUrl: string
}

export default function IntakePage() {
  const router = useRouter()
  const {
    flow, category, description, zip,
    setFlow, setDescription, setZip, setSessionId, setPreview,
  } = useSessionStore()

  const [files, setFiles] = useState<LocalFile[]>([])
  const [fileError, setFileError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_MESSAGES[0])
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const msgIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Guard: must have a category before reaching intake
  useEffect(() => {
    if (!category) router.replace('/category')
  }, [category, router])

  // Cycle through processing messages while submitting
  useEffect(() => {
    if (submitting) {
      let i = 0
      msgIntervalRef.current = setInterval(() => {
        i = (i + 1) % PROCESSING_MESSAGES.length
        setProcessingMsg(PROCESSING_MESSAGES[i])
      }, 2000)
    } else {
      if (msgIntervalRef.current) clearInterval(msgIntervalRef.current)
    }
    return () => { if (msgIntervalRef.current) clearInterval(msgIntervalRef.current) }
  }, [submitting])

  if (!category) return null

  const categoryLabel = CATEGORY_LABELS[category] ?? category

  // ── File handling ────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null)
    const selected = Array.from(e.target.files ?? [])
    if (selected.length === 0) return

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

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  // ── Submit ───────────────────────────────────────────────────────────────

  const handleSubmit = async () => {
    if (!flow) {
      setSubmitError('Please tell us whether you have a quote yet.')
      return
    }
    setSubmitError(null)
    setSubmitting(true)
    setProcessingMsg(PROCESSING_MESSAGES[0])

    const uploadedFiles: UploadedFile[] = files.map((f) => ({
      name: f.name,
      type: f.type,
      size: f.size,
      data: f.dataUrl.split(',')[1] ?? '',
    }))

    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flow, category, description, zip, files: uploadedFiles }),
      })

      const json: AnalyzeResponse | { error: string } = await res.json()

      if (!res.ok || 'error' in json) {
        setSubmitError(('error' in json ? json.error : null) ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      setSessionId(json.sessionId)
      setPreview(json.preview)
      router.push('/preview')
    } catch {
      setSubmitError('Network error. Please check your connection and try again.')
      setSubmitting(false)
    }
  }

  const canSubmit = !!flow && description.trim().length >= 20 && !submitting

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar step="Step 2 of 3" onBack={() => router.push('/category')} />

        <div className="flex items-center gap-2.5 mb-7">
          <h2 className="text-2xl font-semibold text-brand-navy">Describe the situation</h2>
          <span className="text-[11px] font-medium px-2.5 py-1 bg-white border border-brand-border text-brand-muted rounded-lg">
            {categoryLabel}
          </span>
        </div>

        {/* ── Pre/post question ────────────────────────────────────────────── */}
        <div className="mb-6">
          <p className="section-label">Have you already received a contractor quote?</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'pre' as Flow, label: 'No — not yet', sub: "I haven't contacted anyone" },
                { value: 'post' as Flow, label: 'Yes — I have one', sub: 'I want to evaluate it' },
              ] as const
            ).map(({ value, label, sub }) => (
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
                <p className={`text-sm font-semibold mb-0.5 ${flow === value ? 'text-brand-navy' : 'text-brand-muted'}`}>
                  {label}
                </p>
                <p className="text-xs text-brand-muted">{sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* ── Description ─────────────────────────────────────────────────── */}
        <div className="mb-4">
          <label htmlFor="description" className="section-label">
            {flow === 'post'
              ? 'Describe the situation and what the contractor told you.'
              : "What's happening? The more detail, the better."}
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={6}
            maxLength={4000}
            placeholder={
              flow === 'post'
                ? 'e.g. My AC stopped cooling. A contractor quoted $3,200 for full replacement. The unit is 8 years old. Not sure if replacement is really needed.'
                : 'e.g. My furnace runs but shuts off after 2 minutes. The house is getting cold. Unit is 12 years old, never serviced.'
            }
            className="input resize-y leading-relaxed"
            aria-describedby="desc-count"
          />
          <p id="desc-count" className="text-[11px] text-brand-muted mt-1 text-right">
            {description.length}/4000
          </p>
        </div>

        {/* ── File upload ──────────────────────────────────────────────────── */}
        <div className="mb-4">
          <label className="section-label">
            Upload photos or documents{' '}
            <span className="font-normal normal-case tracking-normal">
              (optional — max {MAX_FILES_PER_REQUEST} files, 2MB each)
            </span>
          </label>

          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full border border-dashed border-brand-border-dark rounded-xl p-5 text-center hover:bg-white transition-colors cursor-pointer"
            aria-label="Upload files"
          >
            <p className="text-sm font-medium text-brand-navy mb-1">Tap to upload</p>
            <p className="text-xs text-brand-muted">
              {flow === 'post'
                ? 'Contractor quotes, invoices, photos of the issue'
                : 'Photos, service records, appliance manuals'}
            </p>
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
            <p role="alert" className="text-xs text-red-600 mt-2">{fileError}</p>
          )}

          {files.length > 0 && (
            <ul className="flex flex-wrap gap-2 mt-3" aria-label="Uploaded files">
              {files.map((f, i) => (
                <li
                  key={i}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-brand-border rounded-md text-xs text-brand-navy"
                >
                  <span className="truncate max-w-[160px]">{f.name}</span>
                  <button
                    type="button"
                    onClick={() => removeFile(i)}
                    aria-label={`Remove ${f.name}`}
                    className="text-brand-muted hover:text-brand-navy ml-1"
                  >×</button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Post-quote tip ───────────────────────────────────────────────── */}
        {flow === 'post' && (
          <div className="mb-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl">
            <p className="text-xs font-semibold text-blue-700 mb-0.5">
              Tip: Upload the written quote for best results
            </p>
            <p className="text-xs text-blue-700 opacity-85">
              A PDF or photo of the estimate lets us analyze it line by line.
            </p>
          </div>
        )}

        {/* ── Zip code ────────────────────────────────────────────────────── */}
        <div className="mb-7">
          <label htmlFor="zip" className="section-label">
            Zip code{' '}
            <span className="font-normal normal-case tracking-normal">(for regional cost data)</span>
          </label>
          <input
            id="zip"
            type="text"
            inputMode="numeric"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/\D/g, '').slice(0, 5))}
            placeholder="e.g. 19004"
            maxLength={5}
            className="input"
            style={{ maxWidth: 160 }}
          />
        </div>

        {/* ── Error ───────────────────────────────────────────────────────── */}
        {submitError && (
          <div role="alert" className="mb-4 p-3.5 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700">{submitError}</p>
          </div>
        )}

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary mb-2 flex items-center justify-center gap-2"
        >
          {submitting ? (
            <>
              <LoadingSpinner size={16} color="white" />
              <span>{processingMsg}</span>
            </>
          ) : (
            'Get My Free Preview →'
          )}
        </button>
        <p className="text-xs text-brand-muted text-center">
          Takes about 30 seconds · Free, no payment required
        </p>
      </div>
    </main>
  )
}
