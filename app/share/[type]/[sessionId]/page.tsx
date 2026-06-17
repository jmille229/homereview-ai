import { redirect } from 'next/navigation'
import { getCategoryLabel } from '@/lib/constants'
import { getSession } from '@/lib/redis'
import { verifyShareToken } from '@/lib/access'
import { QuoteShield } from '@/components/reports/QuoteShield'
import { DiagnosticBrief } from '@/components/reports/DiagnosticBrief'
import type { DiagnosticBriefReport, QuoteShieldReport } from '@/lib/types'

interface Props {
  params: { type: string; sessionId: string }
  searchParams: { t?: string }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const dynamic = 'force-dynamic'

/**
 * Read-only shared report. Access is granted by a signed share token in the URL
 * (no cookie, no chat, no uploads). Falls back to home on any mismatch.
 */
export default async function SharedReportPage({ params, searchParams }: Props) {
  const { type, sessionId } = params
  if (!UUID_RE.test(sessionId) || (type !== 'brief' && type !== 'shield')) redirect('/')
  if (!verifyShareToken(sessionId, searchParams.t)) redirect('/')

  const session = await getSession(sessionId)
  if (!session || !session.paid || !session.report) redirect('/')

  // The token is generic to the session; make sure the URL's type matches.
  const expectedType = session.flow === 'pre' ? 'brief' : 'shield'
  if (type !== expectedType) redirect('/')

  if (expectedType === 'shield') {
    return (
      <QuoteShield
        report={session.report as QuoteShieldReport}
        categoryLabel={getCategoryLabel(session.category)}
        sessionId={sessionId}
        paidAt={session.paidAt ?? session.createdAt}
        createdAt={session.createdAt}
        daysRemaining={0}
        updatesExpired={false}
        product={session.product ?? 'shield'}
        initialChatMessages={[]}
        severity={session.preview?.severity}
        readOnly
      />
    )
  }

  return (
    <DiagnosticBrief
      report={session.report as DiagnosticBriefReport}
      categoryLabel={getCategoryLabel(session.category)}
      sessionId={sessionId}
      product={session.product ?? 'brief'}
      paidAt={session.paidAt ?? session.createdAt}
      initialChatMessages={[]}
      costMin={session.preview?.costMin}
      costMax={session.preview?.costMax}
      severity={session.preview?.severity}
      readOnly
    />
  )
}
