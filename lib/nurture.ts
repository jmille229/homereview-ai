import { Resend } from 'resend'
import type { CreateEmailOptions } from 'resend'

import { redis, getSession } from './redis'
import { createCheckoutLinkToken, createUnsubscribeToken } from './access'
import { buildNurtureEmail, hashEmail, nurtureDueAt, NURTURE_STEPS } from './nurtureEmails'

/**
 * lib/nurture.ts — Free-preview email capture + nurture sequence.
 *
 * A visitor who asks us to email their free preview becomes a "lead". Each lead
 * gets the preview immediately, then a tips email and a last-call email (see
 * NURTURE_STEPS), and the sequence stops the moment they buy, unsubscribe, or
 * their preview session expires.
 *
 * Storage (Upstash):
 *   nurture:lead:{sessionId}  { email, capturedAt, step }  — next step to send
 *   nurture:due               ZSET sessionId → epoch ms the next step is due
 *   nurture:unsub:{emailHash} suppression marker (no TTL)
 *
 * Every send path first claims a lead by ZREM-ing it from the due set, so the
 * immediate send and the daily cron can never both send the same step. Like
 * lib/email.ts, everything is dormant until RESEND_API_KEY is set.
 */

const FROM = process.env.NURTURE_EMAIL_FROM ?? process.env.EMAIL_FROM ?? 'HomeReview AI <reports@gethomereview.com>'

const DUE_KEY      = 'nurture:due'
const leadKey      = (sessionId: string) => `nurture:lead:${sessionId}`
const suppressKey  = (emailHash: string) => `nurture:unsub:${emailHash}`
const CRON_LOCK    = 'lock:cron:nurture'

/** Leads outlive the whole sequence with margin; anything older is abandoned. */
const LEAD_TTL_SECONDS = 60 * 60 * 24 * 14

/** The cron runs once a day (Vercel Hobby allows no more), so send anything due
 *  within the next 12h rather than holding it a full extra day. */
const LOOKAHEAD_MS = 12 * 60 * 60 * 1000

/** Resend batch limit is 100 emails per call. */
const BATCH_SIZE          = 100
const MAX_BATCHES_PER_RUN = 3

interface Lead { email: string; capturedAt: string; step: number }

export interface NurtureRunResult { sent: number; stopped: number; failed: number }

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')
}

// ─── Suppression ──────────────────────────────────────────────────────────────

export async function isSuppressed(email: string): Promise<boolean> {
  return (await redis.exists(suppressKey(hashEmail(email)))) === 1
}

/** Unsubscribes an email hash from all nurture email, permanently. */
export async function suppressEmailHash(emailHash: string): Promise<void> {
  await redis.set(suppressKey(emailHash), '1')
}

// ─── Capture ──────────────────────────────────────────────────────────────────

/**
 * Registers a lead and sends the preview email right away. Returns false if the
 * session already has a lead (capture is once per session, so a known session
 * id can't be used to email arbitrary addresses repeatedly).
 */
export async function startNurture(sessionId: string, email: string): Promise<boolean> {
  const capturedAt = new Date().toISOString()
  const lead: Lead = { email, capturedAt, step: 0 }
  const created = await redis.set(leadKey(sessionId), lead, { nx: true, ex: LEAD_TTL_SECONDS })
  if (!created) return false
  await redis.zadd(DUE_KEY, { score: nurtureDueAt(capturedAt, 0), member: sessionId })
  await sendLeads([sessionId])
  return true
}

// ─── Sending ──────────────────────────────────────────────────────────────────

interface Prepared { sessionId: string; lead: Lead; score: number; message: CreateEmailOptions }

/** Builds this lead's next email, or returns null (and drops the lead) when the
 *  sequence should stop: bought, unsubscribed, expired, or finished. */
