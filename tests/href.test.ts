import { describe, it, expect } from 'vitest'
import { isSafeLinkHref } from '@/sanity/lib/href'

describe('isSafeLinkHref (CMS link XSS guard)', () => {
  it('allows same-site paths', () => {
    expect(isSafeLinkHref('/intake')).toBe(true)
    expect(isSafeLinkHref('/learn/some-guide')).toBe(true)
  })

  it('allows http(s), mailto, tel', () => {
    expect(isSafeLinkHref('https://example.com')).toBe(true)
    expect(isSafeLinkHref('http://example.com/x')).toBe(true)
    expect(isSafeLinkHref('mailto:support@homereviewai.com')).toBe(true)
    expect(isSafeLinkHref('tel:+15551234567')).toBe(true)
  })

  it('blocks javascript: and other script-executing schemes', () => {
    expect(isSafeLinkHref('javascript:alert(1)')).toBe(false)
    expect(isSafeLinkHref('JavaScript:alert(1)')).toBe(false)
    expect(isSafeLinkHref(' javascript:alert(1)')).toBe(false) // leading space
    expect(isSafeLinkHref('data:text/html,<script>alert(1)</script>')).toBe(false)
    expect(isSafeLinkHref('vbscript:msgbox(1)')).toBe(false)
  })

  it('blocks protocol-relative //host (open-redirect / off-site)', () => {
    expect(isSafeLinkHref('//evil.com')).toBe(false)
    expect(isSafeLinkHref('//evil.com/path')).toBe(false)
  })

  it('blocks empty / bare values', () => {
    expect(isSafeLinkHref('')).toBe(false)
    expect(isSafeLinkHref('   ')).toBe(false)
    expect(isSafeLinkHref('evil.com')).toBe(false) // no scheme, not a path
  })
})
