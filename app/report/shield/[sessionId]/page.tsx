import { redirect } from 'next/navigation'
import { getCategoryLabel } from '@/lib/constants'
import { getSession } from '@/lib/redis'
import { QuoteShield } from '@/components/reports/QuoteShield'
import type { QuoteShieldReport } from '@/lib/types'

interface Props {
  params: { sessionId: string }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

export default async function ShieldReportPage({ params }: Props) {
  if (!UUID_RE.test(params.sessionId)) redirect('/')

  const session = await getSession(params.sessionId)

  if (!session)               redirect('/')
  if (!session.paid)          redirect('/preview')
  if (session.flow !== 'post') redirect('/')

  // Allow access even when report generation failed — user has paid and
  // deserves access to chat support while we resolve the issue.
  const reportFailed = session.reportStatus === 'failed'

  const sixtyDaysMs  = 60 * 24 * 60 * 60 * 1000
  const paidAt       = session.paidAt ?? session.createdAt
  const updatesExpired  = Date.now() - new Date(paidAt).getTime() > sixtyDaysMs
  const daysRemaining   = updatesExpired
    ? 0
    : Math.ceil((new Date(paidAt).getTime() + sixtyDaysMs - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <QuoteShield
      report={session.report as QuoteShieldReport | undefined}
      categoryLabel={getCategoryLabel(session.category)}
      sessionId={params.sessionId}
      paidAt={paidAt}
      createdAt={session.createdAt}
      daysRemaining={daysRemaining}
      updatesExpired={updatesExpired}
      product={session.product ?? 'shield'}
      initialChatMessages={session.chatMessages ?? []}
      reportFailed={reportFailed}
      reportError={session.reportError}
    />
  )
}
