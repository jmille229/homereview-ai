import { NextResponse } from 'next/server'

import { isAuthorizedAdmin } from '@/lib/adminAuth'
import { getSession, findSessionIdsByEmail } from '@/lib/redis'
import { stripe } from '@/lib/stripe'
import { getCategoryLabel } from '@/lib/constants'
import type { StoredSession } from '@/lib/types'

export const runtime = 'nodejs'

/**
 * POST /api/admin/session  (header: x-admin-secret)
 * Body: { email?: string, stripeSessionId?: string, sessionId?: string }
 *
 * Read-only support lookup: resolves one or more sessions and returns enough to
 * diagnose a failed/missing report — including the real error message, which the
 * public status endpoint deliberately hides.
 */
function summarize(s: StoredSession) {
  return {
    sessionId:    s.id,
    flow:         s.flow,
    category:     getCategoryLabel(s.category),
    paid:         s.paid,
    product:      s.product ?? null,
    reportStatus: s.reportStatus ?? null,
    reportError:  s.reportError ?? null,   // internal — admin only
    payerEmail:   s.payerEmail ?? null,
    stripeSessionId: s.stripeSessionId ?? null,
    paidAt:       s.paidAt ?? null,
    createdAt:    s.createdAt,
    reportPath:   s.paid ? `/report/${s.flow === 'pre' ? 'brief' : 'shield'}/${s.id}` : null,
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  if (!isAuthorizedAdmin(req)) {
    return NextResponse.json({ error: 'Not found.' }, { status: 404 })
  }

  let body: { email?: string; stripeSessionId?: string; sessionId?: string }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 })
  }

  const ids = new Set<string>()

  if (body.sessionId) ids.add(body.sessionId.trim())

  if (body.email) {
    try {
      for (const id of await findSessionIdsByEmail(body.email)) ids.add(id)
    } catch { /* ignore */ }
  }

  if (body.stripeSessionId) {
    try {
      const cs = await stripe.checkout.sessions.retrieve(body.stripeSessionId.trim())
      const rid = cs.metadata?.reportSessionId
      if (rid) ids.add(rid)
    } catch { /* ignore */ }
  }

  if (ids.size === 0) {
    return NextResponse.json({ error: 'Provide email, stripeSessionId, or sessionId.' }, { status: 400 })
  }

  const sessions = []
  for (const id of ids) {
    const s = await getSession(id).catch(() => null)
    if (s) sessions.push(summarize(s))
  }

  return NextResponse.json({ sessions })
}
