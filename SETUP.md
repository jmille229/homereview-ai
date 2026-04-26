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

## Adding Authentication (Recommended for Phase 2)

The current implementation uses session UUIDs as security tokens. For a more robust auth system:

1. Install Clerk: `npm install @clerk/nextjs`
2. Add `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to `.env.local`
3. Wrap the root layout with `<ClerkProvider>`
4. Add `userId` to the `StoredSession` type and link sessions to users
5. Add `auth()` checks to all API routes

See: https://clerk.com/docs/quickstarts/nextjs

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
