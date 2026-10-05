import { createHash } from 'crypto'
import type { CategoryId, Flow, Product } from './enums'
import type { PreviewResult } from './types'
import { PRODUCT_PRICING, priceDisplay } from './pricing'

/**
 * lib/nurtureEmails.ts — Content + schedule for the free-preview nurture
 * sequence (people who asked us to email their preview but haven't bought).
 *
 * Pure: no env reads, no network, no Redis. lib/nurture.ts supplies the links
 * and does the sending, so the copy and schedule can be unit-tested directly.
 */

// ─── Schedule ─────────────────────────────────────────────────────────────────

export type NurtureStepKey = 'preview' | 'tips' | 'last-call'

/** Hours after capture each email becomes due. Step 0 is sent immediately. */
export const NURTURE_STEPS: { key: NurtureStepKey; delayHours: number }[] = [
  { key: 'preview',   delayHours: 0 },
  { key: 'tips',      delayHours: 24 },
  { key: 'last-call', delayHours: 72 },
]

/** When step `step` is due, as epoch ms, for a lead captured at `capturedAt`. */
export function nurtureDueAt(capturedAt: string, step: number): number {
  return new Date(capturedAt).getTime() + NURTURE_STEPS[step].delayHours * 60 * 60 * 1000
}

export function productForFlow(flow: Flow): Product {
  return flow === 'pre' ? 'brief' : 'shield'
}

/** Normalized SHA-256 of an email: the suppression-list key and the subject of
 *  unsubscribe tokens, so plaintext addresses never appear in links. */
export function hashEmail(email: string): string {
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex')
}

/** Short category names for email copy (the app's labels are too long for a
 *  subject line). `noun` reads naturally mid-sentence: "your plumbing quote". */
const CATEGORY_COPY: Record<CategoryId, { title: string; noun: string }> = {
  hvac:        { title: 'HVAC',            noun: 'HVAC' },
  plumbing:    { title: 'Plumbing',        noun: 'plumbing' },
  electrical:  { title: 'Electrical',      noun: 'electrical' },
  roofing:     { title: 'Roofing',         noun: 'roofing' },
  foundation:  { title: 'Foundation',      noun: 'foundation' },
  appliances:  { title: 'Appliance',       noun: 'appliance' },
  pest:        { title: 'Pest & mold',     noun: 'pest and mold' },
  maintenance: { title: 'Home repair',     noun: 'home repair' },
}

// ─── HTML helpers ─────────────────────────────────────────────────────────────

/** Preview text is AI output: always escape before putting it in HTML. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

const P     = 'font-size:14px;line-height:1.6;color:#5A6678;margin:0 0 14px'
const LABEL = 'font-size:11px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#5A6678;margin:0 0 6px'
const BODY  = 'font-size:14px;line-height:1.6;color:#1C2B3A;margin:0 0 18px'

const button = (href: string, label: string) => `
  <p style="margin:24px 0">
    <a href="${href}" style="background:#1C2B3A;color:#fff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 20px;border-radius:10px;display:inline-block">
      ${label}
    </a>
  </p>`

interface Footer { unsubscribeUrl: string; postalAddress?: string }

const layout = (inner: string, { unsubscribeUrl, postalAddress }: Footer) => `
  <div style="font-family:-apple-system,Segoe UI,sans-serif;max-width:520px;margin:0 auto;color:#1C2B3A">
    <p style="font-size:13px;font-weight:600;letter-spacing:.08em;color:#9A5B1F">HOMEREVIEW</p>
    ${inner}
    <hr style="border:none;border-top:1px solid #DDD8CF;margin:28px 0" />
    <p style="font-size:12px;color:#5A6678;line-height:1.6">
      You're getting this because you asked us to email your free HomeReview preview to this address.
      We never share your email and we don't take contractor referral fees.
      <a href="${unsubscribeUrl}" style="color:#5A6678">Unsubscribe</a>.
    </p>
    <p style="font-size:12px;color:#5A6678;line-height:1.6">
      HomeReview AI provides general informational analysis only — not professional contractor,
      engineering, or legal advice.${postalAddress ? `<br />${escapeHtml(postalAddress)}` : ''}
    </p>
  </div>`

// ─── Content ──────────────────────────────────────────────────────────────────

export interface NurtureEmailArgs {
  step:           number
  flow:           Flow
  category:       CategoryId
  preview:        PreviewResult
  checkoutUrl:    string
  unsubscribeUrl: string
  postalAddress?: string
  /** Optional Stripe promotion code mentioned in the last email. */
  promoCode?:     string
}

export interface NurtureEmail { subject: string; html: string }

