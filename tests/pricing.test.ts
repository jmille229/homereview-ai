import { describe, it, expect } from 'vitest'
import { PRODUCT_PRICING, formatUsd, priceDisplay } from '@/lib/pricing'

describe('pricing (single source of truth)', () => {
  it('formats cents as clean USD', () => {
    expect(formatUsd(1400)).toBe('$14')
    expect(formatUsd(2900)).toBe('$29')
    expect(formatUsd(1250)).toBe('$12.50')
    expect(formatUsd(0)).toBe('$0')
  })

  it('derives the displayed price from the charged amount (cannot drift)', () => {
    for (const product of ['brief', 'shield'] as const) {
      expect(priceDisplay(product)).toBe(formatUsd(PRODUCT_PRICING[product].amountCents))
    }
  })

  it('pins the current prices', () => {
    expect(PRODUCT_PRICING.brief.amountCents).toBe(50)
    expect(PRODUCT_PRICING.shield.amountCents).toBe(50)
    expect(priceDisplay('brief')).toBe('$0.50')
    expect(priceDisplay('shield')).toBe('$0.50')
  })
})
