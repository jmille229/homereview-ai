import { redirect } from 'next/navigation'
import { getCategoryLabel } from '@/lib/constants'
import { getSession, indexSessionForRecovery } from '@/lib/redis'
import { hasValidAccess, createShareToken } from '@/lib/access'
import { emailEnabled } from '@/lib/email'
import { DiagnosticBrief } from '@/components/reports/DiagnosticBrief'
import type { DiagnosticBriefReport } from '@/lib/types'

interface Props {
  params: { sessionId: string }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

export default async function BriefReportPage({ params }: Props) {
  if (!UUID_RE.test(params.sessionId)) redirect('/')

  const session = await getSession(params.sessionId)

  if (!session)               redirect('/')
  if (!session.paid)          redirect('/preview')
  if (session.flow !== 'pre') redirect('/')

  // Payment-bound access: the session URL alone is not sufficient. Without a
  // valid access cookie, send the user to reclaim it with their checkout email.
  if (!hasValidAccess(params.sessionId)) redirect(`/unlock?session=${params.sessionId}`)

  // Backfill the recovery index so this report is findable by email later —
  // covers reports purchased before the index existed. Idempotent, best-effort.
  if (session.payerEmail) {
    try { await indexSessionForRecovery(session.payerEmail, params.sessionId) } catch { /* non-fatal */ }
  }

  // Allow access even when report generation failed — user has paid and
  // deserves access to chat support while we resolve the issue.
  const reportFailed = session.reportStatus === 'failed'

  const base = process.env.NEXT_PUBLIC_BASE_URL ?? ''
  const shareUrl = session.report
    ? `${base}/share/brief/${params.sessionId}?t=${createShareToken(params.sessionId)}`
    : undefined

  return (
    <DiagnosticBrief
      report={session.report as DiagnosticBriefReport | undefined}
      categoryLabel={getCategoryLabel(session.category)}
      sessionId={params.sessionId}
      product={session.product ?? 'brief'}
      paidAt={session.paidAt ?? session.createdAt}
      initialChatMessages={session.chatMessages ?? []}
      reportFailed={reportFailed}
      reportError={session.reportError}
      costMin={session.preview?.costMin}
      costMax={session.preview?.costMax}
      severity={session.preview?.severity}
      shareUrl={shareUrl}
      emailedCopy={emailEnabled() && !!session.payerEmail}
    />
  )
}
