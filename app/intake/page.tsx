'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ProgressBar } from '@/components/ui/ProgressBar'
import {
  MAX_FILE_SIZE_BYTES,
  MAX_FILES_PER_REQUEST,
  ALLOWED_MIME_TYPES,
} from '@/lib/validators'
import { CATEGORY_LABELS } from '@/lib/constants'
import type { CategoryId, Flow, UploadedFile } from '@/lib/types'
import { savePendingFiles } from '@/lib/pendingFiles'
import { InlineNotice } from '@/components/ui/InlineNotice'
import { ErrorBanner } from '@/components/ui/ErrorBanner'

type AllowedMime = typeof ALLOWED_MIME_TYPES[number]

interface LocalFile {
  name: string
  type: AllowedMime
  size: number
  dataUrl: string
}

const CATEGORIES: Array<{ id: CategoryId; icon: string }> = [
  { id: 'hvac',        icon: '🌡️' },
  { id: 'plumbing',    icon: '🚿' },
  { id: 'electrical',  icon: '⚡' },
  { id: 'roofing',     icon: '🏠' },
  { id: 'foundation',  icon: '🏗️' },
  { id: 'appliances',  icon: '🔧' },
  { id: 'pest',        icon: '🪲' },
  { id: 'maintenance', icon: '🛠️' },
]

