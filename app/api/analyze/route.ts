import { randomUUID } from 'crypto'
import { NextResponse } from 'next/server'
import { ZodError } from 'zod'

import { callClaude } from '@/lib/claude'
import { createSession, previewCacheKey, getCachedPreview, setCachedPreview } from '@/lib/redis'
import { previewLimiter, getClientIp } from '@/lib/ratelimit'
import { buildPreviewSystem, buildQuotePreviewTeaserSystem, sanitizeInput } from '@/lib/prompts'
import {
  analyzeRequestSchema,
  previewResultSchema,
  quotePreviewResultSchema,
  MAX_BODY_BYTES,
} from '@/lib/validators'
import type { AnalyzeResponse, ComparisonTeaser } from '@/lib/types'
import { getCategoryLabel, getRelatedAreaLabels, getRelatedAreaIds } from '@/lib/constants'
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

  // ── Rate limit ─────────────────────────────────────────────────────────────
  const ip = getClientIp(req)
  if (!ip) return NextResponse.json({ error: 'Request could not be verified.' }, { status: 400 })
  const { success, reset } = await previewLimiter.limit(ip)
  if (!success) {
    const retryAfterSeconds = Math.ceil((reset - Date.now()) / 1000)
    return NextResponse.json(
      { error: 'Too many preview requests. Please wait before trying again.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } },
    )
  }

  // ── Parse and validate (real-body size limit, not the Content-Length hint) ──
  const parsed = await parseJsonBody(req, MAX_BODY_BYTES)
  if (!parsed.ok) return parsed.res

  let data: ReturnType<typeof analyzeRequestSchema.parse>
  try {
    data = analyzeRequestSchema.parse(parsed.data)
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: err.issues[0]?.message ?? 'Invalid request.' },
        { status: 400 },
      )
    }
    return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })
  }

  const { flow, category, relatedAreas, description, zip, files, secondQuoteFiles, answers } = data

  // ── Reject files whose bytes don't match their declared type — keeps garbage
  //    out of the expensive vision call ──────────────────────────────────────
  if (!filesHaveValidSignatures(files)) {
    return NextResponse.json(
      { error: 'One or more files appear corrupted or are not a supported image/PDF.' },
      { status: 400 },
    )
  }
  // A free comparison teaser only makes sense for the post-quote flow with both
  // a primary quote and a second quote present.
  const wantsTeaser = flow === 'post' && files.length > 0 && !!secondQuoteFiles && secondQuoteFiles.length > 0
  if (secondQuoteFiles && secondQuoteFiles.length > 0 && !filesHaveValidSignatures(secondQuoteFiles)) {
    return NextResponse.json(
      { error: 'The second quote appears corrupted or is not a supported image/PDF.' },
      { status: 400 },
    )
  }

  // ── Global daily ceiling — circuit breaker against distributed cost-DoS ────
  if (!(await consumeDailyBudget('preview'))) {
    return NextResponse.json(
      { error: 'We are experiencing unusually high demand. Please try again later.' },
      { status: 503 },
    )
  }
  const categoryLabel = getCategoryLabel(category)
  const relatedLabels = getRelatedAreaLabels(category, relatedAreas)
  const sanitizedDesc = sanitizeInput(description)

  // ── Build user text — include clarifying answers if provided ───────────────
  const answersContext = answers.length > 0
    ? '\n\nClarifying answers from homeowner:\n' +
      answers
        .map(a => `Q: ${a.question}\nA: ${sanitizeInput(a.answer, 500)}`)
        .join('\n\n')
    : ''

  const userText = `Issue description: ${sanitizedDesc}${answersContext}\nZip code: ${zip || 'Not provided'}`

  // ── Deterministic cache — identical inputs return the identical preview ─────
  // (so the severity rating never varies for the same input). Keyed on the
  // normalized inputs that actually drive the analysis.
  const cacheKey = previewCacheKey(JSON.stringify({
    flow,
    category,
    relatedAreas: [...relatedLabels].sort(),
    description: sanitizedDesc,
    zip,
    answers: answers.map(a => ({ q: a.question, a: sanitizeInput(a.answer, 500) })),
    files:   files.map(f => f.data),
  }))

  let preview: ReturnType<typeof previewResultSchema.parse> | null = null
  try { preview = await getCachedPreview(cacheKey) } catch { /* cache miss is fine */ }

  if (!preview) {
    try {
      preview = await callClaude({
        system:    buildPreviewSystem(flow, categoryLabel, relatedLabels),
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
    try { await setCachedPreview(cacheKey, preview) } catch { /* non-fatal */ }
  }

  // ── Free comparison teaser (second quote uploaded) ─────────────────────────
  // Thin by design: totals + a best-value hint. Best-effort — a teaser failure
  // must never block the (already generated) single-quote preview.
  let comparisonTeaser: ComparisonTeaser | undefined
  if (wantsTeaser && secondQuoteFiles) {
    try {
      const teaser = await callClaude({
        system:    buildQuotePreviewTeaserSystem(categoryLabel, zip),
        userText:  'Compare the two attached contractor quotes (first = Quote 1, second = Quote 2).',
        files:     [...files, ...secondQuoteFiles],
        schema:    quotePreviewResultSchema,
        model:     'sonnet',
        maxTokens: 400,
      })
      const idx = Math.min(teaser.bestValueIndex, teaser.quotes.length - 1)
      comparisonTeaser = {
        quotes:         teaser.quotes,
        bestValueIndex: idx,
        bestValueLabel: teaser.quotes[idx].label,
        hookLine:       teaser.hookLine,
      }
    } catch (err) {
      console.error('[analyze] Comparison teaser failed (non-fatal):', {
        message: err instanceof Error ? err.message : 'Unknown error',
      })
    }
  }

  // ── Persist session to Redis ───────────────────────────────────────────────
  const sessionId = randomUUID()
  const now       = new Date().toISOString()

  try {
    await createSession({
      id:               sessionId,
      flow,
      category,
      relatedAreas:     getRelatedAreaIds(category, relatedAreas),
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

  const response: AnalyzeResponse = { sessionId, preview, comparisonTeaser }
  return NextResponse.json(response, { status: 201 })
}
