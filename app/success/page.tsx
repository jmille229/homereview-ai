'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useEffect, useRef, useState, Suspense } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { GenerateReportResponse, ReportStatusResponse, UploadedFile } from '@/lib/types'
import { getPendingFiles, clearPendingFiles } from '@/lib/pendingFiles'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_MESSAGES = [
  'Payment confirmed…',
  'Analyzing your situation…',
  'Building your report…',
  'Applying regional data…',
  'Almost ready…',
]

const POLL_INTERVAL_MS = 2_000
const POLL_TIMEOUT_MS  = 90_000

// ─── Inner component ──────────────────────────────────────────────────────────

function SuccessContent() {
  const router = useRouter()
  const params = useSearchParams()

  const [msgIndex, setMsgIndex]       = useState(0)
  const [failState, setFailState]     = useState<'idle' | 'first' | 'second'>('idle')
  const [failMessage, setFailMessage] = useState<string | null>(null)
  const [retrying, setRetrying]       = useState(false)

  const sessionIdRef    = useRef<string | null>(null)
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const pollTimeoutRef  = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const initiatedRef    = useRef(false)
  const attemptRef      = useRef(0)
  // Capture files at mount time. sessionStorage may be cleared by the time
  // a retry occurs, so we hold a reference for the lifetime of this page.
  const filesRef        = useRef<UploadedFile[]>([])

  const stripeSessionId = params.get('stripe_session_id')
  const product         = params.get('product')

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
    if (pollTimeoutRef.current)  clearTimeout(pollTimeoutRef.current)
  }, [])

  const handleFail = useCallback((message: string) => {
    stopPolling()
    setRetrying(false)
    setFailMessage(message)
    setFailState(prev => prev === 'first' ? 'second' : 'first')
  }, [stopPolling])

  // ── Poll the status endpoint ────────────────────────────────────────────────

  const poll = useCallback(async (sid: string) => {
    try {
      const res  = await fetch(`/api/report/status/${sid}`)
      const json = await res.json() as ReportStatusResponse | { error: string }

      if ('error' in json) {
        handleFail((json as { error: string }).error)
        return
      }

      const { status } = json as ReportStatusResponse

      if (status === 'complete') {
        stopPolling()
        const { reportPath } = json as ReportStatusResponse
        if (reportPath) {
          router.replace(reportPath)
        } else {
          handleFail('Report complete but path is missing. Please try again.')
        }
        return
      }

      if (status === 'failed') {
        handleFail(
          (json as ReportStatusResponse).error ??
          'Report generation failed. Please try again.',
        )
      }
      // status === 'generating' — keep polling
    } catch {
      // Network hiccup — don't surface yet, try again next interval
    }
  }, [router, stopPolling, handleFail])

  // ── Kick off generation and begin polling ───────────────────────────────────

  const startGeneration = useCallback(async (sid: string) => {
    poll(sid)

    pollIntervalRef.current = setInterval(() => poll(sid), POLL_INTERVAL_MS)

    pollTimeoutRef.current = setTimeout(() => {
      handleFail(
        'Report generation is taking longer than expected. Please try again.',
      )
    }, POLL_TIMEOUT_MS)
  }, [poll, handleFail])

  // ── Retry handler ───────────────────────────────────────────────────────────

  const handleRetry = useCallback(async () => {
    const sid = sessionIdRef.current
    if (!sid || !stripeSessionId) return

    setRetrying(true)
    setFailMessage(null)
    attemptRef.current += 1

    try {
      const res  = await fetch('/api/report', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          stripeSessionId,
          // Re-send files on retry — held in ref since sessionStorage
          // may have been cleared between the initial attempt and the retry.
          files: filesRef.current,
        }),
      })
      const json = await res.json() as GenerateReportResponse | { error: string }

      if (!res.ok || 'error' in json) {
        handleFail(
          ('error' in json ? (json as { error: string }).error : null) ??
          'Could not start report generation. Please try again.',
        )
        return
      }
    } catch {
      handleFail('Network error. Please check your connection and try again.')
      return
    }

    setRetrying(false)
    // Reset to generating UI and resume polling
    setFailState('idle')
    startGeneration(sid)
  }, [stripeSessionId, handleFail, startGeneration])

  // ── Initial mount ───────────────────────────────────────────────────────────

  useEffect(() => {
    if (initiatedRef.current) return
    if (!stripeSessionId || !product) {
      handleFail('Invalid payment confirmation. Please contact support.')
      return
    }

    initiatedRef.current = true
    attemptRef.current   = 1

    // Capture files now — sessionStorage is still intact at this point.
    // We clear them after capturing so they don't persist beyond this session.
    filesRef.current = getPendingFiles()
    clearPendingFiles()

    const initiate = async () => {
      let sessionId: string
      try {
        const res  = await fetch('/api/report', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            stripeSessionId,
            files: filesRef.current,
          }),
        })
        const json = await res.json() as GenerateReportResponse | { error: string }

        if (!res.ok || 'error' in json) {
          handleFail(
            ('error' in json ? (json as { error: string }).error : null) ??
            'Could not verify payment. Please contact support.',
          )
          return
        }

        sessionId = (json as GenerateReportResponse).sessionId
        sessionIdRef.current = sessionId
      } catch {
        handleFail('Network error. Please check your connection and try again.')
        return
      }

      startGeneration(sessionId)
    }

    initiate()
    return stopPolling
  }, [stripeSessionId, product, poll, stopPolling, handleFail, startGeneration])

  // ── Rotate status messages ──────────────────────────────────────────────────

  useEffect(() => {
    const interval = setInterval(
      () => setMsgIndex(i => (i + 1) % STATUS_MESSAGES.length),
      3_000,
    )
    return () => clearInterval(interval)
  }, [])

  // ── First failure — show retry ──────────────────────────────────────────────

  if (failState === 'first') {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="max-w-sm w-full bg-white border border-brand-border rounded-2xl p-7 text-center">
          <div className="w-10 h-10 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-4">
            <span className="text-lg" aria-hidden="true">⚠</span>
          </div>
          <p className="text-base font-bold text-brand-navy mb-2">
            Report generation failed
          </p>
          <p className="text-sm text-brand-muted mb-6 leading-relaxed">
            {failMessage ?? 'Something went wrong while building your report.'}
            {' '}Your payment was not charged again.
          </p>
          <button
            onClick={handleRetry}
            disabled={retrying}
            className="btn-primary flex items-center justify-center gap-2 mb-3 text-sm py-3"
          >
            {retrying ? (
              <><LoadingSpinner size={15} color="white" /><span>Retrying…</span></>
            ) : (
              'Try again →'
            )}
          </button>
          <p className="text-[11px] text-brand-muted">
            Your payment was processed and is safe.
          </p>
        </div>
      </main>
    )
  }

  // ── Second failure — show support contact ───────────────────────────────────

  if (failState === 'second') {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="max-w-sm w-full card text-center">
          <p className="text-lg font-semibold text-brand-navy mb-2">
            Still not working
          </p>
          <p className="text-sm text-brand-muted mb-6 leading-relaxed">
            We weren&apos;t able to generate your report after two attempts.
            Our team will get this resolved for you right away.
          </p>
          <a
            href={`mailto:support@homereviewai.com?subject=Report generation failed&body=Session: ${sessionIdRef.current ?? 'unknown'}`}
            className="btn-primary inline-block mb-3"
          >
            Email support →
          </a>
          <p className="text-xs text-brand-muted">
            Your payment was processed. We will issue a full refund if we cannot
            resolve this within 24 hours.
          </p>
        </div>
      </main>
    )
  }

  // ── Generating ──────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
      <div className="text-center max-w-xs">
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-white border border-brand-border flex items-center justify-center">
            <LoadingSpinner size={24} color="#B8722E" />
          </div>
        </div>
        <p className="text-base font-bold text-brand-navy mb-2">
          {STATUS_MESSAGES[msgIndex]}
        </p>
        <p className="text-sm text-brand-muted mb-6 leading-relaxed">
          We&apos;re building your full report. This usually takes
          about 30 seconds — please don&apos;t close this page.
        </p>
        <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
          {[
            'animate-bounce [animation-delay:0ms]',
            'animate-bounce [animation-delay:150ms]',
            'animate-bounce [animation-delay:300ms]',
          ].map((cls, i) => (
            <div key={i} className={`w-1.5 h-1.5 rounded-full bg-brand-amber opacity-60 ${cls}`} />
          ))}
        </div>
      </div>
    </main>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
          <div className="text-center">
            <LoadingSpinner size={36} color="#B8722E" />
          </div>
        </main>
      }
    >
      <SuccessContent />
    </Suspense>
  )
}
