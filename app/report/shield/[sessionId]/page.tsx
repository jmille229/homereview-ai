import { redirect } from 'next/navigation'
import { getSession } from '@/lib/redis'
import { QuoteShield } from '@/components/reports/QuoteShield'
import type { QuoteShieldReport } from '@/lib/types'

interface Props {
  params: { sessionId: string }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const CATEGORY_LABELS: Record<string, string> = {
  hvac: 'HVAC', plumbing: 'Plumbing', electrical: 'Electrical',
  roofing: 'Roofing & Exterior', foundation: 'Foundation & Structure',
  appliances: 'Appliances', pest: 'Pest & Mold', maintenance: 'General Maintenance',
}

export default async function ShieldReportPage({ params }: Props) {
  if (!UUID_RE.test(params.sessionId)) redirect('/')

  const session = await getSession(params.sessionId)

  if (!session) redirect('/')
  if (!session.paid) redirect('/preview')
  if (session.flow !== 'post') redirect('/')
  if (!session.report) redirect('/preview')

  // Check 60-day window for update eligibility
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000
  const paidAt = session.paidAt ?? session.createdAt
  const updatesExpired = Date.now() - new Date(paidAt).getTime() > sixtyDaysMs
  const daysRemaining = updatesExpired
    ? 0
    : Math.ceil((new Date(paidAt).getTime() + sixtyDaysMs - Date.now()) / (1000 * 60 * 60 * 24))

  return (
    <QuoteShield
      report={session.report as QuoteShieldReport}
      categoryLabel={CATEGORY_LABELS[session.category] ?? session.category}
      sessionId={params.sessionId}
      paidAt={paidAt}
      createdAt={session.createdAt}
      daysRemaining={daysRemaining}
      updatesExpired={updatesExpired}
    />
  )
}
