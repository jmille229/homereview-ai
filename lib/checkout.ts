import type Stripe from 'stripe'

import { stripe, PRICES, STRIPE_PRODUCT_IDS } from './stripe'
import type { Product } from './types'

/**
 * Creates the Stripe Checkout Session for a report. Shared by the in-app
 * purchase button (/api/checkout) and the one-click link in nurture emails
 * (/api/nurture/checkout). Callers have already validated that the session
 * exists, is unpaid, and matches the product.
 */
export async function createReportCheckout(args: {
  baseUrl:        string
  sessionId:      string
  product:        Product
  /** Prefills the email field at checkout (e.g. the lead email from the preview). */
  customerEmail?: string
  /** Where Stripe's back button goes. Defaults to the in-app preview page. */
  cancelPath?:    string
}): Promise<Stripe.Checkout.Session> {
  const { baseUrl, sessionId, product, customerEmail, cancelPath = '/preview' } = args
  const price     = PRICES[product]
  const productId = STRIPE_PRODUCT_IDS[product]

  // Tie the line item to a persistent Stripe Product when configured (enables
  // product-specific coupons); otherwise create an inline ad-hoc product. Either
  // way the amount comes from our PRICES map, not from a Stripe-managed Price.
  const priceData: Stripe.Checkout.SessionCreateParams.LineItem.PriceData = {
    currency:    'usd',
    unit_amount: price.amount,
    ...(productId
      ? { product: productId }
      : { product_data: { name: price.name, description: price.description } }),
  }

  return stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    mode: 'payment',
    // Show the "Add promotion code" field so buyers can redeem coupon codes.
    allow_promotion_codes: true,
    line_items: [{ price_data: priceData, quantity: 1 }],
    ...(customerEmail ? { customer_email: customerEmail } : {}),
    // Stripe appends {CHECKOUT_SESSION_ID} automatically
    success_url: `${baseUrl}/success?stripe_session_id={CHECKOUT_SESSION_ID}&product=${product}`,
    cancel_url: `${baseUrl}${cancelPath}`,
    metadata: {
      reportSessionId: sessionId,
      product,
    },
  })
}
