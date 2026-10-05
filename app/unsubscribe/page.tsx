import Link from 'next/link'
import { NavBar } from '@/components/ui/NavBar'

export const metadata = {
  title: 'Unsubscribe — HomeReview AI',
  robots: { index: false },
}

/**
 * Landing page for the unsubscribe link in nurture emails. Unsubscribing takes
 * an explicit button press (a form POST to /api/nurture/unsubscribe) so email
 * link scanners that prefetch URLs can't unsubscribe anyone by accident.
 */
export default function UnsubscribePage({
  searchParams,
}: {
  searchParams: { e?: string; t?: string; done?: string }
}) {
  const done  = searchParams.done === '1'
  const valid = !!searchParams.e && !!searchParams.t

  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-md mx-auto px-5 py-12">
        {done ? (
          <>
            <h1 className="text-2xl font-bold text-brand-navy mb-2">You&apos;re unsubscribed</h1>
            <p className="text-sm text-brand-muted leading-relaxed mb-6">
              We won&apos;t send you any more emails about your preview. If you buy a report later,
              you&apos;ll still get the email with your report link.
            </p>
            <Link href="/" className="text-sm font-semibold text-brand-amber-deep underline underline-offset-2">
              Back to HomeReview
            </Link>
          </>
        ) : valid ? (
          <>
            <h1 className="text-2xl font-bold text-brand-navy mb-2">Unsubscribe</h1>
            <p className="text-sm text-brand-muted leading-relaxed mb-6">
              Stop all follow-up emails about your free preview?
            </p>
            <form method="post" action="/api/nurture/unsubscribe">
              <input type="hidden" name="e" value={searchParams.e} />
              <input type="hidden" name="t" value={searchParams.t} />
              <button
                type="submit"
                className="px-5 py-3 bg-brand-navy text-white text-sm font-semibold rounded-xl"
              >
                Unsubscribe me
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-brand-navy mb-2">Link not recognized</h1>
            <p className="text-sm text-brand-muted leading-relaxed">
              This unsubscribe link looks incomplete. Use the link from the bottom of any of our
              emails, or just reply to the email and we&apos;ll take you off the list.
            </p>
          </>
        )}
      </div>
    </main>
  )
}