async function prepare(sessionId: string, score: number): Promise<Prepared | null> {
  const [lead, session] = await Promise.all([
    redis.get<Lead>(leadKey(sessionId)),
    getSession(sessionId),
  ])
  const stop = async () => { await redis.del(leadKey(sessionId)); return null }

  if (!lead || !session || session.paid || lead.step >= NURTURE_STEPS.length) return stop()
  if (await isSuppressed(lead.email)) return stop()

  const emailHash      = hashEmail(lead.email)
  const unsubToken     = createUnsubscribeToken(emailHash)
  const unsubscribeUrl = `${baseUrl()}/unsubscribe?e=${emailHash}&t=${unsubToken}`
  const oneClickUrl    = `${baseUrl()}/api/nurture/unsubscribe?e=${emailHash}&t=${unsubToken}`
  const checkoutUrl    = `${baseUrl()}/api/nurture/checkout?session=${sessionId}&t=${createCheckoutLinkToken(sessionId)}`

  const { subject, html } = buildNurtureEmail({
    step:          lead.step,
    flow:          session.flow,
    category:      session.category,
    preview:       session.preview,
    checkoutUrl,
    unsubscribeUrl,
    postalAddress: process.env.EMAIL_POSTAL_ADDRESS || undefined,
    promoCode:     process.env.NURTURE_PROMO_CODE || undefined,
  })

  return {
    sessionId,
    lead,
    score,
    message: {
      from: FROM,
      to:   lead.email,
      subject,
      html,
      // RFC 8058 one-click unsubscribe (required by Gmail/Yahoo for bulk mail).
      headers: {
        'List-Unsubscribe':      `<${oneClickUrl}>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
      tags: [{ name: 'nurture_step', value: NURTURE_STEPS[lead.step].key.replace('-', '_') }],
    },
  }
}

/** Records a successful send: schedules the next step or ends the sequence. */
async function advance({ sessionId, lead }: Prepared): Promise<void> {
  const next = lead.step + 1
  if (next >= NURTURE_STEPS.length) {
    await redis.del(leadKey(sessionId))
    return
  }
  await redis.set(leadKey(sessionId), { ...lead, step: next }, { ex: LEAD_TTL_SECONDS })
  await redis.zadd(DUE_KEY, { score: nurtureDueAt(lead.capturedAt, next), member: sessionId })
}

/**
 * Claims, builds, and sends the next email for each session id. Ids another
 * worker already claimed are skipped. On a failed send the claimed leads go
 * back into the due set unchanged so the next run retries them.
 */
async function sendLeads(sessionIds: string[]): Promise<NurtureRunResult> {
  const result: NurtureRunResult = { sent: 0, stopped: 0, failed: 0 }
  const resend = client()
  if (!resend || sessionIds.length === 0) return result

  const prepared: Prepared[] = []
  for (const id of sessionIds) {
    const score = (await redis.zscore(DUE_KEY, id)) ?? Date.now()
    if ((await redis.zrem(DUE_KEY, id)) !== 1) continue // claimed elsewhere
    try {
      const p = await prepare(id, Number(score))
      if (p) prepared.push(p)
      else result.stopped++
    } catch (err) {
      result.failed++
      await redis.zadd(DUE_KEY, { score: Number(score), member: id })
      console.error('[nurture] prepare failed:', { message: err instanceof Error ? err.message : 'unknown' })
    }
  }

  for (let i = 0; i < prepared.length; i += BATCH_SIZE) {
    const chunk = prepared.slice(i, i + BATCH_SIZE)
    const { error } = chunk.length === 1
      ? await resend.emails.send(chunk[0].message)
      : await resend.batch.send(chunk.map((p) => p.message))
    if (error) {
      result.failed += chunk.length
      console.error('[nurture] send failed:', { message: error.message, count: chunk.length })
      for (const p of chunk) await redis.zadd(DUE_KEY, { score: p.score, member: p.sessionId })
      continue
    }
    result.sent += chunk.length
    for (const p of chunk) {
      try { await advance(p) } catch (err) {
        console.error('[nurture] advance failed:', { message: err instanceof Error ? err.message : 'unknown' })
      }
    }
  }
  return result
}

/** Daily cron entry point: sends every step that's due (or due within the
 *  lookahead window), up to MAX_BATCHES_PER_RUN batches. */
export async function runNurture(now = Date.now()): Promise<NurtureRunResult> {
  const empty: NurtureRunResult = { sent: 0, stopped: 0, failed: 0 }
  if (!client()) return empty

  const locked = await redis.set(CRON_LOCK, '1', { nx: true, ex: 300 })
  if (!locked) return empty
  try {
    const ids = await redis.zrange<string[]>(DUE_KEY, 0, now + LOOKAHEAD_MS, {
      byScore: true,
      offset:  0,
      count:   BATCH_SIZE * MAX_BATCHES_PER_RUN,
    })
    return await sendLeads(ids.map(String))
  } finally {
    await redis.del(CRON_LOCK)
  }
}
