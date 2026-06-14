'use client'

import { useState } from 'react'

interface SessionSummary {
  sessionId: string
  flow: string
  category: string
  paid: boolean
  product: string | null
  reportStatus: string | null
  reportError: string | null
  payerEmail: string | null
  stripeSessionId: string | null
  paidAt: string | null
  createdAt: string
  reportPath: string | null
}

type Field = 'email' | 'stripeSessionId' | 'sessionId'

export function AdminConsole() {
  const [secret, setSecret]   = useState('')
  const [field, setField]     = useState<Field>('email')
  const [query, setQuery]     = useState('')
  const [results, setResults] = useState<SessionSummary[] | null>(null)
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)
  const [refundMsg, setRefundMsg] = useState<Record<string, string>>({})

  const headers = () => ({ 'Content-Type': 'application/json', 'x-admin-secret': secret })

  const lookup = async () => {
    setError(null); setResults(null); setBusy(true)
    try {
      const res = await fetch('/api/admin/session', {
        method: 'POST', headers: headers(), body: JSON.stringify({ [field]: query.trim() }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? `Error ${res.status}`); return }
      setResults(json.sessions)
    } catch { setError('Network error.') } finally { setBusy(false) }
  }

  const refund = async (stripeSessionId: string) => {
    if (!confirm('Issue a full refund for this purchase?')) return
    setRefundMsg(m => ({ ...m, [stripeSessionId]: 'Refunding…' }))
    try {
      const res = await fetch('/api/admin/refund', {
        method: 'POST', headers: headers(), body: JSON.stringify({ stripeSessionId }),
      })
      const json = await res.json()
      setRefundMsg(m => ({ ...m, [stripeSessionId]: res.ok ? `Refunded (${json.status})` : `Failed: ${json.error}` }))
    } catch {
      setRefundMsg(m => ({ ...m, [stripeSessionId]: 'Network error' }))
    }
  }

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <h1 className="text-xl font-bold text-brand-navy mb-1">Support console</h1>
      <p className="text-xs text-brand-muted mb-6">Internal. Requires the admin secret.</p>

      <input
        type="password"
        value={secret}
        onChange={e => setSecret(e.target.value)}
        placeholder="Admin secret"
        className="input mb-4"
        autoComplete="off"
      />

      <div className="flex gap-2 mb-4">
        <select value={field} onChange={e => setField(e.target.value as Field)} className="input" style={{ maxWidth: 170 }}>
          <option value="email">Email</option>
          <option value="stripeSessionId">Stripe session id</option>
          <option value="sessionId">Session id</option>
        </select>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') lookup() }}
          placeholder="Search value"
          className="input flex-1"
        />
        <button onClick={lookup} disabled={busy || !secret || !query.trim()} className="px-4 py-2.5 bg-brand-navy text-white text-sm font-semibold rounded-xl disabled:opacity-40">
          {busy ? '…' : 'Look up'}
        </button>
      </div>

      {error && <p role="alert" className="text-xs text-red-600 mb-4">{error}</p>}

      {results && results.length === 0 && <p className="text-sm text-brand-muted">No sessions found.</p>}

      <div className="space-y-3">
        {results?.map((s) => (
          <div key={s.sessionId} className="card text-xs">
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-3">
              <span className="text-brand-muted">Session</span><span className="text-brand-navy break-all">{s.sessionId}</span>
              <span className="text-brand-muted">Product</span><span className="text-brand-navy">{s.product ?? '—'} ({s.flow})</span>
              <span className="text-brand-muted">Category</span><span className="text-brand-navy">{s.category}</span>
              <span className="text-brand-muted">Paid</span><span className="text-brand-navy">{String(s.paid)} {s.paidAt ? `· ${new Date(s.paidAt).toLocaleString()}` : ''}</span>
              <span className="text-brand-muted">Report status</span><span className="text-brand-navy">{s.reportStatus ?? '—'}</span>
              <span className="text-brand-muted">Payer email</span><span className="text-brand-navy break-all">{s.payerEmail ?? '—'}</span>
              <span className="text-brand-muted">Stripe id</span><span className="text-brand-navy break-all">{s.stripeSessionId ?? '—'}</span>
            </div>
            {s.reportError && (
              <p className="p-2 bg-red-50 text-red-700 rounded mb-3 break-words">Error: {s.reportError}</p>
            )}
            <div className="flex items-center gap-3 flex-wrap">
              {s.reportPath && <a href={s.reportPath} className="font-semibold text-brand-amber-deep">Open report →</a>}
              {s.stripeSessionId && (
                <button onClick={() => refund(s.stripeSessionId!)} className="font-semibold text-red-600 hover:text-red-800">
                  Refund
                </button>
              )}
              {s.stripeSessionId && refundMsg[s.stripeSessionId] && (
                <span className="text-brand-muted">{refundMsg[s.stripeSessionId]}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
