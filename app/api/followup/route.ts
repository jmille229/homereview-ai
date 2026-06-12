import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { callClaude } from '@/lib/claude'
import { getSession, updateSession } from '@/lib/redis'
import { reportLimiter, getClientIp } from '@/lib/ratelimit'
import { buildFollowupSystem, sanitizeInput } from '@/lib/prompts'
import {
  followupRequestSchema,
  followupResultSchema,
  MAX_FOLLOWUP_QUESTIONS,
  MAX_JSON_BYTES,
} from '@/lib/validators'
import type { FollowupResponse, StoredSession } from '@/lib/types'
import { getCategoryLabel } from '@/lib/constants'
import { parseJsonBody } from '@/lib/http'

export const runtime = 'nodejs'

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await reportLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof followupRequestSchema.parse>
  try {
    data = followupRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // ── Fetch session ──────────────────────────────────────────────────────────
  let session: StoredSession | null
  try {
    session = await getSession(data.sessionId)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  if (!session) {
    return NextResponse.json({ error: 'Session not found.' }, { status: 404 })
  }

  // Paid users should use the chat endpoint, not followup
  if (session.paid) {
    return NextResponse.json(
      { error: 'Please use the chat feature in your full report.' },
      { status: 403 },
    )
  }

  // ── Enforce the free question limit server-side ────────────────────────────
  const currentCount = session.followupCount ?? 0
  if (currentCount >= MAX_FOLLOWUP_QUESTIONS) {
    return NextResponse.json(
      { error: 'Free questions exhausted. Purchase the full report to continue.' },
      { status: 403 },
    )
  }

  const sanitizedQuestion = sanitizeInput(data.question, 1000)
  const categoryLabel     = getCategoryLabel(session.category)

  // ── Generate answer ────────────────────────────────────────────────────────
  let result: ReturnType<typeof followupResultSchema.parse>
  try {
    result = await callClaude({
      system: buildFollowupSystem(
        session.flow,
        categoryLabel,
        session.description,
        (session.answers ?? []).map(a => ({ question: a.question, answer: a.answer })),
        session.preview,
      ),
      userText:  `Follow-up question: ${sanitizedQuestion}`,
      schema:    followupResultSchema,
      model:     'sonnet',
      maxTokens: 500,
    })
  } catch (err) {
    console.error('[followup] Claude call failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Could not generate an answer. Please try again.' },
      { status: 502 },
    )
  }

  // ── Persist updated count and message ──────────────────────────────────────
  const newCount = currentCount + 1
  const newMessages = [
    ...(session.followupMessages ?? []),
    {
      question:  sanitizedQuestion,
      answer:    result.answer,
      timestamp: new Date().toISOString(),
    },
  ]

  try {
    await updateSession(data.sessionId, {
      followupCount:    newCount,
      followupMessages: newMessages,
    })
  } catch (err) {
    console.error('[followup] Redis update failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    // Don't fail the response — the answer was generated. The count may drift
    // by at most 1 in the rare Redis failure case, which is acceptable.
  }

  const questionsRemaining = Math.max(0, MAX_FOLLOWUP_QUESTIONS - newCount)
  const response: FollowupResponse = { answer: result.answer, questionsRemaining }
  return NextResponse.json(response)
}
