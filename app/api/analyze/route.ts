import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { callClaude } from '@/lib/claude'
import { createSession } from '@/lib/redis'
import { previewLimiter, getClientIp } from '@/lib/ratelimit'
import { buildPreviewSystem, sanitizeInput } from '@/lib/prompts'
import {
  analyzeRequestSchema,
  previewResultSchema,
  MAX_BODY_BYTES,
} from '@/lib/validators'
import type { AnalyzeResponse } from '@/lib/types'
import { getCategoryLabel } from '@/lib/constants'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  const { success, reset } = await previewLimiter.limit(ip)
  if (!success) {
    const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many preview requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  // ── HIGH-01: Reject oversized bodies before parsing into memory ────────────
  const contentLength = req.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return NextResponse.json({ error: 'Request body too large.' }, { status: 413 })
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 })
  }

  let data: ReturnType<typeof analyzeRequestSchema.parse>
  try {
    data = analyzeRequestSchema.parse(body)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { flow, category, description, zip, files, answers } = data
  const categoryLabel = getCategoryLabel(category)
  const sanitizedDesc = sanitizeInput(description)

  // ── Build user text — include clarifying answers if provided ───────────────
  const answersContext = answers.length > 0
    ? '\n\nClarifying answers from homeowner:\n' +
      answers
        .map(a => `Q: ${a.question}\nA: ${sanitizeInput(a.answer, 500)}`)
        .join('\n\n')
    : ''

  const userText = `Issue description: ${sanitizedDesc}${answersContext}\nZip code: ${zip || 'Not provided'}`

  // ── Call Claude (Sonnet — preview quality drives the purchase decision) ────
  let preview: ReturnType<typeof previewResultSchema.parse>
  try {
    preview = await callClaude({
      system:    buildPreviewSystem(flow, categoryLabel),
      userText,
      files,
      schema:    previewResultSchema,
      model:     'sonnet',
      maxTokens: 600,
    })
  } catch (err) {
    console.error('[analyze] Claude call failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Analysis failed. Please try again.' },
      { status: 502 },
    )
  }

  // ── Persist session to Redis ───────────────────────────────────────────────
  const sessionId = randomUUID()
  const now       = new Date().toISOString()

  try {
    await createSession({
      id:               sessionId,
      flow,
      category,
      description:      sanitizedDesc,
      zip,
      answers:          answers ?? [],
      preview,
      paid:             false,
      followupCount:    0,
      followupMessages: [],
      chatMessages:     [],
      createdAt:        now,
      updatedAt:        now,
    })
  } catch (err) {
    console.error('[analyze] Redis write failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Session creation failed. Please try again.' },
      { status: 503 },
    )
  }

  const response: AnalyzeResponse = { sessionId, preview }
  return NextResponse.json(response, { status: 201 })
}
