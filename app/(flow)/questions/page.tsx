'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import { ErrorBanner } from '@/components/ui/ErrorBanner'
import type { AiQuestion, AnalyzeResponse, QuestionsResponse, UserAnswer } from '@/lib/types'
import { getPendingFiles } from '@/lib/pendingFiles'
import { track } from '@vercel/analytics'

const PROCESSING_MESSAGES = [
  'Analyzing your situation…',
  'Applying regional cost data…',
  'Identifying the likely root cause…',
  'Preparing your free preview…',
]

export default function QuestionsPage() {
  const router = useRouter()
  const {
    flow, category, description, zip,
    questions, answers, setQuestions, setAnswers, setSessionId, setPreview,
  } = useSessionStore()

  // Seed from previously saved answers so navigating back from the preview
  // doesn't wipe what the user already typed.
  const [localAnswers, setLocalAnswers]   = useState<Record<string, string>>(() =>
    Object.fromEntries(answers.map(a => [a.questionId, a.answer])),
  )
  const [loadingQuestions, setLoadingQ]   = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [processingMsg, setProcessingMsg] = useState(PROCESSING_MESSAGES[0])
  const [error, setError]                 = useState<string | null>(null)

  useEffect(() => {
    if (!description) { router.replace('/intake'); return }
    if (!flow)        { router.replace('/intake'); return }
  }, [description, flow, router])

  const generatePreview = useCallback(async (answers: UserAnswer[]) => {
    setSubmitting(true)
    setError(null)
    let msgIdx = 0
    setProcessingMsg(PROCESSING_MESSAGES[0])
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROCESSING_MESSAGES.length
      setProcessingMsg(PROCESSING_MESSAGES[msgIdx])
    }, 2500)

    try {
      const files = getPendingFiles()
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ flow, category, description, zip, files, answers }),
      })
      const json: AnalyzeResponse | { error: string; code?: string } = await res.json()
      if (res.status === 403 && 'code' in json && json.code === 'gate') {
        // Preview pass expired — send the user back to re-verify on intake.
        router.replace('/intake')
        return
      }
      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }
      setAnswers(answers)
      setSessionId((json as AnalyzeResponse).sessionId)
      setPreview((json as AnalyzeResponse).preview)
      track('preview_generated', { flow: flow ?? 'unknown' })
      router.push('/preview')
    } catch {
      setError('Network error. Please check your connection and try again.')
      setSubmitting(false)
    } finally {
      clearInterval(interval)
    }
  }, [flow, category, description, zip, setAnswers, setSessionId, setPreview, router])

  useEffect(() => {
    if (!flow || !category || !description) return
    if (questions.length > 0) return

    let cancelled = false
    const fetchQuestions = async () => {
      setLoadingQ(true)
      try {
        // Send the uploaded quote on the post-quote flow so the model can read
        // it and avoid asking about details the document already answers.
        const files = flow === 'post' ? getPendingFiles() : []
        const res = await fetch('/api/questions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ flow, category, description, files }),
        })
        const json: QuestionsResponse | { error: string; code?: string } = await res.json()
        if (cancelled) return
        if (res.status === 403 && 'code' in json && json.code === 'gate') {
          router.replace('/intake')
          return
        }
        if (!res.ok || 'error' in json || !(json as QuestionsResponse).questions.length) {
          await generatePreview([])
          return
        }
        setQuestions((json as QuestionsResponse).questions)
      } catch {
        if (!cancelled) await generatePreview([])
      } finally {
        if (!cancelled) setLoadingQ(false)
      }
    }
    fetchQuestions()
    return () => { cancelled = true }
  }, [flow, category, description, questions.length, generatePreview, setQuestions, router])

  const handleSubmit = () => {
    const answers: UserAnswer[] = (questions as AiQuestion[]).map(q => ({
      questionId: q.id,
      question:   q.question,
      answer:     localAnswers[q.id] ?? '',
    }))
    generatePreview(answers)
  }

  const allAnswered = (questions as AiQuestion[]).every(
    q => (localAnswers[q.id] ?? '').trim().length > 0
  )

  if (!flow || !description) return null

  // ── Loading: fetching questions ───────────────────────────────────────────

  if (loadingQuestions) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <NavBar step="Step 2 of 3" onBack={() => router.push('/intake')} />
        <div className="flex items-center justify-center min-h-[60vh] px-5">
          <div className="text-center">
            <LoadingSpinner size={28} color="#B8722E" className="mx-auto mb-4" />
            <p className="text-sm font-semibold text-brand-navy mb-1">
              {flow === 'post' ? 'Reviewing your quote…' : 'Reviewing your details…'}
            </p>
            <p className="text-xs text-brand-muted">
              {flow === 'post'
                ? 'Reading it closely so we only ask about anything the document doesn’t already cover.'
                : 'Checking whether a couple of quick questions would sharpen your analysis.'}
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Loading: generating preview ───────────────────────────────────────────

  if (submitting) {
    return (
      <div className="min-h-screen bg-brand-bg">
        <NavBar step="Step 2 of 3" onBack={() => router.push('/intake')} />
        <div className="flex items-center justify-center min-h-[60vh] px-5">
          <div className="text-center">
            <LoadingSpinner size={28} color="#B8722E" className="mx-auto mb-4" />
            <p className="text-sm font-semibold text-brand-navy mb-1">{processingMsg}</p>
            <p className="text-xs text-brand-muted">Usually takes about 30 seconds</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Questions ─────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-brand-bg">
      <NavBar step="Step 2 of 3" onBack={() => router.push('/intake')} />

      <div className="max-w-xl mx-auto px-5 pt-8 pb-12">
        <ProgressBar step={2} total={3} />

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-brand-navy mb-2">
            A few quick questions.
          </h1>
          <p className="text-sm text-brand-muted leading-relaxed">
            These are tailored specifically to your situation — your answers
            make the analysis significantly more accurate.
            A sentence or two per question is enough.
          </p>
        </div>

        {error && (
          <ErrorBanner
            title="Analysis failed"
            message={error}
            onRetry={allAnswered ? handleSubmit : undefined}
          />
        )}

        {/* Question cards */}
        <div className="space-y-4 mb-8">
          {(questions as AiQuestion[]).map((q, i) => (
            <div key={q.id} className="bg-white border border-brand-border rounded-xl p-5">
              <label
                htmlFor={`answer-${q.id}`}
                className="block text-sm font-semibold text-brand-navy mb-3 leading-snug"
              >
                <span className="text-brand-amber-deep font-bold mr-2">{i + 1}.</span>
                {q.question}
              </label>
              <textarea
                id={`answer-${q.id}`}
                rows={3}
                value={localAnswers[q.id] ?? ''}
                onChange={e => setLocalAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                placeholder="Your answer…"
                maxLength={1000}
                className="input resize-none text-sm leading-relaxed"
              />
              <div className="flex items-center justify-between mt-1.5">
                <p className="text-[11px] text-brand-muted">
                  {(localAnswers[q.id] ?? '').trim().length === 0
                    ? 'Required — a brief answer is fine'
                    : ''}
                </p>
                <p className="text-[11px] text-brand-muted">
                  {(localAnswers[q.id] ?? '').length}/1000
                </p>
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="btn-primary text-sm py-3.5 mb-2.5"
        >
          Get my free preview →
        </button>
        <p className="text-xs text-brand-muted text-center">
          Free · No payment required · Takes about 30 seconds
        </p>
      </div>
    </div>
  )
}
