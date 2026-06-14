import { NavBar } from '@/components/ui/NavBar'

export const metadata = {
  title: 'Privacy Policy — HomeReview AI',
}

const LAST_UPDATED = 'June 2026'
const COMPANY      = 'HomeReview AI'
const CONTACT      = 'support@homereviewai.com'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-2xl mx-auto px-5 py-8">

        <h1 className="text-2xl font-semibold text-brand-navy mb-2">Privacy Policy</h1>
        <p className="text-xs text-brand-muted mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm text-brand-muted leading-relaxed">

          <section>
            <p>
              {COMPANY} (&ldquo;we&rdquo;) is built to put the homeowner first, and that includes how we
              handle your information. This policy explains what we collect, why, who we share it
              with, and how long we keep it. We do not sell your personal information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">1. Information we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <span className="font-medium text-brand-navy">What you provide:</span> the issue
                description, zip code, answers to clarifying questions, and any photos or documents
                you upload (for example, a contractor quote). Uploaded documents may contain personal
                information such as names, addresses, or phone numbers — please redact anything you
                don&apos;t want processed.
              </li>
              <li>
                <span className="font-medium text-brand-navy">Payment information:</span> when you
                purchase a report, payment is processed by Stripe. We do not receive or store your
                card number. We do receive the email address you use at checkout, which we use to
                deliver and let you recover your report.
              </li>
              <li>
                <span className="font-medium text-brand-navy">Technical information:</span> your IP
                address and basic request metadata, used for security, abuse prevention, and rate
                limiting.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">2. How we use it</h2>
            <p>
              We use your information solely to provide the service: to generate your analysis, to
              process your payment, to deliver and let you re-access your report, to operate
              follow-up chat, and to protect the service from abuse. We do not use your information
              for advertising, and we do not sell it.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">3. Service providers</h2>
            <p>
              We share information with a small set of processors strictly to run the product:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-3">
              <li><span className="font-medium text-brand-navy">Anthropic</span> — generates the AI analysis from your description and uploaded documents.</li>
              <li><span className="font-medium text-brand-navy">Stripe</span> — processes payments.</li>
              <li><span className="font-medium text-brand-navy">Upstash</span> — stores your session and report data.</li>
              <li><span className="font-medium text-brand-navy">Cloudflare</span> — bot / abuse protection.</li>
              <li><span className="font-medium text-brand-navy">Vercel</span> — application hosting.</li>
              <li><span className="font-medium text-brand-navy">Resend</span> — sends transactional email (e.g., your report link).</li>
            </ul>
            <p className="mt-3">
              Each processes data only on our behalf to deliver the service. We do not permit them to
              use your information for their own marketing.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">4. Data retention</h2>
            <p>
              Report sessions automatically expire and are deleted after their access window — 30 days
              for a Diagnostic Brief and 60 days for a Quote Shield — after which the analysis,
              uploaded files, and chat history are no longer retained. Uploaded files are held only
              transiently to produce your report.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">5. Cookies</h2>
            <p>
              We use only strictly-necessary cookies: a signed, HttpOnly cookie that grants access to
              a paid report, and a short-lived verification cookie for the anti-bot check. We do not
              use advertising or cross-site tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">6. Your choices and rights</h2>
            <p>
              Depending on where you live, you may have the right to access, correct, or delete your
              personal information. Because the service is account-less and data auto-expires, the
              fastest way to exercise these rights — including early deletion — is to email us at{' '}
              <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a> with the email you
              used at checkout.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">7. Children</h2>
            <p>
              The service is intended for adults and is not directed to anyone under 18. We do not
              knowingly collect information from children.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">8. Changes</h2>
            <p>
              We may update this policy as the product evolves. Material changes will be reflected by
              the &ldquo;last updated&rdquo; date above.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">9. Contact</h2>
            <p>
              Questions about privacy? Email{' '}
              <a className="underline" href={`mailto:${CONTACT}`}>{CONTACT}</a>.
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
