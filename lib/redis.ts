import { Redis } from '@upstash/redis'
import { createHash, randomUUID } from 'crypto'
import type { StoredSession, PreviewResult, ComparisonTeaser } from './types'

// ─── Singleton client ─────────────────────────────────────────────────────────

if (!process.env.UPSTASH_REDIS_REST_URL) {
  throw new Error('UPSTASH_REDIS_REST_URL environment variable is not set.')
}
if (!process.env.UPSTASH_REDIS_REST_TOKEN) {
  throw new Error('UPSTASH_REDIS_REST_TOKEN environment variable is not set.')
}

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// ─── Key helpers ──────────────────────────────────────────────────────────────

const sessionKey  = (id: string) => `session:${id}`
const lockKey     = (id: string) => `lock:session:${id}`

// ─── TTL constants ────────────────────────────────────────────────────────────

/** Quote Shield sessions live for 60 days to support living report updates. */
export const SHIELD_TTL_SECONDS = 60 * 60 * 24 * 60

/** Diagnostic Brief sessions live for 30 days. */
export const BRIEF_TTL_SECONDS = 60 * 60 * 24 * 30

/** How long a session write-lock is held before auto-expiring (safety valve). */
const LOCK_TTL_SECONDS = 10

/**
 * Fenced unlock: only delete the lock if WE still own it (value matches the
 * token we set). Prevents the classic hazard where lock A expires by TTL, holder
 * B acquires it, and A's late release() then deletes B's lock — silently breaking
 * mutual exclusion exactly under the load where it matters. (MED-02)
 */
const RELEASE_IF_OWNER = `if redis.call("get", KEYS[1]) == ARGV[1] then return redis.call("del", KEYS[1]) else return 0 end`

async function releaseOwnedLock(key: string, token: string): Promise<void> {
  try { await redis.eval(RELEASE_IF_OWNER, [key], [token]) } catch { /* lock will expire on its TTL */ }
}

// ─── Redis lock helper ────────────────────────────────────────────────────────

/**
 * Acquires an exclusive write-lock on a session key using SET NX with a unique
 * owner token. Returns a fenced release function. Throws if the lock cannot be
 * acquired, indicating a concurrent write is in progress.
 *
 * SECURITY (CRIT-02 / MED-01): Prevents race conditions on payment
 * verification and living-report updates where two simultaneous requests
 * could read the same stale state, both apply their writes, and the last
 * write silently discards the other.
 */
async function acquireLock(id: string): Promise<() => Promise<void>> {
  const key = lockKey(id)
  const token = randomUUID()
  const acquired = await redis.set(key, token, { nx: true, ex: LOCK_TTL_SECONDS })
  if (!acquired) {
    throw new Error('LOCK_CONTENTION: Session is locked by a concurrent operation.')
  }
  return () => releaseOwnedLock(key, token)
}

// ─── Session operations ───────────────────────────────────────────────────────

export async function createSession(session: StoredSession): Promise<void> {
  const ttl = session.flow === 'post' ? SHIELD_TTL_SECONDS : BRIEF_TTL_SECONDS
  await redis.set(sessionKey(session.id), session, { ex: ttl })
}

export async function getSession(id: string): Promise<StoredSession | null> {
  const session = await redis.get<StoredSession>(sessionKey(id))
  return session ?? null
}

/**
 * Atomically reads, merges a patch, and writes a session back to Redis.
 *
 * FIX (MED-01): Uses a Redis SET NX lock to prevent concurrent writers from
 * clobbering each other's updates.
 *
 * FIX (LOW-01): The TTL is calculated from the session's original createdAt
 * time rather than being reset to the full window on every write. This
 * prevents sessions from living indefinitely through frequent updates.
 */
export async function updateSession(
  id: string,
  patch: Partial<StoredSession>,
): Promise<StoredSession | null> {
  const release = await acquireLock(id)
  try {
    const existing = await getSession(id)
    if (!existing) return null

    const updated: StoredSession = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    }

    // LOW-01: Preserve the original TTL window — don't reset it on every write.
    const fullTtlSeconds = existing.flow === 'post' ? SHIELD_TTL_SECONDS : BRIEF_TTL_SECONDS
    const ageSeconds = Math.floor(
      (Date.now() - new Date(existing.createdAt).getTime()) / 1000,
    )
    const remainingSeconds = Math.max(fullTtlSeconds - ageSeconds, 60)

    await redis.set(sessionKey(id), updated, { ex: remainingSeconds })
    return updated
  } finally {
    await release()
  }
}

