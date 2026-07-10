import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

/**
 * Preview endpoint: 20 requests per IP per hour.
 * Protects against abuse of the free AI-powered preview.
 */
export const previewLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 h'),
  analytics: false,
  prefix: 'hr:preview',
})

/**
 * Report generation: 20 requests per IP per day.
 * Paid feature — more generous, but still protected against scripted abuse.
 */
export const reportLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, '1 d'),
  analytics: false,
  prefix: 'hr:report',
})

/**
 * Checkout: 10 requests per IP per hour.
 * Prevents Stripe session spam.
 */
export const checkoutLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: false,
  prefix: 'hr:checkout',
})

/**
 * Chat endpoint: 200 requests per IP per day.
 *
 * Chat is sold as "unlimited" — this limit exists only to prevent automated
 * abuse (bots, scripted crawlers). A genuine user having an active conversation
 * will not hit 200 messages in a day. Using a separate limiter ensures that
 * chat usage never eats into the report generation quota.
 */
export const chatLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(200, '1 d'),
  analytics: false,
  prefix: 'hr:chat',
})

/**
 * Reclaim endpoint: 10 attempts per IP per hour.
 *
 * Access reclaim verifies the payer's checkout email. This limit blunts
 * email-guessing attempts against a known session URL.
 */
export const reclaimLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: false,
  prefix: 'hr:reclaim',
})

/**
 * Status polling endpoint: 600 requests per IP per hour.
 *
 * Two independent pollers now hit this endpoint: the success page (every 2s for
 * up to 90s, ~45 reqs) AND the report page's comparison-pending poll (every 3s
 * for up to 2 min, ~40 reqs). Bumped from 300 to 600 so a buyer who refreshes or
 * opens the report in two tabs doesn't 429 their own polls. (M-4)
 */
export const statusLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(600, '1 h'),
  analytics: false,
  prefix: 'hr:status',
})

/**
 * Report recovery (email → all of that email's reports): 5 attempts per IP/hour.
 *
 * Dedicated bucket (not shared with reclaim) and deliberately tight: this is the
 * email-only path, so a looser limit would aid enumeration. (#4)
 */
export const recoverLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  analytics: false,
  prefix: 'hr:recover',
})

/**
 * Sanity revalidation webhook: 60 requests per IP per minute.
 *
 * The endpoint is secret-gated, so this is a blast-radius cap for a leaked
 * secret (or a bulk-publish storm): each call invalidates the Learn ISR cache,
 * and because the read client is useCdn:false, the next visitor's render fetches
 * Sanity's uncached API. Without a cap, a loop could keep the caches perpetually
 * cold and fan every visitor out to the rate-limited Sanity API. 60/min
 * comfortably covers legitimate publishing while bounding abuse.
 */
export const revalidateLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(60, '1 m'),
  analytics: false,
  prefix: 'hr:revalidate',
})

/**
 * Admin endpoints (refund / session lookup): 10 requests per IP per hour.
 *
 * The admin secret is already strong + constant-time compared, but an
 * unthrottled endpoint invites online guessing and refund abuse if it ever
 * leaks. Defense-in-depth. (#5)
 */
export const adminLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: false,
  prefix: 'hr:admin',
})

/**
 * Extracts the real client IP from the request headers.
 *
 * SECURITY: Only `x-real-ip` is trusted. On Vercel this header is injected
 * by edge infrastructure and cannot be spoofed by clients. We deliberately
 * do NOT fall back to `x-forwarded-for` because that header is client-supplied
 * and trivially spoofed — an attacker could rotate through arbitrary IPs and
 * bypass all rate limiting.
 *
 * Returns null when the IP cannot be resolved in a non-dev environment. Callers
 * MUST reject in that case (fail closed): previously a missing header collapsed
 * every such request into one shared `'unknown'` bucket, which both locks out
 * legitimate users and lets an attacker escape per-IP accounting.
 *
 * In development, a fixed string is returned so rate limiting does not
 * interfere with local testing.
 */
export function getClientIp(req: Request): string | null {
  if (process.env.NODE_ENV === 'development') return '127.0.0.1'
  return req.headers.get('x-real-ip')
}
