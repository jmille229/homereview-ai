import { describe, it, expect } from 'vitest'
import { readLimitedJson, BodyTooLargeError } from '@/lib/http'

function post(body: string, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/test', { method: 'POST', body, headers })
}

describe('readLimitedJson (real-body size limit)', () => {
  it('parses a small valid body', async () => {
    await expect(readLimitedJson(post('{"a":1}'), 1024)).resolves.toEqual({ a: 1 })
  })

  it('rejects when the ACTUAL body exceeds the cap (Content-Length lies)', async () => {
    const big = JSON.stringify({ pad: 'x'.repeat(2048) })
    // Understate the declared length — the real-bytes check must still catch it.
    const req = post(big, { 'content-length': '10' })
    await expect(readLimitedJson(req, 1024)).rejects.toBeInstanceOf(BodyTooLargeError)
  })

  it('rejects early on an honest oversized Content-Length', async () => {
    const req = post('{}', { 'content-length': String(10_000_000) })
    await expect(readLimitedJson(req, 1024)).rejects.toBeInstanceOf(BodyTooLargeError)
  })

  it('counts multi-byte characters by bytes, not chars', async () => {
    // 400 four-byte emoji = 1600 bytes but only 800 UTF-16 code units.
    const emoji = '"' + '🏠'.repeat(400) + '"'
    await expect(readLimitedJson(post(emoji), 1000)).rejects.toBeInstanceOf(BodyTooLargeError)
  })

  it('throws SyntaxError on malformed JSON (caller maps to 400)', async () => {
    await expect(readLimitedJson(post('not json'), 1024)).rejects.toBeInstanceOf(SyntaxError)
  })

  it('returns undefined for an empty body', async () => {
    await expect(readLimitedJson(post(''), 1024)).resolves.toBeUndefined()
  })
})
