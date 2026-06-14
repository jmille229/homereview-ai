import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { callClaudeConversation } from '@/lib/claude'
import { getSession, updateSession } from '@/lib/redis'
import { chatLimiter, getClientIp } from '@/lib/ratelimit'
import { buildChatSystem, sanitizeInput } from '@/lib/prompts'
import { chatRequestSchema, MAX_JSON_BYTES } from '@/lib/validators'
import type { ChatMessage, ChatResponse, StoredSession } from '@/lib/types'
import { getCategoryLabel } from '@/lib/constants'
import { hasValidAccess } from '@/lib/access'
import { parseJsonBody } from '@/lib/http'

export const runtime   = 'nodejs'
export const maxDuration = 30

const CHAT_DAYS: Record<string, number> = {
  brief:  30,
  shield: 60,
}

export async function POST(req: Request): Promise<NextResponse> {
  // ── Rate limit — dedicated chat limiter, not the report limiter ───────────
  // Chat is sold as "unlimited". The report limiter (20/day) would break that
  // promise. This limiter allows 200/day — enough for genuine use, blocks bots.
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success } = await chatLimiter.limit(ip)
  if (!success) {
    return NextResponse.json({ error: 'Too many requests.' }, { status: 429 })
  }

  // ── Parse and validate ─────────────────────────────────────────────────────
  const parsed = await parseJsonBody(req, MAX_JSON_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof chatRequestSchema.parse>
  try {
    data = chatRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  // ── Fetch and validate session ─────────────────────────────────────────────
  let session: StoredSession | null
  try {
    session = await getSession(data.sessionId)
  } catch {
    return NextResponse.json({ error: 'Service unavailable.' }, { status: 503 })
  }

  if (!session || !session.paid || !session.report) {
    return NextResponse.json({ error: 'Chat not available.' }, { status: 403 })
  }

  // ── Require a valid access cookie (payment-bound capability) ────────────────
  if (!hasValidAccess(data.sessionId)) {
    return NextResponse.json(
      { error: 'Access expired. Please reopen your report to continue.' },
      { status: 401 },
    )
  }

  // ── Check chat expiry window ───────────────────────────────────────────────
  const product    = session.product ?? 'brief'
  const chatDays   = CHAT_DAYS[product] ?? 30
  const chatDaysMs = chatDays * 24 * 60 * 60 * 1000
  const paidAt     = session.paidAt ?? session.createdAt

  if (Date.now() - new Date(paidAt).getTime() > chatDaysMs) {
    return NextResponse.json(
      { error: `The ${chatDays}-day chat window for this report has expired.` },
      { status: 403 },
    )
  }

  const sanitizedMessage = sanitizeInput(data.message, 2000)
  const categoryLabel    = getCategoryLabel(session.category)

  // ── Multi-turn conversation call ───────────────────────────────────────────
  // Pass the last 10 history messages as proper Anthropic conversation turns.
  // This gives Claude genuine memory of the conversation, not just the report.
  const recentHistory = data.history.slice(-10).map(m => ({
    role:    m.role as 'user' | 'assistant',
    content: m.content,
  }))

  let reply: string
  try {
    reply = await callClaudeConversation({
      system:  buildChatSystem(session.flow, categoryLabel, session.description, session.report),
      history: recentHistory,
      message: sanitizedMessage,
      model:   'sonnet',
      maxTokens: 600,
    })
  } catch (err) {
    console.error('[chat] Claude call failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    return NextResponse.json(
      { error: 'Could not generate a response. Please try again.' },
      { status: 502 },
    )
  }

  // ── Persist chat messages to Redis ─────────────────────────────────────────
  const now = new Date().toISOString()
  const newMessages: ChatMessage[] = [
    ...(session.chatMessages ?? []),
    { role: 'user',      content: sanitizedMessage, timestamp: now },
    { role: 'assistant', content: reply,             timestamp: now },
  ]

  // Cap at 100 stored messages (50 exchanges) to bound Redis storage growth
  const cappedMessages = newMessages.slice(-100)

  try {
    await updateSession(data.sessionId, { chatMessages: cappedMessages })
  } catch (err) {
    console.error('[chat] Redis update failed:', {
      message: err instanceof Error ? err.message : 'Unknown error',
    })
    // Don't fail the response — the reply was generated successfully.
  }

  const response: ChatResponse = { reply }
  return NextResponse.json(response)
}
