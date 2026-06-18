import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { callClaude } from '@/lib/claude'
import { previewLimiter, getClientIp } from '@/lib/ratelimit'
import { buildQuestionsSystem, sanitizeInput } from '@/lib/prompts'
import { questionsRequestSchema, questionsResultSchema, MAX_BODY_BYTES } from '@/lib/validators'
import type { QuestionsResponse } from '@/lib/types'
import { getCategoryLabel, getRelatedAreaLabels } from '@/lib/constants'
import { parseJsonBody } from '@/lib/http'
import { hasValidPreviewPass } from '@/lib/gate'
import { consumeDailyBudget } from '@/lib/budget'
import { filesHaveValidSignatures } from '@/lib/fileValidation'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<NextResponse> {
  // ── Bot gate — must hold a valid preview pass (Turnstile) ──────────────────
  if (!hasValidPreviewPass()) {
    return NextResponse.json(
      { error: 'GATE: Please complete the verification step.', code: 'gate' },
      { status: 403 },
    )
  }

  // ── Rate limit (shared with preview — same session, same window) ───────────
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await previewLimiter.limit(ip)
  if (!success) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait before trying again.' },
      { status: 429 },
    )
  }

  // ── Parse and validate (real-body size limit) ──────────────────────────────
  const parsed = await parseJsonBody(req, MAX_BODY_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof questionsRequestSchema.parse>
  try {
    data = questionsRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  if (data.files && !filesHaveValidSignatures(data.files)) {
    return NextResponse.json(
      { error: 'One or more files appear corrupted or are not a supported image/PDF.' },
      { status: 400 },
    )
  }

  // ── Global daily ceiling — circuit breaker against distributed cost-DoS ────
  if (!(await consumeDailyBudget('questions'))) {
    return NextResponse.json({ questions: [] } as QuestionsResponse, { status: 200 })
  }

  const categoryLabel = getCategoryLabel(data.category)
  const relatedLabels = getRelatedAreaLabels(data.category, data.relatedAreas)
  const sanitizedDesc = sanitizeInput(data.description)
  const files = data.files ?? []

  // ── Generate questions ─────────────────────────────────────────────────────
  // The post-quote prompt instructs the model to READ the uploaded quote and not
  // ask anything the document already answers — so the document MUST be passed
  // here. When a document is present we use Sonnet (reliable document reading,
  // same as the preview step); otherwise Haiku is fast and sufficient for the
  // text-only pre-quote flow.
  // On failure, return empty questions. The caller skips to the analyze step
  // rather than blocking the user. Questions are an enhancement, not a gate.
  let result: ReturnType<typeof questionsResultSchema.parse>
  try {
    result = await callClaude({
      system:    buildQuestionsSystem(data.flow, categoryLabel, relatedLabels),
      userText:  `Issue description: ${sanitizedDesc}`,
      files,
      schema:    questionsResultSchema,
      model:     files.length > 0 ? 'sonnet' : 'haiku',
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
