import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { callClaude } from '@/lib/claude'
import { previewLimiter, getClientIp } from '@/lib/ratelimit'
import { buildQuestionsSystem, sanitizeInput } from '@/lib/prompts'
import { questionsRequestSchema, questionsResultSchema } from '@/lib/validators'
import type { QuestionsResponse } from '@/lib/types'

export const runtime = 'nodejs'

const CATEGORY_LABELS: Record<string, string> = {
  hvac:        'HVAC (Heating, Cooling & Air Quality)',
  plumbing:    'Plumbing',
  electrical:  'Electrical',
  roofing:     'Roofing & Exterior',
  foundation:  'Foundation & Structure',
  appliances:  'Appliances',
  pest:        'Pest & Mold',
  maintenance: 'General Maintenance',
}

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit (shared with preview — same session, same window) ───────────
  const ip = getClientIp(req)
  const { success } = await previewLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429 },
    )
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let data: ReturnType<typeof questionsRequestSchema.parse>
  try {
    data = questionsRequestSchema.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const categoryLabel = CATEGORY_LABELS[data.category] ?? data.category
  const sanitizedDesc = sanitizeInput(data.description)

  // ── Generate questions — Haiku is fast and accurate for this task ──────────
  // On failure, return empty questions. The caller skips to the analyze step
  // rather than blocking the user. Questions are an enhancement, not a gate.
  let result: ReturnType<typeof questionsResultSchema.parse>
  try {
    result = await callClaude({
      system:    buildQuestionsSystem(data.flow, categoryLabel),
      userText:  `Issue description: ${sanitizedDesc}`,
      schema:    questionsResultSchema,
      model:     'haiku',
      maxTokens: 400,
    })
  } catch (err) {
    console.error('[questions] Claude call failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json({ questions: [] } as QuestionsResponse, { status: 200 })
  }

  const response: QuestionsResponse = { questions: result.questions }
  return NextResponse.json(response, { status: 200 })
}
