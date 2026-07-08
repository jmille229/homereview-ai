/**
 * A small, non-intrusive note reminding the buyer that a link to this report
 * was emailed to them — and to check spam if they can't find it. Shown only in
 * the owner view when transactional email is actually configured (so we never
 * claim we emailed something we didn't). The "mark as not junk" nudge also helps
 * future report-update emails reach the inbox.
 */
export function EmailedReportNote({ className = '' }: { className?: string }) {
  return (
    <div
      className={`flex items-start gap-2.5 p-3 bg-brand-bg border border-brand-border rounded-xl text-xs text-brand-muted leading-relaxed print:hidden ${className}`}
      role="note"
    >
      <span aria-hidden="true" className="mt-px">✉️</span>
      <p>
        We&apos;ve emailed a link to this report to the address you used at checkout,
        so you can return to it anytime.{' '}
        <span className="font-semibold text-brand-navy">Can&apos;t find it?</span>{' '}
        Check your spam or junk folder — and mark it &quot;not junk&quot; so future
        updates reach your inbox.
      </p>
    </div>
  )
}
