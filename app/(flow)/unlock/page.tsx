'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function UnlockContent() {
  const router = useRouter()
  const params = useSearchParams()
  const sessionId = params.get('session') ?? ''

  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)

  const validSession = UUID_RE.test(sessionId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/report/reclaim', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId, email: email.trim() }),
      })
      const json = await res.json() as { reportPath: string } | { error: string }
      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Could not unlock your report. Please try again.')
        setLoading(false)
        return
      }
      router.replace((json as { reportPath: string }).reportPath)
    } catch {
      setError('Network error. Please check your connection and try again.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
      <div className="max-w-sm w-full bg-white border border-brand-border rounded-2xl p-7">
        <h1 className="text-lg font-bold text-brand-navy mb-2">Unlock your report</h1>
        <p className="text-sm text-brand-muted mb-6 leading-relaxed">
          For your security, reports are tied to your purchase. Enter the email
          you used at checkout to view this report on this device.
        </p>

        {!validSession ? (
          <div role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-xs text-red-700">
              This unlock link is invalid. Please use the link from your purchase
              confirmation.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <label htmlFor="reclaim-email" className="sr-only">Checkout email</label>
            <input
              id="reclaim-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="input mb-3"
              disabled={loading}
              required
            />

            {error && (
              <div role="alert" className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={!email.trim() || loading}
              className="btn-primary flex items-center justify-center gap-2 text-sm py-3"
            >
              {loading
                ? <><LoadingSpinner size={15} color="white" /><span>Unlocking…</span></>
                : 'Unlock report →'}
            </button>

            <p className="text-[11px] text-brand-muted text-center mt-3 leading-relaxed">
              Don&apos;t have your report link?{' '}
              <a className="underline font-semibold" href="/recover">Find it by email</a>.
              <br />
              Still stuck? Email{' '}
              <a className="underline" href="mailto:support@homereviewai.com">support@homereviewai.com</a>.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}

export default function UnlockPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-brand-bg flex items-center justify-center px-5">
          <LoadingSpinner size={36} color="#B8722E" />
        </main>
      }
    >
      <UnlockContent />
    </Suspense>
  )
}
