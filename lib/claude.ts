import Anthropic from '@anthropic-ai/sdk'
import type { ZodSchema } from 'zod'
import type { UploadedFile } from './types'

// ─── Singleton client (server-side only) ──────────────────────────────────────

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set.')
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

// ─── Model routing ────────────────────────────────────────────────────────────

/** Fast + cheap. Used for free previews. */
const HAIKU_MODEL = 'claude-haiku-4-5-20251001'

/** Highest quality. Used for paid full reports. */
const SONNET_MODEL = 'claude-sonnet-4-6'

/**
 * MED-02: Per-call timeout in milliseconds.
 *
 * Set conservatively below Vercel Pro's 60-second function limit so that
 * timeouts produce a clean error rather than a cryptic gateway failure.
 * Haiku is fast (typically 2–4s), Sonnet can take 15–25s under load.
 */
const TIMEOUT_MS = 55_000

// ─── Content block helpers ────────────────────────────────────────────────────

function buildFileContentBlocks(
  files: UploadedFile[],
): Anthropic.MessageParam['content'] {
  return files.map((f) => {
    if (f.type === 'application/pdf') {
      return {
        type: 'document' as const,
        source: {
          type: 'base64' as const,
          media_type: 'application/pdf' as const,
          data: f.data,
        },
      }
    }
    return {
      type: 'image' as const,
      source: {
        type: 'base64' as const,
        media_type: f.type as Anthropic.Base64ImageSource['media_type'],
        data: f.data,
      },
    }
  })
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

/**
 * Extracts and parses JSON from a Claude response.
 * Handles cases where the model wraps output in markdown fences despite instructions.
 */
function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {
    // Try: strip markdown fences
    const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/)
    if (fenceMatch?.[1]) {
      return JSON.parse(fenceMatch[1].trim())
    }
    // Try: extract outermost { } block
    const braceStart = trimmed.indexOf('{')
    const braceEnd = trimmed.lastIndexOf('}')
    if (braceStart !== -1 && braceEnd > braceStart) {
      return JSON.parse(trimmed.slice(braceStart, braceEnd + 1))
    }
    throw new Error('No valid JSON found in model response')
  }
}

// ─── Core caller ──────────────────────────────────────────────────────────────

interface CallClaudeOptions<T> {
  system: string
  userText: string
  files?: UploadedFile[]
  schema: ZodSchema<T>
  model?: 'haiku' | 'sonnet'
  maxTokens?: number
  retries?: number
}

/**
 * Makes an Anthropic API call, validates the JSON response with Zod,
 * and retries once on validation failure with a stricter re-prompt.
 *
 * MED-02 FIX: Each attempt is wrapped in an AbortController with a 55-second
 * timeout. This ensures that if the Anthropic API hangs, the serverless
 * function produces a clean timeout error rather than running until the
 * platform limit kills it — which would leave paid users with no report
 * and no clear recovery path.
 */
export async function callClaude<T>({
  system,
  userText,
  files = [],
  schema,
  model = 'sonnet',
  maxTokens = 2000,
  retries = 1,
}: CallClaudeOptions<T>): Promise<T> {
  const modelId = model === 'haiku' ? HAIKU_MODEL : SONNET_MODEL

  const userContent: Anthropic.MessageParam['content'] = [
    ...buildFileContentBlocks(files),
    { type: 'text', text: userText },
  ]

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const finalSystem =
      attempt > 0
        ? system +
          '\n\nCRITICAL: Your previous response did not match the required JSON schema. ' +
          'Return ONLY a valid JSON object. Nothing else. No explanation. No markdown.'
        : system

    // MED-02: Abort if the API call takes too long
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create(
        {
          model: modelId,
          max_tokens: maxTokens,
          system: finalSystem,
          messages: [{ role: 'user', content: userContent }],
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Claude API timed out after ${TIMEOUT_MS / 1000}s`)
        // Don't retry on timeout — the issue is likely systemic
        break
      }
      lastError = err instanceof Error ? err : new Error('Anthropic API error')
      continue
    } finally {
      clearTimeout(timer)
    }

    const textBlock = response.content.find((b) => b.type === 'text')
    if (!textBlock || textBlock.type !== 'text') {
      lastError = new Error('No text block in model response')
      continue
    }

    let parsed: unknown
    try {
      parsed = extractJson(textBlock.text)
    } catch (e) {
      lastError = e instanceof Error ? e : new Error('JSON parse failed')
      continue
    }

    const validation = schema.safeParse(parsed)
    if (!validation.success) {
      lastError = new Error(
        `Schema validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`,
      )
      continue
    }

    return validation.data
  }

  throw lastError ?? new Error('Claude call failed after retries')
}
