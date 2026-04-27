
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/redis'
import { DiagnosticBrief } from '@/components/reports/DiagnosticBrief'
import type { DiagnosticBriefReport } from '@/lib/types'

interface Props {
  params: { sessionId: string }
}


// Validate session ID format before querying Redis
export const dynamic = 'force-dynamic'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export default async function BriefReportPage({ params }: Props) {
  if (!UUID_RE.test(params.sessionId)) redirect('/')

  const session = await getSession(params.sessionId)

  if (!session) redirect('/')
  if (!session.paid) redirect('/preview')
  if (session.flow !== 'pre') redirect('/')
  if (!session.report) redirect('/preview')

  const CATEGORY_LABELS: Record<string, string> = {
    hvac: 'HVAC', plumbing: 'Plumbing', electrical: 'Electrical',
    roofing: 'Roofing & Exterior', foundation: 'Foundation & Structure',
    appliances: 'Appliances', pest: 'Pest & Mold', maintenance: 'General Maintenance',
  }

  return (
    <DiagnosticBrief
      report={session.report as DiagnosticBriefReport}
      categoryLabel={CATEGORY_LABELS[session.category] ?? session.category}
    />
  )
}
