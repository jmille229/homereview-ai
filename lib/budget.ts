import { redis } from './redis'
import { sendOpsAlert } from './email'

/**
 * Global daily spend ceiling — a circuit breaker independent of per-IP limits.
 *
 * Per-IP rate limiting does nothing against an attacker rotating through many
 * IPs. This caps the TOTAL number of expensive AI operations per UTC day across
 * all callers, so a distributed flood can only ever cost a bounded amount before
 * the pipeline sheds load (503) until the next day.
 *
 * Caps are env-overridable so they can be tuned without a deploy.
 */

interface BudgetConfig {
  bucket: string
  envVar: string
  defaultCap: number
}

const BUDGETS = {
  preview:   { bucket: 'preview',   envVar: 'DAILY_PREVIEW_CEILING',   defaultCap: 5000 },
  questions: { bucket: 'questions', envVar: 'DAILY_QUESTIONS_CEILING', defaultCap: 8000 },
} satisfies Record<string, BudgetConfig>

export type BudgetName = keyof typeof BUDGETS

function capFor(cfg: BudgetConfig): number {
  const raw = process.env[cfg.envVar]
  const parsed = raw ? Number(raw) : NaN
  return Number.isFinite(parsed) && parsed > 0 ? parsed : cfg.defaultCap
}

/**
 * Atomically consumes one unit of the named daily budget.
 * Returns true if the request is within budget, false if the ceiling is hit.
 *
 * Fails OPEN: if Redis is unreachable we allow the request rather than take the
 * whole product down — per-IP limits and the bot gate are still in force.
 */
export async function consumeDailyBudget(name: BudgetName): Promise<boolean> {
  const cfg = BUDGETS[name]
  const day = new Date().toISOString().slice(0, 10) // UTC YYYY-MM-DD
  const key = `budget:${cfg.bucket}:${day}`
  const cap = capFor(cfg)
  try {
    const count = await redis.incr(key)
    if (count === 1) {
      // First write today — expire after 48h so old buckets self-clean.
      await redis.expire(key, 60 * 60 * 48)
    }
    // Alert once, on the request that first crosses the ceiling.
    if (count === cap + 1) {
      void sendOpsAlert(
        `Daily ${cfg.bucket} ceiling reached`,
        `The '${cfg.bucket}' daily ceiling of ${cap} was reached on ${day}. ` +
        `Further ${cfg.bucket} requests are being shed until tomorrow (UTC).`,
      )
    }
    return count <= cap
  } catch {
    return true
  }
}
