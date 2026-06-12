import { Redis } from '@upstash/redis'
import { createHash } from 'crypto'
import type { StoredSession } from './types'

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

// ─── Redis lock helper ────────────────────────────────────────────────────────

/**
 * Acquires an exclusive write-lock on a session key using SET NX.
 * Returns a release function. Throws if the lock cannot be acquired,
 * indicating a concurrent write is in progress.
 *
 * SECURITY (CRIT-02 / MED-01): Prevents race conditions on payment
 * verification and living-report updates where two simultaneous requests
 * could read the same stale state, both apply their writes, and the last
 * write silently discards the other.
 */
async function acquireLock(id: string): Promise<() => Promise<void>> {
  const key = lockKey(id)
  const acquired = await redis.set(key, '1', { nx: true, ex: LOCK_TTL_SECONDS })
  if (!acquired) {
    throw new Error('LOCK_CONTENTION: Session is locked by a concurrent operation.')
  }
  return async () => { await redis.del(key) }
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
 * Acquires an exclusive generation lock scoped to a report session.
 * Used by the report generation route to prevent duplicate Claude calls
 * for the same session when concurrent requests race past the paid check.
 *
 * SECURITY (CRIT-02): The lock TTL (5 minutes) covers the maximum expected
 * Claude generation time. SET NX ensures only one request proceeds.
 *
 * Returns a release function. Throws 'LOCK_CONTENTION' if the lock is held.
 */
export async function acquireGenerationLock(sessionId: string): Promise<() => Promise<void>> {
  const key = `lock:report:${sessionId}`
  const acquired = await redis.set(key, '1', { nx: true, ex: 300 }) // 5-minute max generation window
  if (!acquired) {
    throw new Error('LOCK_CONTENTION: Report generation is already in progress.')
  }
  return async () => { await redis.del(key) }
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