const WHAT_YOU_GET: Record<Product, string> = {
  brief:  'the likely root cause, a fair cost range for your area, which contractor to call, 8 questions to ask before you sign, and red flags for this trade',
  shield: "a line-by-line check of your quote against regional costs, padding and missing scope, red flags in this contractor's approach, and the exact language to negotiate with",
}

export function buildNurtureEmail(args: NurtureEmailArgs): NurtureEmail {
  const { step, flow, preview, checkoutUrl } = args
  const product  = productForFlow(flow)
  const name     = PRODUCT_PRICING[product].name
  const price    = priceDisplay(product)
  const { title, noun } = CATEGORY_COPY[args.category]
  const footer   = { unsubscribeUrl: args.unsubscribeUrl, postalAddress: args.postalAddress }
  const cta      = button(checkoutUrl, `Get my ${name} — ${price} →`)
  const key      = NURTURE_STEPS[step]?.key

  if (key === 'preview') {
    const emergency = preview.severity === 'Emergency'
      ? `<p style="${P};color:#B42318;font-weight:600">If this is a safety emergency, call a licensed professional or your utility now.</p>`
      : ''
    return {
      subject: `Your HomeReview preview: ${title}`,
      html: layout(`
        <h1 style="font-size:20px;margin:8px 0 12px">Here's your free preview</h1>
        <p style="${P}">As promised, here's what we found so you have it handy when you talk to a contractor.</p>
        ${emergency}
        <p style="${LABEL}">Issue summary</p>
        <p style="${BODY}">${escapeHtml(preview.summary)}</p>
        <p style="${LABEL}">Severity</p>
        <p style="${BODY}"><strong>${escapeHtml(preview.severity)}</strong> — ${escapeHtml(preview.severityReason)}</p>
        <p style="${LABEL}">Typical cost range</p>
        <p style="${BODY}"><strong>$${preview.costMin.toLocaleString('en-US')}–$${preview.costMax.toLocaleString('en-US')}</strong> for this type of issue in your area</p>
        <p style="${LABEL}">Key insight</p>
        <p style="${BODY}">${escapeHtml(preview.keyInsight)}</p>
        <p style="${P}">The full ${name} adds ${WHAT_YOU_GET[product]}. One-time ${price}, no subscription.</p>
        ${cta}
      `, footer),
    }
  }

  if (key === 'tips') {
    const tips = flow === 'pre'
      ? [
          ['Get at least two written, itemized quotes.', 'A single lump-sum number is almost impossible to compare or push back on.'],
          ['Ask what is causing the problem, not just what they will replace.', 'A good contractor can explain the diagnosis in plain terms.'],
          ['Check license and insurance before work starts.', 'And keep the deposit small. Paying most of the job up front removes your leverage.'],
        ]
      : [
          ['Every line should say what is being done and with what.', 'Vague items like "misc. labor" or "materials" are where padding hides.'],
          ['Look for what is missing.', 'Permits, disposal, cleanup, and warranty terms are common gaps that come back as change orders.'],
          ['Tie payments to finished milestones.', 'A small deposit and a final payment after you have inspected the work keep everyone honest.'],
        ]
    const items = tips.map(([head, rest]) => `
      <li style="margin:0 0 12px;font-size:14px;line-height:1.6;color:#5A6678">
        <strong style="color:#1C2B3A">${head}</strong> ${rest}
      </li>`).join('')
    return {
      subject: flow === 'pre'
        ? `3 ways to avoid overpaying for ${noun} work`
        : `What to check before you sign that ${noun} quote`,
      html: layout(`
        <h1 style="font-size:20px;margin:8px 0 12px">${flow === 'pre' ? 'Before you call a contractor' : 'Before you sign that quote'}</h1>
        <p style="${P}">A few things that save homeowners money on ${noun} jobs:</p>
        <ol style="padding-left:20px;margin:0 0 16px">${items}</ol>
        <p style="${P}">Your ${name} does this for your specific situation: ${WHAT_YOU_GET[product]}.</p>
        ${cta}
      `, footer),
    }
  }

  // last-call
  const promo = args.promoCode
    ? `<p style="${P}">Use code <strong style="color:#1C2B3A">${escapeHtml(args.promoCode)}</strong> at checkout for a discount.</p>`
    : ''
  return {
    subject: `Still deciding on your ${noun} ${flow === 'pre' ? 'issue' : 'quote'}?`,
    html: layout(`
      <h1 style="font-size:20px;margin:8px 0 12px">Still deciding?</h1>
      <p style="${P}">
        This is our last note about your ${noun} ${flow === 'pre' ? 'issue' : 'quote'}.
        If you want a second opinion before you spend real money, the full ${name} is ready to go:
        ${WHAT_YOU_GET[product]}.
      </p>
      <p style="${P}">One-time ${price}. No subscription. If it isn't useful, email us for a full refund.</p>
      ${promo}
      ${cta}
    `, footer),
  }
}
