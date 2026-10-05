import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'

import { runNurture } from '@/lib/nurture'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 60

/**
 * Daily nurture send, invoked by Vercel Cron (see vercel.json). Vercel sends
 * `Authorization: Bearer $CRON_SECRET` when CRON_SECRET is set; without it the
 * endpoint refuses every caller, so the sequence stays off until configured.
 */
export async function GET(req: Request): Promise<NextResponse> {
  const secret = process.env.CRON_SECRET
  const given  = req.headers.get('authorization') ?? ''
  const want   = `Bearer ${secret}`
  if (!secret || given.length !== want.length || !timingSafeEqual(Buffer.from(given), Buffer.from(want))) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  try {
    const result = await runNurture()
    console.log('[cron/nurture]', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/nurture] run failed:', { message: err instanceof Error ? err.message : 'Unknown error' })
    return NextResponse.json({ error: 'Run failed.' }, { status: 500 })
  }
}