/**
 * Atomically reads the CURRENT session inside the lock, applies a mutator to
 * compute the patch, and writes the result back. Use this instead of
 * updateSession whenever the new value depends on existing fields that another
 * concurrent request may have changed (e.g. appending chat messages): the
 * mutator runs against fresh state read inside the critical section, so two
 * concurrent appends can't both read a stale array and clobber each other. (H-2)
 */
export async function updateSessionWith(
  id: string,
  mutate: (current: StoredSession) => Partial<StoredSession>,
): Promise<StoredSession | null> {
  const release = await acquireLock(id)
  try {
    const existing = await getSession(id)
    if (!existing) return null

    const updated: StoredSession = {
      ...existing,
      ...mutate(existing),
      updatedAt: new Date().toISOString(),
    }

    const fullTtlSeconds = existing.flow === 'post' ? SHIELD_TTL_SECONDS : BRIEF_TTL_SECONDS
    const ageSeconds = Math.floor((Date.now() - new Date(existing.createdAt).getTime()) / 1000)
    const remainingSeconds = Math.max(fullTtlSeconds - ageSeconds, 60)

    await redis.set(sessionKey(id), updated, { ex: remainingSeconds })
    return updated
  } finally {
    await release()
  }
}

/**
 * Acquires an exclusive generation lock scoped to a report session.
 * Used by the report generation route to prevent duplicate Claude calls
 * for the same session when concurrent requests race past the paid check.
 *
 * SECURITY (CRIT-02): The lock TTL is aligned to the function's maxDuration so a
 * reclaimed/timed-out generation can be retried shortly after it dies, rather
 * than being blocked for minutes by a stale lock. (MED-01) SET NX ensures only
 * one request proceeds; release is fenced to the owner token. (MED-02)
 *
 * Returns a release function. Throws 'LOCK_CONTENTION' if the lock is held.
 */
export const GENERATION_LOCK_TTL_SECONDS = 310 // ~maxDuration (300) + small margin

export async function acquireGenerationLock(sessionId: string): Promise<() => Promise<void>> {
  const key = `lock:report:${sessionId}`
  const token = randomUUID()
  const acquired = await redis.set(key, token, { nx: true, ex: GENERATION_LOCK_TTL_SECONDS })
  if (!acquired) {
    throw new Error('LOCK_CONTENTION: Report generation is already in progress.')
  }
  return () => releaseOwnedLock(key, token)
}

/**
 * Writes specific fields to a session WITHOUT acquiring the session write-lock.
 *
 * Use ONLY when the caller already holds an exclusive generation lock
 * (acquireGenerationLock), which guarantees no concurrent writers for this
 * session. Using updateSession inside generateAndSaveReport would acquire a
 * second lock unnecessarily, adding latency and complexity.
 *
 * This function is intentionally not exported — it exists only to be called
 * by generateAndSaveReport via the exported wrappers below.
 */
async function setSessionFieldsUnsafe(
  id: string,
  patch: Partial<StoredSession>,
): Promise<void> {
  const existing = await getSession(id)
  if (!existing) return

  const updated: StoredSession = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  }

  const fullTtlSeconds = existing.flow === 'post' ? SHIELD_TTL_SECONDS : BRIEF_TTL_SECONDS
  const ageSeconds = Math.floor(
    (Date.now() - new Date(existing.createdAt).getTime()) / 1000,
  )
  const remainingSeconds = Math.max(fullTtlSeconds - ageSeconds, 60)

  await redis.set(sessionKey(id), updated, { ex: remainingSeconds })
}

/** Marks a report session as complete with its generated report content. */
export async function markReportComplete(
  id: string,
  report: StoredSession['report'],
): Promise<void> {
  await setSessionFieldsUnsafe(id, { reportStatus: 'complete', report })
}

/** Marks a report session as failed with a user-facing error message. */
export async function markReportFailed(
  id: string,
  errorMessage: string,
): Promise<void> {
  await setSessionFieldsUnsafe(id, { reportStatus: 'failed', reportError: errorMessage })
}

