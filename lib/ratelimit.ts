import { Ratelimit } from '@upstash/ratelimit'
import { redis } from './redis'

/**
 * Preview endpoint: 5 requests per IP per hour.
 * Protects against abuse of the free AI-powered preview.
 */
export const previewLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
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
 * Extracts the real client IP from the request headers.
 *
 * SECURITY: Only `x-real-ip` is trusted. On Vercel this header is injected
 * by edge infrastructure and cannot be spoofed by clients. We deliberately
 * do NOT fall back to `x-forwarded-for` because that header is client-supplied
 * and trivially spoofed — an attacker could rotate through arbitrary IPs and
 * bypass all rate limiting.
 *
 * In development, a fixed string is returned so rate limiting does not
 * interfere with local testing.
 */
export function getClientIp(req: Request): string {
  if (process.env.NODE_ENV === 'development') return '127.0.0.1'
  return req.headers.get('x-real-ip') ?? 'unknown'
}
