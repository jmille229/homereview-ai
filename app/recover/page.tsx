'use client'

import { useState } from 'react'
import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

interface RecoveredReport {
  path:        string
  product:     'brief' | 'shield'
  category:    string
  purchasedAt: string
}

const PRODUCT_LABEL: Record<string, string> = {
  brief:  'Diagnostic Brief',
  shield: 'Quote Shield',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function RecoverPage() {
  const [email, setEmail]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [reports, setReports]   = useState<RecoveredReport[] | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim() || loading) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/report/recover', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim() }),
      })
      const json = await res.json() as { reports: RecoveredReport[] } | { error: string }
      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setReports((json as { reports: RecoveredReport[] }).reports)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-md mx-auto px-5 py-12">
        <h1 className="text-2xl font-bold text-brand-navy mb-2">Find my report</h1>
        <p className="text-sm text-brand-muted leading-relaxed mb-6">
          Enter the email you used at checkout and we&apos;ll bring back your report —
          where you can keep chatting with your advisor and, for Quote Shield, upload
          revised quotes throughout your window.
        </p>

        {reports === null ? (
          <form onSubmit={handleSubmit}>
            <label htmlFor="recover-email" className="sr-only">Checkout email</label>
            <input
              id="recover-email"
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
                ? <><LoadingSpinner size={15} color="white" /><span>Searching…</span></>
                : 'Find my report →'}
            </button>
          </form>
        ) : reports.length === 0 ? (
          <div className="p-4 bg-white border border-brand-border rounded-xl">
            <p className="text-sm font-semibold text-brand-navy mb-1">No report found</p>
            <p className="text-xs text-brand-muted leading-relaxed mb-4">
              We couldn&apos;t find a report for that email. Double-check it&apos;s the address
              you used at checkout, or email{' '}
              <a className="underline" href="mailto:support@homereviewai.com">support@homereviewai.com</a>{' '}
              and we&apos;ll help.
            </p>
            <button
              type="button"
              onClick={() => { setReports(null); setEmail('') }}
              className="text-xs font-semibold text-brand-amber-deep hover:text-brand-navy"
            >
              ← Try another email
            </button>
          </div>
        ) : (
          <div>
            <p className="text-xs font-semibold text-brand-muted uppercase tracking-[0.05em] mb-3">
              {reports.length === 1 ? 'Your report' : 'Your reports'}
            </p>
            <ul className="space-y-2.5">
              {reports.map((r) => (
                <li key={r.path}>
                  <Link
                    href={r.path}
                    className="flex items-center justify-between gap-3 p-4 bg-white border border-brand-border rounded-xl hover:border-brand-border-dark transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-brand-navy break-words">
                        {PRODUCT_LABEL[r.product] ?? 'Report'}
                      </p>
                      <p className="text-xs text-brand-muted mt-0.5 break-words">
                        {r.category} · Purchased {formatDate(r.purchasedAt)}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-brand-amber-deep flex-shrink-0">View →</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </main>
  )
}
