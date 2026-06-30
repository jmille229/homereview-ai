import { Resend } from 'resend'
import { accessCookieName, createAccessToken, accessWindowSeconds } from './access'
import type { Product } from './enums'

/**
 * lib/email.ts — Transactional email via Resend.
 *
 * Feature-flagged: dormant until RESEND_API_KEY is set, so deploys never break
 * if email isn't configured yet. Every send is best-effort and never throws into
 * the caller — a failed email must not fail report generation or payment.
 *
 * The report link is a magic link: /api/report/open?session=…&t=<access-token>
 * sets the access cookie and redirects to the report, so the buyer lands
 * straight in their report from any device without re-entering their email.
 */

const FROM = process.env.EMAIL_FROM ?? 'HomeReview AI <reports@gethomereview.com>'

function client(): Resend | null {
  const key = process.env.RESEND_API_KEY
  return key ? new Resend(key) : null
}

export function emailEnabled(): boolean {
  return !!process.env.RESEND_API_KEY
}

function baseUrl(): string {
  return (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '')
}

/** Builds the magic link that opens a report and grants access in one click. */
function magicLink(sessionId: string, product: Product): string {
  const token = createAccessToken(sessionId, accessWindowSeconds(product))
  const t = encodeURIComponent(token)
  return `${baseUrl()}/api/report/open?session=${sessionId}&t=${t}`
}

const PRODUCT_NAME: Record<Product, string> = {
  brief:  'Diagnostic Brief',
  shield: 'Quote Shield',
}

const wrapper = (inner: string) => `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1C2B3A">
    <p style="font-size:13px;font-weight:600;letter-spacing:.08em;color:#9A5B1F">HOMEREVIEW</p>
    ${inner}
    <hr style="border:none;border-top:1px solid #DDD8CF;margin:28px 0" />
    <p style="font-size:12px;color:#5A6678;line-height:1.6">
      HomeReview AI provides general informational analysis only — not professional contractor,
      engineering, or legal advice. Need help? Just reply to this email.
    </p>
  </div>`

interface ReportEmailArgs {
  to:            string
  sessionId:     string
  product:       Product
  categoryLabel: string
}

/** "Your report is ready" with a one-click magic link. */
export async function sendReportReadyEmail({ to, sessionId, product, categoryLabel }: ReportEmailArgs): Promise<void> {
  const resend = client()
  if (!resend || !to) return
  const link = magicLink(sessionId, product)
  const name = PRODUCT_NAME[product]
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `Your ${name} is ready`,
      html: wrapper(`
        <h1 style="font-size:20px;margin:8px 0 12px">Your ${name} is ready</h1>
        <p style="font-size:14px;line-height:1.6;color:#5A6678">
          Your ${name} for <strong style="color:#1C2B3A">${categoryLabel}</strong> is complete.
          Open it below to read the full analysis and chat with your advisor.
        </p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#1C2B3A;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;display:inline-block">
            Open my report →
          </a>
        </p>
        <p style="font-size:12px;color:#5A6678;line-height:1.6">
          This link is private to you — keep it safe. You can also return anytime at
          ${baseUrl()}/recover using this email.
        </p>
      `),
    })
  } catch (err) {
    console.error('[email] report-ready send failed:', { message: err instanceof Error ? err.message : 'unknown' })
  }
}

/** Apology when generation fails, so the buyer isn't left wondering. */
export async function sendReportFailedEmail({ to, sessionId, product, categoryLabel }: ReportEmailArgs): Promise<void> {
  const resend = client()
  if (!resend || !to) return
  const link = magicLink(sessionId, product)
  const name = PRODUCT_NAME[product]
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `We hit a snag with your ${name}`,
      html: wrapper(`
        <h1 style="font-size:20px;margin:8px 0 12px">We're on it</h1>
        <p style="font-size:14px;line-height:1.6;color:#5A6678">
          We ran into a problem generating your ${name} for ${categoryLabel}. Your payment is safe,
          and you can retry from your report page below. If it still doesn't work, just reply to this
          email and we'll sort it out — and refund you if we can't.
        </p>
        <p style="margin:24px 0">
          <a href="${link}" style="background:#1C2B3A;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;display:inline-block">
            Open my report →
          </a>
        </p>
      `),
    })
  } catch (err) {
    console.error('[email] report-failed send failed:', { message: err instanceof Error ? err.message : 'unknown' })
  }
}

interface RecoveryReport {
  sessionId:     string
  product:       Product
  categoryLabel: string
}

/**
 * Self-service recovery: emails one-click magic links to the address the buyer
 * used at checkout. This makes recovery possession-based (you must control the
 * inbox) rather than treating the email as a bearer credential. Best-effort and
 * dormant until Resend is configured.
 */
export async function sendRecoveryEmail({ to, reports }: { to: string; reports: RecoveryReport[] }): Promise<void> {
  const resend = client()
  if (!resend || !to || reports.length === 0) return
  const items = reports.map((r) => {
    const link = magicLink(r.sessionId, r.product)
    return `
      <li style="margin:0 0 12px">
        <a href="${link}" style="color:#1C2B3A;font-size:14px;font-weight:600;text-decoration:none">
          ${PRODUCT_NAME[r.product]} — ${r.categoryLabel} →
        </a>
      </li>`
  }).join('')
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: reports.length === 1 ? 'Your HomeReview report link' : 'Your HomeReview report links',
      html: wrapper(`
        <h1 style="font-size:20px;margin:8px 0 12px">Here ${reports.length === 1 ? 'is your report' : 'are your reports'}</h1>
        <p style="font-size:14px;line-height:1.6;color:#5A6678">
          Open ${reports.length === 1 ? 'it' : 'them'} below — each link signs you straight in on this device.
        </p>
        <ul style="list-style:none;padding:0;margin:20px 0">${items}</ul>
        <p style="font-size:12px;color:#5A6678;line-height:1.6">
          These links are private to you — please don't forward them. If you didn't request this, you can ignore this email.
        </p>
      `),
    })
  } catch (err) {
    console.error('[email] recovery send failed:', { message: err instanceof Error ? err.message : 'unknown' })
  }
}

/** Ops alert to the team (uses the same Resend client). No-op if unconfigured. */
export async function sendOpsAlert(subject: string, detail: string): Promise<void> {
  const resend = client()
  const to = process.env.OPS_ALERT_EMAIL
  if (!resend || !to) return
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: `[HomeReview ops] ${subject}`,
      text: detail,
    })
  } catch { /* never throw from an alert */ }
}
