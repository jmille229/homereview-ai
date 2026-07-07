import type { Product } from './enums'

/**
 * lib/pricing.ts — the SINGLE SOURCE OF TRUTH for product pricing.
 *
 * `amountCents` is what Stripe charges; the displayed price is DERIVED from it
 * (never hand-typed), so the price a customer sees can't drift from the price
 * they're charged. This module is intentionally dependency-free (no Stripe SDK,
 * no env reads) so it is safe to import from client components too.
 */

export interface ProductPricing {
  /** Amount charged at checkout, in cents (USD). */
  amountCents: number
  name:        string
  /** Access / living-report / chat window, in days. */
  accessDays:  number
}

export const PRODUCT_PRICING: Record<Product, ProductPricing> = {
  brief:  { amountCents: 50, name: 'Diagnostic Brief', accessDays: 30 },
  shield: { amountCents: 50, name: 'Quote Shield',     accessDays: 60 },
}

/** Formats cents as a clean USD string: whole dollars show no decimals
 *  ("$14", "$29"), fractional amounts show cents ("$12.50"). */
export function formatUsd(cents: number): string {
  const hasCents = cents % 100 !== 0
  const str = (cents / 100).toLocaleString('en-US', {
    minimumFractionDigits: hasCents ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `$${str}`
}

/** The displayed price for a product, derived from the charged amount. */
export function priceDisplay(product: Product): string {
  return formatUsd(PRODUCT_PRICING[product].amountCents)
}
