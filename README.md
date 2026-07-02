# HomeReview AI

An independent AI advisor for homeowners facing contractor work: describe a home
problem (or upload a contractor's quote), get a free AI preview, and purchase a
full report — a **Diagnostic Brief** (pre-quote) or a **Quote Shield** (post-quote,
with line-by-line pricing analysis, multi-quote comparison, and a 60-day living
report).

**Setup & deployment:** see [SETUP.md](./SETUP.md). Environment variables are
documented in [.env.example](./.env.example).

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) on Vercel serverless |
| AI | Anthropic Claude (Sonnet for analysis/reports, Haiku for updates/chat) |
| Data | Upstash Redis (sessions, rate limits, locks, caches) — no SQL database |
| Payments | Stripe Checkout (hosted) + signed webhooks |
| Client state | Zustand (persisted funnel state), sessionStorage (pending uploads) |
| Validation | Zod on every API input **and** every AI output |

## How a purchase flows

```
/ (marketing)
└─ /intake      pick flow + category, describe issue, upload quote(s)   [Turnstile gate]
   └─ /questions  AI clarifying questions            POST /api/questions
      └─ /preview  free preview + teaser             POST /api/analyze  → session in Redis
         └─ Stripe Checkout                          POST /api/checkout
            └─ /success  poll for the report         POST /api/report (verifies payment,
               │                                     waitUntil background generation)
               └─ /report/{brief|shield}/[id]        gated by a signed access cookie
```

## Architecture invariants (do not break)

- **Payment truth lives at Stripe.** `paid: true` is only ever set after webhook
  signature verification or a server-side `checkout.sessions.retrieve`. Prices
  come from `lib/pricing.ts` (single source — UI display is derived from the
  charged amount).
- **Report access is capability-based.** The session UUID is not a secret; every
  paid surface additionally requires the HMAC-signed, payment-minted, HttpOnly
  cookie (`lib/access.ts`). Recovery is possession-based (magic links emailed to
  the checkout address), never inline.
- **AI output is data, not authority.** Every model response is Zod-validated;
  it never drives pricing, access, or any privileged action, and is rendered
  only through React escaping (no `dangerouslySetInnerHTML` anywhere).
- **The free tier is defended in depth**: Turnstile gate (fails closed in prod),
  per-IP rate limits keyed on the unspoofable `x-real-ip` (fails closed when
  missing), and global daily spend ceilings (`lib/budget.ts`).
- **Uploads are verified by magic bytes** server-side (`lib/fileValidation.ts`)
  before any vision call; client-side validation is the shared
  `lib/clientFiles.ts` and is UX-only.
- **Redis writes that depend on current state go through `updateSessionWith`**
  (read-inside-the-lock) — plain `updateSession` is only for independent fields.
  Locks are fenced (owner-token compare-and-delete release).

## Development

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev

npm run type-check   # tsc --noEmit
npm run lint         # next lint
npm test             # vitest (unit tests in tests/)
```

CI (`.github/workflows/ci.yml`) runs type-check, lint, and tests on every PR
and push to `main`.
