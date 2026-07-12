import Stripe from 'stripe'
import type { Product } from './types'
import { PRODUCT_PRICING } from './pricing'

// ─── Singleton client (server-side only) ──────────────────────────────────────

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
})

// ─── Pricing ──────────────────────────────────────────────────────────────────

/** All amounts in cents (USD). Amount + name come from the single pricing source
 *  (lib/pricing.ts); only the Stripe-facing description lives here. */
export const PRICES: Record<Product, { amount: number; name: string; description: string }> = {
  brief: {
    amount: PRODUCT_PRICING.brief.amountCents,
    name:   PRODUCT_PRICING.brief.name,
    description:
      'Complete pre-quote analysis: diagnosis, cost guide, who to hire, and 8 contractor questions.',
  },
  shield: {
    amount: PRODUCT_PRICING.shield.amountCents,
    name:   PRODUCT_PRICING.shield.name,
    description:
      'Post-quote analysis with line-by-line review, upsell detection, negotiation guide, and 60-day living report.',
  },
}

/**
 * Optional persistent Stripe Product IDs (prod_…), one per product.
 *
 * When set, checkout ties the line item to this catalog Product so coupons can
 * be restricted to a specific product (and reporting is cleaner). The charged
 * AMOUNT still comes from PRICES above (single source of truth) — the Product is
 * used purely for identity, not price. When unset, checkout falls back to an
 * inline ad-hoc product, so promotion codes still work order-wide.
 */
export const STRIPE_PRODUCT_IDS: Record<Product, string | undefined> = {
  brief:  process.env.STRIPE_PRODUCT_BRIEF,
  shield: process.env.STRIPE_PRODUCT_SHIELD,
}
