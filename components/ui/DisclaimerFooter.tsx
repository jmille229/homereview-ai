/**
 * Reusable disclaimer footer used on report pages.
 *
 * Contains the full liability language required to protect against claims
 * arising from homeowners acting on AI-generated analysis. Placed at the
 * bottom of each report — prominent enough to be seen, unobtrusive enough
 * not to undermine confidence in the product.
 *
 * The three legal elements:
 * 1. Not Professional Advice    — establishes the educational nature of the content
 * 2. Limitation of Liability    — caps maximum exposure to amount paid
 * 3. No Warranty / As-Is        — disclaims accuracy and completeness guarantees
 */

export function DisclaimerFooter() {
  return (
    <div className="mt-6 p-4 bg-white border border-brand-border rounded-xl space-y-3">
      <p className="text-[11px] font-semibold text-brand-muted uppercase tracking-[0.05em]">
        Important Notice
      </p>

      <p className="text-xs text-brand-muted leading-relaxed">
        <span className="font-semibold text-brand-navy">Not professional advice.</span>{' '}
        The analysis provided by HomeReview AI is for general informational and educational
        purposes only and does not constitute professional contractor, engineering, legal,
        or safety advice. Always consult a licensed professional before undertaking any
        home repair, particularly work involving structural, electrical, plumbing, or
        mechanical systems.
      </p>

      <p className="text-xs text-brand-muted leading-relaxed">
        <span className="font-semibold text-brand-navy">No warranty.</span>{' '}
        We do not warrant that the information provided is accurate, reliable, complete,
        or error-free. Regional cost ranges are estimates only and may vary significantly.
        You assume all risks and full responsibility for any repairs or actions you take
        based on this information.
      </p>

      <p className="text-xs text-brand-muted leading-relaxed">
        <span className="font-semibold text-brand-navy">Limitation of liability.</span>{' '}
        To the fullest extent permitted by law, HomeReview AI shall not be liable for
        any indirect, incidental, special, consequential, or punitive damages, or any
        loss of profits or revenues, whether incurred directly or indirectly, arising
        out of your use of this tool. Our maximum liability to you shall not exceed the
        amount you paid for the service in the preceding 12 months.
      </p>
    </div>
  )
}
