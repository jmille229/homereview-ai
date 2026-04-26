'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'
import type { GenerateReportResponse, Product } from '@/lib/types'

type Status = 'generating' | 'error'

const MESSAGES = [
  'Payment confirmed…',
  'Generating your report…',
  'Applying regional data…',
  'Almost ready…',
]

export default function SuccessPage() {
  const router = useRouter()
  const params = useSearchParams()
  const [status, setStatus] = useState<Status>('generating')
  const [msgIndex, setMsgIndex] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const calledRef = useRef(false)

  const stripeSessionId = params.get('stripe_session_id')
  const product = params.get('product') as Product | null

  useEffect(() => {
    // Cycle through messages while generating
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % MESSAGES.length)
    }, 2500)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    if (calledRef.current) return // Prevent double-fire in React strict mode
    if (!stripeSessionId || !product) {
      setError('Invalid payment confirmation. Please contact support.')
      setStatus('error')
      return
    }

    calledRef.current = true

    const generate = async () => {
      try {
        const res = await fetch('/api/report', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ stripeSessionId }),
        })

        const json: GenerateReportResponse | { error: string } = await res.json()

        if (!res.ok || 'error' in json) {
          setError(('error' in json ? json.error : null) ?? 'Report generation failed.')
          setStatus('error')
          return
        }

        const { sessionId } = json as GenerateReportResponse
        const type = product === 'brief' || product === 'bundle' ? 'brief' : 'shield'

        // For bundle, we generated the appropriate report based on session flow
        router.replace(`/report/${type}/${sessionId}`)
      } catch {
        setError('Network error during report generation. Please contact support.')
        setStatus('error')
      }
    }

    generate()
  }, [stripeSessionId, product, router])

  if (status === 'error') {
    return (
      <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
        <div className="max-w-sm w-full card text-center">
          <p className="text-lg font-semibold text-brand-navy mb-2">Something went wrong</p>
          <p className="text-sm text-brand-muted mb-5">{error}</p>
          <p className="text-xs text-brand-muted">
            Your payment was processed. Please email{' '}
            <a href="mailto:support@homereviewai.com" className="underline">
              support@homereviewai.com
            </a>{' '}
            and we will resolve this immediately.
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <LoadingSpinner size={36} color="#B8722E" />
        </div>
        <p className="text-lg font-semibold text-brand-navy mb-1.5">
          {MESSAGES[msgIndex]}
        </p>
        <p className="text-sm text-brand-muted">
          Your full report is being prepared
        </p>
      </div>
    </main>
  )
}
