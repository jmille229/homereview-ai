import { NavBar } from '@/components/ui/NavBar'

export const metadata = {
  title: 'Terms of Service — HomeReview AI',
}

const LAST_UPDATED = 'May 2026'
const COMPANY      = 'HomeReview AI'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-brand-bg">
      <NavBar variant="site" />
      <div className="max-w-2xl mx-auto px-5 py-8">

        <h1 className="text-2xl font-semibold text-brand-navy mb-2">
          Terms of Service
        </h1>
        <p className="text-xs text-brand-muted mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="space-y-8 text-sm text-brand-muted leading-relaxed">

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">
              1. Not Professional Advice
            </h2>
            <p>
              The analysis, reports, and chat responses provided by {COMPANY} are for
              general informational and educational purposes only. They do not constitute
              professional contractor, engineering, structural, mechanical, electrical,
              plumbing, legal, or safety advice.
            </p>
            <p className="mt-3">
              Nothing in this service should be relied upon as a substitute for consultation
              with a licensed professional. Always consult a qualified, licensed contractor
              or engineer before undertaking any home repair, particularly work involving
              structural integrity, electrical systems, plumbing, HVAC, roofing, or
              any work that requires a permit.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">
              2. No Warranty — Information Provided As-Is
            </h2>
            <p>
              {COMPANY} provides this service on an &ldquo;as is&rdquo; and
              &ldquo;as available&rdquo; basis. We expressly disclaim all warranties of
              any kind, whether express or implied, including but not limited to implied
              warranties of accuracy, reliability, completeness, fitness for a particular
              purpose, or non-infringement.
            </p>
            <p className="mt-3">
              We do not warrant that the information provided is accurate, current,
              reliable, complete, or error-free. Cost estimates are regional approximations
              only and may differ significantly from actual quotes in your area.
              You assume all risks and full responsibility for any repairs, actions, or
              decisions you make based on information received from this service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">
              3. Limitation of Liability
            </h2>
            <p>
              To the fullest extent permitted by applicable law, {COMPANY}, its owners,
              operators, employees, and affiliates shall not be liable for any indirect,
              incidental, special, consequential, exemplary, or punitive damages, including
              but not limited to loss of profits, loss of revenue, property damage, personal
              injury, or any other losses, whether incurred directly or indirectly, arising
              out of or in connection with your use of this service or any information
              provided herein.
            </p>
            <p className="mt-3">
              In no event shall our total cumulative liability to you for any claim arising
              out of or related to this service exceed the total amount you paid to
              {COMPANY} in the twelve (12) months immediately preceding the event giving
              rise to the claim.
            </p>
            <p className="mt-3">
              Some jurisdictions do not allow the exclusion or limitation of certain damages.
              In such jurisdictions, our liability shall be limited to the greatest extent
              permitted by law.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">
              4. Your Responsibilities
            </h2>
            <p>
              By using this service, you agree that:
            </p>
            <ul className="mt-3 space-y-2 ml-4">
              {[
                'You will not rely solely on AI-generated analysis for decisions involving significant financial, structural, or safety risk.',
                'You will consult a licensed professional for any repair work that requires permits, licensed trades, or structural assessment.',
                'You are responsible for verifying contractor credentials, licenses, and insurance independently.',
                'You understand that cost estimates are approximations and actual costs will vary.',
                'You accept full responsibility for any actions you take based on information provided by this service.',
              ].map((item, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-amber flex-shrink-0 mt-[7px]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">
              5. Accuracy of AI-Generated Content
            </h2>
            <p>
              {COMPANY} uses large language model AI to generate analysis. AI systems
              can produce incorrect, incomplete, or outdated information. We make no
              representations about the accuracy of any AI-generated content.
              Severity classifications, cost ranges, contractor recommendations, and
              diagnostic conclusions are estimates based on the information provided
              and general patterns — they are not professional assessments.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">
              6. Emergency Situations
            </h2>
            <p className="font-medium text-brand-navy">
              If you believe you have a home emergency involving risk to life, health,
              or immediate structural safety — including active gas leaks, electrical
              fires, structural collapse, or flooding — contact emergency services
              immediately. Do not rely on this service in emergency situations.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold text-brand-navy mb-3">
              7. Contact
            </h2>
            <p>
              For questions about these terms, contact us at{' '}
              <a
                href="mailto:support@homereviewai.com"
                className="text-brand-navy underline underline-offset-2 hover:opacity-70 transition-opacity"
              >
                support@homereviewai.com
              </a>
              .
            </p>
          </section>

        </div>
      </div>
    </main>
  )
}
