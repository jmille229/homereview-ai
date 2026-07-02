import { describe, it, expect } from 'vitest'
import { sanitizeInput } from '@/lib/prompts'

describe('sanitizeInput (prompt-injection / runaway-input guard)', () => {
  it('strips HTML tags', () => {
    expect(sanitizeInput('hello <script>alert(1)</script> world')).toBe('hello alert(1) world')
    expect(sanitizeInput('<img src=x onerror=alert(1)>leak')).toBe('leak')
  })

  it('strips non-printable characters (control chars, escapes)', () => {
    expect(sanitizeInput('abc\x00\x07\x1bdef')).toBe('abcdef')
    expect(sanitizeInput('tab\tseparated')).toBe('tabseparated') // \t is outside \x20-\x7E
  })

  it('preserves newlines (multi-line descriptions stay readable)', () => {
    expect(sanitizeInput('line one\nline two')).toBe('line one\nline two')
  })

  it('enforces the length cap', () => {
    expect(sanitizeInput('x'.repeat(5000)).length).toBe(4000)
    expect(sanitizeInput('x'.repeat(50), 10)).toBe('x'.repeat(10))
  })

  it('trims surrounding whitespace', () => {
    expect(sanitizeInput('  padded  ')).toBe('padded')
  })

  it('keeps ordinary punctuation and dollar figures intact', () => {
    expect(sanitizeInput('Quoted $3,200 for a 3-ton unit (installed).'))
      .toBe('Quoted $3,200 for a 3-ton unit (installed).')
  })
})