/**
 * Records a processed Stripe event ID to ensure idempotent webhook handling.
 * Returns true if this is the first time this event has been seen.
 *
 * SECURITY (HIGH-02): Stripe guarantees at-least-once delivery. Without this
 * guard, retried webhooks could trigger duplicate side-effects.
 *
 * TTL of 7 days covers Stripe's full retry window (72 hours) with margin.
 */
export async function markStripeEventProcessed(eventId: string): Promise<boolean> {
  const key = `stripe:event:${eventId}`
  const result = await redis.set(key, '1', { nx: true, ex: 60 * 60 * 24 * 7 })
  return result !== null
}

/**
 * Read-only check for whether an event was already fully processed.
 *
 * FIX (HIGH): The dedup marker is now set only AFTER the handler succeeds, so a
 * handler that throws (and returns 500) is genuinely retried by Stripe instead
 * of being suppressed by a marker written before the work ran. The side effects
 * here (set paid=true, sadd recovery index) are idempotent, so the small window
 * where two concurrent deliveries both pass this check and both run is harmless.
 */
export async function wasStripeEventProcessed(eventId: string): Promise<boolean> {
  return (await redis.get(`stripe:event:${eventId}`)) !== null
}

// ─── Report recovery (email → sessions) ────────────────────────────────────────
//
// A reverse index so a buyer who has lost their report URL can recover access by
// entering the email they used at checkout. The key is a hash of the email (not
// the plaintext) so the index can't be trivially enumerated. TTL matches the
// longest access window and is refreshed on each purchase.

const RECOVERY_TTL_SECONDS = 60 * 60 * 24 * 60 // 60 days

function recoveryKey(email: string): string {
  const normalized = email.toLowerCase().trim()
  const hash = createHash('sha256').update(normalized).digest('hex')
  return `recover:${hash}`
}

/** Adds a paid session to its payer's recovery index. Best-effort. */
export async function indexSessionForRecovery(email: string, sessionId: string): Promise<void> {
  const key = recoveryKey(email)
  await redis.sadd(key, sessionId)
  await redis.expire(key, RECOVERY_TTL_SECONDS)
}

/** Returns the session IDs associated with a checkout email (may include
 *  expired ones — callers must re-fetch and filter). */
export async function findSessionIdsByEmail(email: string): Promise<string[]> {
  const ids = await redis.smembers(recoveryKey(email))
  return (ids as string[]) ?? []
}

// ─── Preview cache (deterministic results for identical inputs) ────────────────
//
// The free preview is cached by a hash of its normalized inputs so the SAME
// input always returns the SAME preview — including the severity rating — rather
// than re-rolling the model each time. Also saves the cost of duplicate calls.

const PREVIEW_CACHE_TTL_SECONDS = 60 * 60 * 24 * 14 // 14 days

export function previewCacheKey(canonicalInput: string): string {
  return `preview:${createHash('sha256').update(canonicalInput).digest('hex')}`
}

export async function getCachedPreview(key: string): Promise<PreviewResult | null> {
  const cached = await redis.get<PreviewResult>(key)
  return cached ?? null
}

export async function setCachedPreview(key: string, preview: PreviewResult): Promise<void> {
  await redis.set(key, preview, { ex: PREVIEW_CACHE_TTL_SECONDS })
}

// ─── Comparison-teaser cache ───────────────────────────────────────────────────
//
// The free 2-quote teaser is a second (vision) Claude call. Caching it keyed on
// both quote documents makes it deterministic for identical inputs — the
// "best value" pick can no longer flip on a back-button re-run — and avoids
// re-paying for the same comparison. (H-3 / determinism)

export function comparisonTeaserCacheKey(canonicalInput: string): string {
  return `teaser:${createHash('sha256').update(canonicalInput).digest('hex')}`
}

export async function getCachedComparisonTeaser(key: string): Promise<ComparisonTeaser | null> {
  const cached = await redis.get<ComparisonTeaser>(key)
  return cached ?? null
}

export async function setCachedComparisonTeaser(key: string, teaser: ComparisonTeaser): Promise<void> {
  await redis.set(key, teaser, { ex: PREVIEW_CACHE_TTL_SECONDS })
}
