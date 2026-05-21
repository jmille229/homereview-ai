'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useState } from 'react'
import { useSessionStore } from '@/store/session'
import { NavBar } from '@/components/ui/NavBar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { AiQuestion, AnalyzeResponse, QuestionsResponse, UserAnswer } from '@/lib/types'
import { getPendingFiles } from '@/lib/pendingFiles'
import { ProgressBar } from '@/components/ui/ProgressBar'

// Static constant — defined at module scope, not inside the component,
// so it never needs to appear in useCallback/useEffect dependency arrays.
const PROCESSING_MESSAGES = [
  'Analyzing your situation…',
  'Checking regional cost data…',
  'Preparing your free preview…',
]

export default function QuestionsPage() {
  const router = useRouter()
  const {
    flow, category, description, zip,
    questions, setQuestions, setAnswers, setSessionId, setPreview,
  } = useSessionStore()

  const [localAnswers, setLocalAnswers]   = useState<Record<string, string>>({})
  const [loadingQuestions, setLoadingQ]   = useState(false)
  const [submitting, setSubmitting]       = useState(false)
  const [processingMsg, setProcessingMsg] = useState('Analyzing your situation…')
  const [error, setError]                 = useState<string | null>(null)

  // Guard
  useEffect(() => {
    if (!category) { router.replace('/category'); return }
    if (!description) { router.replace('/intake'); return }
  }, [category, description, router])

  /**
   * Generates the preview and navigates to the preview page.
   * Wrapped in useCallback so it can safely be referenced in the
   * questions-fetching effect without causing stale closure issues.
   */
  const generatePreview = useCallback(async (answers: UserAnswer[]) => {
    setSubmitting(true)
    setError(null)

    let msgIdx = 0
    setProcessingMsg(PROCESSING_MESSAGES[0])
    const interval = setInterval(() => {
      msgIdx = (msgIdx + 1) % PROCESSING_MESSAGES.length
      setProcessingMsg(PROCESSING_MESSAGES[msgIdx])
    }, 2000)

    try {
      const files = getPendingFiles()
      const res = await fetch('/api/analyze', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ flow, category, description, zip, files, answers }),
      })
      const json: AnalyzeResponse | { error: string } = await res.json()

      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Something went wrong. Please try again.')
        setSubmitting(false)
        return
      }

      setAnswers(answers)
      setSessionId((json as AnalyzeResponse).sessionId)
      setPreview((json as AnalyzeResponse).preview)
      router.push('/preview')
    } catch {
      setError('Network error. Please check your connection and try again.')
      setSubmitting(false)
    } finally {
      clearInterval(interval)
    }
  }, [flow, category, description, zip, setAnswers, setSessionId, setPreview, router])

  // Fetch questions on mount — if the store already has them (e.g. back-navigation), skip.
  useEffect(() => {
    if (!flow || !category || !description) return
    if (questions.length > 0) return

    let cancelled = false

    const fetchQuestions = async () => {
      setLoadingQ(true)
      try {
        const res = await fetch('/api/questions', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ flow, category, description }),
        })
        const json: QuestionsResponse | { error: string } = await res.json()

        if (cancelled) return

        if (!res.ok || 'error' in json || (json as QuestionsResponse).questions.length === 0) {
          // Question generation failed or returned nothing — skip straight to preview
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

    // Cleanup: if the component unmounts mid-fetch, don't update state or navigate
    return () => { cancelled = true }
  }, [flow, category, description, questions.length, generatePreview, setQuestions])

  const handleSubmit = async () => {
    const answers: UserAnswer[] = (questions as AiQuestion[]).map(q => ({
      questionId: q.id,
      question:   q.question,
      answer:     localAnswers[q.id] ?? '',
    }))
    await generatePreview(answers)
  }

  const allAnswered = (questions as AiQuestion[]).every(
    q => (localAnswers[q.id] ?? '').trim().length > 0,
  )

  if (!flow || !category || !description) return null

  if (loadingQuestions) {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="text-center">
          <LoadingSpinner size={28} color="#B8722E" className="mx-auto mb-4" />
          <p className="text-sm font-medium text-brand-navy">Preparing your questions…</p>
        </div>
      </main>
    )
  }

  if (submitting) {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="text-center">
          <LoadingSpinner size={28} color="#B8722E" className="mx-auto mb-4" />
          <p className="text-sm font-medium text-brand-navy mb-1">{processingMsg}</p>
          <p className="text-xs text-brand-muted">Takes about 30 seconds</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <div className="max-w-xl mx-auto px-5 py-8">
        <NavBar step="Step 3 of 4" onBack={() => router.push('/intake')} />
        <ProgressBar step={3} total={4} />

        <div className="mb-7">
          <h2 className="text-2xl font-semibold text-brand-navy mb-2">
            A few quick questions
          </h2>
          <p className="text-sm text-brand-muted leading-relaxed">
            Your answers help us give you a more accurate analysis.
            Answer briefly — a sentence or two is enough.
          </p>
        </div>

        {error && (
          <div role="alert" className="mb-5 p-3.5 bg-red-50 border border-red-200 rounded-xl">
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-5 mb-8">
          {(questions as AiQuestion[]).map((q, i) => (
            <div key={q.id} className="card">
              <label
                htmlFor={`answer-${q.id}`}
                className="block text-sm font-semibold text-brand-navy mb-3 leading-snug"
              >
                {i + 1}. {q.question}
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
              <p className="text-[11px] text-brand-muted mt-1 text-right">
                {(localAnswers[q.id] ?? '').length}/1000
              </p>
            </div>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!allAnswered}
          className="btn-primary mb-2"
        >
          Get My Free Preview →
        </button>
        <p className="text-xs text-brand-muted text-center">
          Takes about 30 seconds · Free, no payment required
        </p>
      </div>
    </main>
  )
}
