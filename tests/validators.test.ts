import { describe, it, expect } from 'vitest'
import {
  analyzeRequestSchema,
  generateReportRequestSchema,
  quotePreviewResultSchema,
  chatRequestSchema,
  adminRefundRequestSchema,
  adminSessionRequestSchema,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/validators'

const smallPdf = Buffer.from([0x25, 0x50, 0x44, 0x46, 0, 0, 0, 0]).toString('base64')
const fileOf = (size: number) => ({ name: 'q.pdf', type: 'application/pdf' as const, size, data: smallPdf })

describe('analyzeRequestSchema', () => {
  const base = {
    flow: 'post' as const,
    category: 'hvac' as const,
    description: 'My AC stopped cooling and the contractor quoted a full replacement.',
    zip: '94110',
    files: [fileOf(1000)],
    answers: [],
  }

  it('accepts a well-formed request', () => {
    expect(analyzeRequestSchema.safeParse(base).success).toBe(true)
  })

  it('rejects a too-short description', () => {
    expect(analyzeRequestSchema.safeParse({ ...base, description: 'too short' }).success).toBe(false)
  })

  it('rejects an invalid zip but allows empty', () => {
    expect(analyzeRequestSchema.safeParse({ ...base, zip: '9411' }).success).toBe(false)
    expect(analyzeRequestSchema.safeParse({ ...base, zip: '' }).success).toBe(true)
  })

  it('rejects more than 3 files', () => {
    const files = [fileOf(1000), fileOf(1000), fileOf(1000), fileOf(1000)]
    expect(analyzeRequestSchema.safeParse({ ...base, files }).success).toBe(false)
  })

  it('rejects a combined upload over the total cap', () => {
    // Two files each within the per-file cap but summing over MAX_TOTAL_UPLOAD_BYTES.
    const files = [fileOf(MAX_FILE_SIZE_BYTES), fileOf(MAX_FILE_SIZE_BYTES)]
    expect(analyzeRequestSchema.safeParse({ ...base, files }).success).toBe(false)
  })

  it('rejects a per-file size over the cap', () => {
    expect(analyzeRequestSchema.safeParse({ ...base, files: [fileOf(MAX_FILE_SIZE_BYTES + 1)] }).success).toBe(false)
  })
})

describe('generateReportRequestSchema (Stripe session id)', () => {
  it('accepts a valid checkout session id', () => {
    const ok = generateReportRequestSchema.safeParse({ stripeSessionId: 'cs_test_' + 'a'.repeat(40) })
    expect(ok.success).toBe(true)
  })
  it('rejects a malformed session id', () => {
    expect(generateReportRequestSchema.safeParse({ stripeSessionId: 'evil; DROP TABLE' }).success).toBe(false)
    expect(generateReportRequestSchema.safeParse({ stripeSessionId: 'cs_test_short' }).success).toBe(false)
  })
})

describe('quotePreviewResultSchema (teaser)', () => {
  const q = { label: 'Quote 1', quotedTotal: 1000 }
  it('requires exactly two quotes', () => {
    expect(quotePreviewResultSchema.safeParse({ quotes: [q, q], bestValueIndex: 0, hookLine: 'x'.repeat(12) }).success).toBe(true)
    expect(quotePreviewResultSchema.safeParse({ quotes: [q], bestValueIndex: 0, hookLine: 'x'.repeat(12) }).success).toBe(false)
  })
})

describe('chatRequestSchema', () => {
  const sid = '11111111-1111-4111-8111-111111111111'
  it('enforces message bounds', () => {
    expect(chatRequestSchema.safeParse({ sessionId: sid, message: 'hi', history: [] }).success).toBe(true)
    expect(chatRequestSchema.safeParse({ sessionId: sid, message: '', history: [] }).success).toBe(false)
    expect(chatRequestSchema.safeParse({ sessionId: sid, message: 'x'.repeat(2001), history: [] }).success).toBe(false)
  })
})

describe('admin schemas', () => {
  it('refund requires a valid stripe session id', () => {
    expect(adminRefundRequestSchema.safeParse({ stripeSessionId: 'cs_live_' + 'a'.repeat(40) }).success).toBe(true)
    expect(adminRefundRequestSchema.safeParse({ stripeSessionId: 'nope' }).success).toBe(false)
  })
  it('session lookup requires at least one selector', () => {
    expect(adminSessionRequestSchema.safeParse({}).success).toBe(false)
    expect(adminSessionRequestSchema.safeParse({ email: 'a@b.com' }).success).toBe(true)
  })
})
