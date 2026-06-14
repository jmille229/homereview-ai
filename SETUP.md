# HomeReview AI — Setup & Deployment Guide

## Prerequisites
- Node.js 18.17+ 
- A Vercel account (free tier works)
- An Upstash account (free tier works)
- An Anthropic account
- A Stripe account

---

## Step 1 — Install Dependencies

```bash
npm install
```

---

## Step 2 — Set Up Upstash Redis

1. Go to https://upstash.com/ and create a free account
2. Click **Create Database** → choose a region close to your users → **Create**
3. Open the database → click **REST API** tab
4. Copy `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

---

## Step 3 — Set Up Stripe

1. Go to https://dashboard.stripe.com and create an account
2. Copy your **Secret key** from https://dashboard.stripe.com/apikeys
3. To set up the webhook locally for testing:
   ```bash
   # Install Stripe CLI
   brew install stripe/stripe-cli/stripe
   stripe login
   stripe listen --forward-to localhost:3000/api/webhooks/stripe
   # Copy the webhook signing secret it prints
   ```
4. For production: Dashboard → Webhooks → Add endpoint
   - URL: `https://yourdomain.com/api/webhooks/stripe`
   - Events: `checkout.session.completed`

---

## Step 4 — Configure Environment Variables

```bash
cp .env.example .env.local
# Edit .env.local and fill in all values
```

---

## Step 5 — Run Locally

```bash
npm run dev
# Open http://localhost:3000
```

---

## Step 6 — Deploy to Vercel

```bash
npm install -g vercel
vercel
```

Or connect your GitHub repo to Vercel at https://vercel.com/new.

In Vercel dashboard → Project → Settings → Environment Variables, add all variables from `.env.example`.

---

## Access Control

Paid reports are gated by a **payment-bound capability cookie**, not by the
session URL alone:

- After Stripe confirms payment, `/api/report` mints a signed, HttpOnly,
  per-session cookie (`hr_access_<sessionId>`) whose lifetime matches the
  product window (30 days for Brief, 60 days for Shield).
- The report pages and the chat / living-report-update APIs require a valid
  cookie. The status-polling endpoint is intentionally not gated (it reveals
  nothing beyond the URL the buyer already has).
- To view a report on another device, the buyer visits `/unlock?session=<id>`
  and enters the email they used at Stripe checkout. `/api/report/reclaim`
  verifies it against the stored payer email and re-mints the cookie. This
  endpoint is rate-limited and returns generic errors to resist guessing.

Set a strong `ACCESS_TOKEN_SECRET` (see `.env.example`) — the app fails closed
in production if it is missing.

## Abuse & cost protection

The free, pre-payment AI endpoints (`/api/analyze`, `/api/questions`) are the
main cost-DoS surface. Three independent layers protect them:

1. **Bot gate (Cloudflare Turnstile).** The user solves a Turnstile challenge on
   the intake page; `/api/gate` verifies it and issues a signed, HttpOnly
   preview-pass cookie that the AI endpoints require. **Dormant until configured**
   — set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (from the
   Cloudflare dashboard → Turnstile) to enforce it.
2. **Per-IP rate limits** (unchanged) — first line against a single abuser. IP
   resolution now **fails closed**: a request with no `x-real-ip` is rejected
   rather than bucketed into a shared `'unknown'` key.
3. **Global daily spend ceilings** — a circuit breaker across *all* callers,
   independent of IP. Tune with `DAILY_PREVIEW_CEILING` / `DAILY_QUESTIONS_CEILING`.

Uploaded files are also validated by **magic bytes server-side**, so malformed
or mislabeled payloads are rejected before any expensive vision call.

Backstop: set an **Anthropic billing alert** regardless of the above.

## Content-Security-Policy

CSP is set in `middleware.ts`, with two policies chosen by path:

- **Funnel / app routes** (the `app/(flow)` route group: intake, questions,
  preview, success, unlock, report) reflect user + AI content, so they get a
  **strict per-request nonce** policy with no `script-src 'unsafe-inline'`. The
  `(flow)` layout opts these routes into dynamic rendering so Next can stamp the
  nonce onto its scripts.
- **Marketing routes** (home, about, learn, terms) render only trusted content
  and stay **statically CDN-cached** with the looser `'unsafe-inline'` policy.

If you add a third-party script to a funnel route, allow its host in `nonceCsp()`.
The route group does not change URLs.

### Phase 2 — Full accounts (optional)

For per-user dashboards and history, add a real auth provider (e.g. Clerk),
put `userId` on `StoredSession`, and check `auth()` in the API routes. The
capability cookie above remains a useful second factor for shareable links.

---

## Architecture Notes

| Concern | Solution |
|---------|----------|
| API key security | Keys stored in server-side env vars only |
| Rate limiting | Upstash Redis (sliding window, per-IP) |
| Session storage | Upstash Redis, TTL 60 days |
| File uploads | Base64 in request body (max 2MB/file, 3 files) |
| Payments | Stripe Checkout (hosted, PCI-compliant) |
| AI models | Haiku for previews, Sonnet 4.6 for full reports |
| Validation | Zod on all API inputs and AI outputs |

---

## File Upload Limits

Current limits (enforced client + server):
- Max file size: **2MB per file**
- Max files: **3 per submission**
- Accepted types: `image/jpeg`, `image/png`, `image/webp`, `application/pdf`

These limits are set to stay within Vercel's 4.5MB serverless function payload limit.
To increase limits, add S3 direct upload (see S3 upgrade path in engineering review).
