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

const HAIKU_MODEL  = 'claude-haiku-4-5-20251001'
const SONNET_MODEL = 'claude-sonnet-4-6'
const TIMEOUT_MS   = 90_000  // 90s: empirically confirmed Sonnet takes >45s; 90s fits within 120s maxDuration

// ─── Content block helpers ────────────────────────────────────────────────────

function buildFileContentBlocks(files: UploadedFile[]): unknown[] {
  return files.map((f) => {
    if (f.type === 'application/pdf') {
      return {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: f.data },
      }
    }
    return {
      type: 'image',
      source: { type: 'base64', media_type: f.type, data: f.data },
    }
  })
}

// ─── JSON extraction ──────────────────────────────────────────────────────────

function extractJson(text: string): unknown {
  const trimmed = text.trim()
  try { return JSON.parse(trimmed) } catch { /* fall through */ }
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]+?)```/)
  if (fenceMatch?.[1]) return JSON.parse(fenceMatch[1].trim())
  const braceStart = trimmed.indexOf('{')
  const braceEnd   = trimmed.lastIndexOf('}')
  if (braceStart !== -1 && braceEnd > braceStart) {
    return JSON.parse(trimmed.slice(braceStart, braceEnd + 1))
  }
  throw new Error('No valid JSON found in model response')
}

// ─── Single-turn call (JSON output required) ──────────────────────────────────

interface CallClaudeOptions<T> {
  system: string
  userText: string
  files?: UploadedFile[]
  schema: ZodSchema<T>
  model?: 'haiku' | 'sonnet'
  maxTokens?: number
  retries?: number
  /** Per-call abort timeout. Defaults to TIMEOUT_MS. Callers that chain multiple
   *  calls under one serverless function budget pass a smaller value so the
   *  second call can't overrun the function's maxDuration. */
  timeoutMs?: number
}

/**
 * Makes a single-turn Anthropic API call and validates the JSON response.
 * Retries once on schema validation failure with a stricter prompt.
 * Aborts after TIMEOUT_MS to prevent serverless function overruns.
 */
export async function callClaude<T>({
  system,
  userText,
  files = [],
  schema,
  model = 'sonnet',
  maxTokens = 2000,
  retries = 1,
  timeoutMs = TIMEOUT_MS,
}: CallClaudeOptions<T>): Promise<T> {
  const modelId = model === 'haiku' ? HAIKU_MODEL : SONNET_MODEL

  const userContent = [
    ...buildFileContentBlocks(files),
    { type: 'text', text: userText },
  ] as Anthropic.MessageParam['content']

  let lastError: Error | null = null

  for (let attempt = 0; attempt <= retries; attempt++) {
    const finalSystem = attempt > 0
      ? system + '\n\nCRITICAL: Return ONLY a valid JSON object. No markdown. No explanation.'
      : system

    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create(
        {
          model:       modelId,
          max_tokens:  maxTokens,
          temperature: 0,    // structured JSON output — temperature 0 for maximum
                             // determinism so the same input yields the same result
          system:      finalSystem,
          messages:    [{ role: 'user', content: userContent }],
        },
        { signal: controller.signal },
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Claude API timed out after ${timeoutMs / 1000}s`)
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
    try { parsed = extractJson(textBlock.text) } catch (e) {
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

// ─── Multi-turn conversational call ───────────────────────────────────────────

export interface ConversationMessage {
  role:    'user' | 'assistant'
  content: string
}

interface CallClaudeConversationOptions {
  system:   string
  history:  ConversationMessage[]  // prior turns, in order
  message:  string                 // the new user message
  model?:   'haiku' | 'sonnet'
  maxTokens?: number
}

/**
 * Makes a multi-turn Anthropic API call for conversational features (chat).
 * Unlike callClaude, this does NOT require JSON output — it returns raw text.
 * History is included as prior Anthropic message turns so Claude has full
 * conversational context.
 */
export async function callClaudeConversation({
  system,
  history,
  message,
  model     = 'haiku',
  maxTokens = 600,
}: CallClaudeConversationOptions): Promise<string> {
  const modelId = model === 'haiku' ? HAIKU_MODEL : SONNET_MODEL

  // Build the full message array: prior history + new user message
  const messages: Anthropic.MessageParam[] = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ]

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

  let response: Anthropic.Message
  try {
    response = await anthropic.messages.create(
      {
        model:       modelId,
        max_tokens:  maxTokens,
        temperature: 0.7,  // higher temperature for conversational chat — natural variation is desirable
        system,
        messages,
      },
      { signal: controller.signal },
    )
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new Error(`Chat API timed out after ${TIMEOUT_MS / 1000}s`)
    }
    throw err instanceof Error ? err : new Error('Anthropic API error')
  } finally {
    clearTimeout(timer)
  }

  const textBlock = response.content.find((b) => b.type === 'text')
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('No text block in chat response')
  }

  return textBlock.text.trim()
}
