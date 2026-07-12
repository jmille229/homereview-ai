/**
 * Creates the two persistent Stripe Products used for coupon targeting.
 *
 * Run once, with your Stripe secret key (use the LIVE key for production):
 *   STRIPE_SECRET_KEY=sk_live_... npm run stripe:products
 *
 * Idempotent: it looks up existing products by a metadata tag (hr_product) and
 * reuses them, so re-running never creates duplicates. It does NOT set a price —
 * the charged amount is controlled in code (lib/pricing.ts); these Products exist
 * only so coupons can be restricted per product. It prints the Product IDs and
 * the exact env-var lines to add to Vercel.
 */
import Stripe from 'stripe'

const key = process.env.STRIPE_SECRET_KEY
if (!key) {
  console.error('Missing STRIPE_SECRET_KEY. Run: STRIPE_SECRET_KEY=sk_live_... npm run stripe:products')
  process.exit(1)
}

const stripe = new Stripe(key)

const PRODUCTS = [
  {
    hr: 'brief',
    envVar: 'STRIPE_PRODUCT_BRIEF',
    name: 'Diagnostic Brief',
    description: 'Complete pre-quote analysis: diagnosis, cost guide, who to hire, and 8 contractor questions.',
  },
  {
    hr: 'shield',
    envVar: 'STRIPE_PRODUCT_SHIELD',
    name: 'Quote Shield',
    description: 'Post-quote analysis with line-by-line review, upsell detection, negotiation guide, and 60-day living report.',
  },
]

async function run() {
  const mode = key.startsWith('sk_live_') ? 'LIVE' : 'TEST'
  console.log(`Using Stripe in ${mode} mode.\n`)

  // Pull existing products once (immediately consistent, unlike search).
  const existing = await stripe.products.list({ limit: 100 }).autoPagingToArray({ limit: 1000 })
  const results = []

  for (const p of PRODUCTS) {
    let product = existing.find((e) => e.metadata?.hr_product === p.hr)
    if (product) {
      console.log(`• reused ${p.name}: ${product.id}`)
    } else {
      product = await stripe.products.create({
        name: p.name,
        description: p.description,
        metadata: { hr_product: p.hr, pricing: 'controlled-in-code (lib/pricing.ts)' },
      })
      console.log(`✓ created ${p.name}: ${product.id}`)
    }
    results.push({ envVar: p.envVar, id: product.id })
  }

  console.log(`\nAdd these to Vercel → Environment Variables (Production), then redeploy:\n`)
  for (const r of results) console.log(`${r.envVar}=${r.id}`)
  console.log(`\nThen create coupons at https://dashboard.stripe.com/coupons and, if you want`)
  console.log(`them restricted, choose "Apply to specific products" and pick the product above.`)
}

run().catch((err) => {
  console.error('\nFailed:', err instanceof Error ? err.message : err)
  process.exit(1)
})
