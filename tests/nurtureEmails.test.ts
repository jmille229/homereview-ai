import { describe, it, expect } from 'vitest'
import {
  buildNurtureEmail,
  escapeHtml,
  hashEmail,
  nurtureDueAt,
  productForFlow,
  NURTURE_STEPS,
} from '@/lib/nurtureEmails'
import type { PreviewResult } from '@/lib/types'

const preview: PreviewResult = {
  summary:        'Your AC compressor is likely <failing> & short-cycling.',
  severity:       'Urgent',
  severityReason: 'Running it this way can burn out the compressor.',
  costMin:        1200,
  costMax:        3400,
  keyInsight:     'Ask whether a capacitor swap was tested first.',
}

const base = {
  flow:           'pre' as const,
  category:       'hvac' as const,
  preview,
  checkoutUrl:    'https://example.com/api/nurture/checkout?session=s&t=x',
  unsubscribeUrl: 'https://example.com/unsubscribe?e=h&t=y',
}

describe('nurture schedule', () => {
  it('sends the preview immediately, then follow-ups later', () => {
    expect(NURTURE_STEPS.map(s => s.key)).toEqual(['preview', 'tips', 'last-call'])
    const at = '2026-10-05T00:00:00.000Z'
    expect(nurtureDueAt(at, 0)).toBe(Date.parse(at))
    expect(nurtureDueAt(at, 1) - Date.parse(at)).toBe(24 * 3600 * 1000)
    expect(nurtureDueAt(at, 2) - Date.parse(at)).toBe(72 * 3600 * 1000)
  })

  it('maps flows to products', () => {
    expect(productForFlow('pre')).toBe('brief')
    expect(productForFlow('post')).toBe('shield')
  })

  it('hashes emails case- and whitespace-insensitively', () => {
    expect(hashEmail(' Me@Example.com ')).toBe(hashEmail('me@example.com'))
    expect(hashEmail('me@example.com')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('buildNurtureEmail', () => {
  it('escapes AI preview text in the preview email', () => {
    const { subject, html } = buildNurtureEmail({ ...base, step: 0 })
    expect(subject).toBe('Your HomeReview preview: HVAC')
    expect(html).toContain('&lt;failing&gt; &amp; short-cycling')
    expect(html).not.toContain('<failing>')
    expect(html).toContain('$1,200–$3,400')
  })

  it('uses short category names in subjects', () => {
    expect(buildNurtureEmail({ ...base, category: 'plumbing', flow: 'post', step: 1 }).subject)
      .toBe('What to check before you sign that plumbing quote')
    expect(buildNurtureEmail({ ...base, category: 'pest', step: 2 }).subject)
      .toBe('Still deciding on your pest and mold issue?')
  })

  it('always includes checkout and unsubscribe links', () => {
    for (let step = 0; step < NURTURE_STEPS.length; step++) {
      for (const flow of ['pre', 'post'] as const) {
        const { html } = buildNurtureEmail({ ...base, flow, step })
        expect(html).toContain(base.checkoutUrl)
        expect(html).toContain(base.unsubscribeUrl)
      }
    }
  })

  it('names the right product and price for each flow', () => {
    expect(buildNurtureEmail({ ...base, step: 1 }).html).toContain('Diagnostic Brief — $14')
    expect(buildNurtureEmail({ ...base, flow: 'post', step: 1 }).html).toContain('Quote Shield — $29')
  })

  it('adds the emergency line only for Emergency severity', () => {
    expect(buildNurtureEmail({ ...base, step: 0 }).html).not.toContain('safety emergency')
    const emergency = { ...preview, severity: 'Emergency' as const }
    expect(buildNurtureEmail({ ...base, preview: emergency, step: 0 }).html).toContain('safety emergency')
  })

  it('mentions the promo code and postal address only when configured', () => {
    const plain = buildNurtureEmail({ ...base, step: 2 }).html
    expect(plain).not.toContain('Use code')
    const withExtras = buildNurtureEmail({ ...base, step: 2, promoCode: 'SAVE5', postalAddress: '1 Main St' }).html
    expect(withExtras).toContain('SAVE5')
    expect(withExtras).toContain('1 Main St')
  })
})

describe('escapeHtml', () => {
  it('escapes the five HTML-significant characters', () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;')
  })
})
