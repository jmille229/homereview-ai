import { redirect } from 'next/navigation'
import { getCategoryLabel } from '@/lib/constants'
import { getSession } from '@/lib/redis'
import { hasValidAccess } from '@/lib/access'
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

  // Allow access even when report generation failed — user has paid and
  // deserves access to chat support while we resolve the issue.
  const reportFailed = session.reportStatus === 'failed'

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
    />
  )
}
