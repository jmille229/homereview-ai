'use client'

import { useRouter } from 'next/navigation'
import { track } from '@vercel/analytics'
import { useSessionStore } from '@/store/session'
import { Button } from '@/components/ui/Button'
import type { CategoryId, Flow } from '@/lib/types'

/**
 * Starts the funnel from a search landing page with the flow AND category
 * preset, so the visitor lands on /intake already oriented ("Quote Shield ·
 * HVAC") and only has to describe the job and upload the quote.
 */
export function LandingCta({
  slug, flow, category, label, size = 'lg',
}: {
  slug:     string
  flow:     Flow
  category: CategoryId
  label:    string
  size?:    'md' | 'lg'
}) {
  const router = useRouter()
  const { reset, setFlow, setCategory } = useSessionStore()

  const start = () => {
    track('landing_cta_click', { slug })
    reset()
    setFlow(flow)
    setCategory(category)
    router.push('/intake')
  }

  return (
    <Button size={size} onClick={start}>{label} →</Button>
  )
}
