import Anthropic from '@anthropic-ai/sdk'
import type { ZodSchema } from 'zod'
import type { UploadedFile } from './types'

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set.')
}

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const HAIKU_MODEL  = 'claude-haiku-4-5-20251001'
const SONNET_MODEL = 'claude-sonnet-4-6'
const TIMEOUT_MS   = 55_000

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

interface CallClaudeOptions<T> {
  system: string
  userText: string
  files?: UploadedFile[]
  schema: ZodSchema<T>
  model?: 'haiku' | 'sonnet'
  maxTokens?: number
  retries?: number
}

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

  // Cast to any[] to work around SDK type definitions not including document blocks
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
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)

    let response: Anthropic.Message
    try {
      response = await anthropic.messages.create(
        { model: modelId, max_tokens: maxTokens, system: finalSystem,
          messages: [{ role: 'user', content: userContent }] },
        { signal: controller.signal },
      )
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        lastError = new Error(`Claude API timed out after ${TIMEOUT_MS / 1000}s`)
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
        `Schema validation failed: ${validation.error.issues.map((i) => i.message).join(', ')}`
      )
      continue
    }

    return validation.data
  }

  throw lastError ?? new Error('Claude call failed after retries')
}
