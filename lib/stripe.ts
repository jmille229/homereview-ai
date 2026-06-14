import Stripe from 'stripe'
import type { Product } from './types'

// ─── Singleton client (server-side only) ──────────────────────────────────────

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error('STRIPE_SECRET_KEY environment variable is not set.')
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
  typescript: true,
})

// ─── Pricing ──────────────────────────────────────────────────────────────────

/** All amounts in cents (USD). */
export const PRICES: Record<Product, { amount: number; name: string; description: string }> = {
  brief: {
    amount: 1400,
    name: 'Diagnostic Brief',
    description:
      'Complete pre-quote analysis: diagnosis, cost guide, who to hire, and 8 contractor questions.',
  },
  shield: {
    amount: 3400,
    name: 'Quote Shield',
    description:
      'Post-quote analysis with line-by-line review, upsell detection, negotiation guide, and 60-day living report.',
  },
}
