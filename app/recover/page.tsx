'use client'

import { useState } from 'react'
import { NavBar } from '@/components/ui/NavBar'
import { LoadingSpinner } from '@/components/ui/LoadingSpinner'

export default function RecoverPage() {
  const [email, setEmail]     = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [sent, setSent]       = useState(false)

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
      const json = await res.json() as { ok?: boolean } | { error: string }
      if (!res.ok || 'error' in json) {
        setError(('error' in json ? json.error : null) ?? 'Something went wrong. Please try again.')
        setLoading(false)
        return
      }
      setSent(true)
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
          Enter the email you used at checkout and we&apos;ll send a secure link to
          each of your reports — where you can keep chatting with your advisor and,
          for Quote Shield, upload revised quotes throughout your window.
        </p>

        {sent ? (
          <div role="status" className="p-4 bg-white border border-brand-border rounded-xl">
            <p className="text-sm font-semibold text-brand-navy mb-1">Check your email</p>
            <p className="text-xs text-brand-muted leading-relaxed mb-2">
              If <span className="font-medium text-brand-navy break-words">{email.trim()}</span> has any
              reports with us, we&apos;ve just emailed a secure sign-in link for each one. It can take a
              minute to arrive.
            </p>
            <p className="text-xs text-brand-muted leading-relaxed mb-4">
              <span className="font-semibold text-brand-navy">Don&apos;t see it?</span> Check your spam
              or junk folder and mark it &quot;not junk&quot; — then it&apos;ll land in your inbox next
              time. Still stuck? Email{' '}
              <a className="underline" href="mailto:support@homereviewai.com">support@homereviewai.com</a>.
            </p>
            <button
              type="button"
              onClick={() => { setSent(false); setEmail('') }}
              className="text-xs font-semibold text-brand-amber-deep hover:text-brand-navy"
            >
              ← Use a different email
            </button>
          </div>
        ) : (
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
                ? <><LoadingSpinner size={15} color="white" /><span>Sending…</span></>
                : 'Email me my report links →'}
            </button>
            <p className="text-[11px] text-brand-muted mt-3 leading-relaxed">
              Still have your report link? You can reopen it directly and re-enter this
              email there if prompted — no need to wait for an email.
            </p>
          </form>
        )}
      </div>
    </main>
  )
}