export default function IntakePage() {
  const router = useRouter()
  const {
    flow, category, description, zip,
    setFlow, setCategory, setDescription, setZip, setQuestions,
  } = useSessionStore()

  const [files, setFiles]             = useState<LocalFile[]>([])
  const [fileError, setFileError]     = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting]         = useState(false)
  const [descriptionTouched, setDescTouched] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── File handling ─────────────────────────────────────────────────────────

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
        reader.onload  = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error('File read failed'))
        reader.readAsDataURL(file)
      })
      validated.push({ name: file.name, type: file.type as AllowedMime, size: file.size, dataUrl })
    }
    setFiles(prev => [...prev, ...validated].slice(0, MAX_FILES_PER_REQUEST))
    if (fileRef.current) fileRef.current.value = ''
  }

  const removeFile = (index: number) =>
    setFiles(prev => prev.filter((_, i) => i !== index))

  // ── Submit ────────────────────────────────────────────────────────────────

  const handleSubmit = () => {
    if (!flow) {
      setSubmitError('Please tell us whether you have a quote yet.')
      return
    }
    if (!category) {
      setSubmitError('Please select the area of your home.')
      return
    }
    setSubmitError(null)
    setSubmitting(true)

    const uploadedFiles: UploadedFile[] = files.map(f => ({
      name: f.name,
      type: f.type,
      size: f.size,
      data: f.dataUrl.split(',')[1] ?? '',
    }))
    savePendingFiles(uploadedFiles)
    setQuestions([])
    router.push('/questions')
  }

  const canSubmit = !!flow && !!category && description.trim().length >= 20 && !submitting

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar step="Step 1 of 3" onBack={() => router.push('/')} />
        <ProgressBar step={1} total={3} />

        <h2 className="text-2xl font-semibold text-brand-navy mb-1.5">
          Describe your situation
        </h2>
        <p className="text-sm text-brand-muted mb-7">
          Tell us what&apos;s happening. The more detail, the better.
        </p>

        {/* ── Pre/post — asked once, in context ──────────────────────────── */}
        <div className="mb-6">
          <p className="section-label">Where are you in the process?</p>
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                { value: 'pre'  as Flow, label: 'I have a home issue',    sub: 'No contractor contacted yet' },
                { value: 'post' as Flow, label: 'I have a quote to review', sub: 'I want to evaluate it' },
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

        {/* ── Post-quote: file upload FIRST — it's the primary input ──────── */}
        {flow === 'post' && (
          <div className="mb-5">
            <p className="section-label">Upload the contractor quote</p>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border-2 border-dashed border-brand-navy border-opacity-30 rounded-xl p-6 text-center hover:bg-white hover:border-opacity-60 transition-all cursor-pointer"
              aria-label="Upload contractor quote"
            >
              <p className="text-sm font-semibold text-brand-navy mb-1">
                Upload PDF or photo of the quote
              </p>
              <p className="text-xs text-brand-muted">
                Uploading the actual quote gives you line-by-line analysis
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
        )}

        {/* ── Description ────────────────────────────────────────────────── */}
        <div className="mb-5">
          <label htmlFor="description" className="section-label">
            {flow === 'post'
              ? 'Describe the situation and what the contractor told you'
              : "What's happening?"}
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
                ? 'e.g. My AC stopped cooling. A contractor quoted $3,200 for full replacement. The unit is 8 years old. I\'m not sure if replacement is really necessary.'
                : 'e.g. My furnace runs but shuts off after about 2 minutes. The house is getting cold. The unit is 12 years old and has never been serviced.'
            }
            className="input resize-y leading-relaxed"
            aria-describedby="desc-count"
          />
          <div className="flex items-center justify-between mt-1">
            {descriptionTouched && description.trim().length < 20 && description.length > 0 ? (
              <InlineNotice
                variant="error"
                message="Please provide at least a sentence or two so we can give you a useful analysis."
              />
            ) : descriptionTouched && description.trim().length === 0 ? (
              <InlineNotice
                variant="error"
                message="A description is required."
              />
            ) : (
              <InlineNotice
                variant="hint"
                message="More detail = more accurate analysis. Include duration, symptoms, and any prior repairs."
              />
            )}
            <p className="text-[11px] text-brand-muted ml-3 flex-shrink-0">
              {description.length}/4000
            </p>
          </div>
        </div>

        {/* ── Pre-quote: file upload secondary ────────────────────────────── */}
        {flow === 'pre' && (
          <div className="mb-5">
            <label className="section-label">
              Photos or documents{' '}
              <span className="font-normal normal-case tracking-normal text-brand-muted">
                (optional — helpful for visible damage)
              </span>
            </label>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full border border-dashed border-brand-border-dark rounded-xl p-4 text-center hover:bg-white transition-colors cursor-pointer"
              aria-label="Upload files"
            >
              <p className="text-sm font-medium text-brand-navy mb-0.5">Tap to upload</p>
              <p className="text-xs text-brand-muted">
                Photos of damage, service records, appliance manuals
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
        )}

        {/* ── Category — inline pill selector ─────────────────────────────── */}
        <div className="mb-5">
          <p className="section-label">Area of the home</p>
          <div className="flex flex-wrap gap-2">
            {CATEGORIES.map(({ id, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => setCategory(id)}
                aria-pressed={category === id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-medium transition-all duration-150 ${
                  category === id
                    ? 'border-brand-navy bg-brand-navy text-white'
                    : 'border-brand-border bg-white text-brand-muted hover:border-brand-border-dark hover:text-brand-navy'
                }`}
              >
                <span aria-hidden="true">{icon}</span>
                {CATEGORY_LABELS[id]}
              </button>
            ))}
          </div>
        </div>

        {/* ── Zip code ─────────────────────────────────────────────────────── */}
        <div className="mb-7">
          <label htmlFor="zip" className="section-label">
            Zip code{' '}
            <span className="font-normal normal-case tracking-normal text-brand-muted">
              (for regional cost data)
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
        </div>

        {submitError && (
          <ErrorBanner message={submitError} />
        )}

        {/* Passive disclaimer — visible before any payment, low friction */}
        <p className="text-[11px] text-brand-muted leading-relaxed mb-5 p-3.5 bg-gray-50 border border-brand-border rounded-xl">
          By continuing, you acknowledge that HomeReview AI provides general informational
          analysis only — not professional contractor, engineering, or legal advice.
          Always consult a licensed professional before undertaking major repairs.
        </p>

        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="btn-primary mb-2 flex items-center justify-center gap-2"
        >
          {submitting
            ? <><LoadingSpinner size={16} color="white" /><span>Continuing…</span></>
            : 'Continue →'
          }
        </button>
        <p className="text-xs text-brand-muted text-center">
          Free preview included · No payment required
        </p>
      </div>
    </main>
  )
}
