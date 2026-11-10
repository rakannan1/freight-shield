# Freight Watch

Daily monitoring of carriers' FMCSA records for a broker's watchlist. When something changes (authority, insurance,
legal name, address, out-of-service), it records an alert, shows it on the dashboard and emails the watcher.

**Design rule:** all alert decisions are made by deterministic rules in `src/lib/rules/detect.ts`. Claude only writes
the short plain-English explanation in the email and on the dashboard, from facts the rules already produced. If the
Claude call fails or no key is set, a plain-text summary is used instead.

## What's built

| Piece | Where |
| --- | --- |
| Schema, RLS | `supabase/migrations/001_init.sql`, `002_billing_and_dashboard.sql` |
| FMCSA data layer (live + mock) | `src/lib/fmcsa/` |
| Change-detection rules | `src/lib/rules/detect.ts` |
| Daily job (snapshot, diff, alert, email) | `src/lib/job/snapshot-job.ts` |
| Claude summaries, email | `src/lib/alerts/` |
| Cron route | `src/app/api/cron/snapshot/route.ts` (scheduled in `vercel.json`, 11:00 UTC daily) |
| Landing page | `src/app/page.tsx` |
| Email sign-in (magic link) | `src/app/login/`, `src/app/auth/`, `src/middleware.ts` |
| Dashboard (alerts, watchlist, add carriers) | `src/app/dashboard/`, model in `src/lib/dashboard/model.ts` |
| Add carriers API | `src/app/api/carriers/route.ts` (cookie session or Bearer token) |
| Stripe checkout, billing portal, webhook | `src/app/api/billing/`, `src/app/api/stripe/webhook/`, `src/lib/stripe-sync.ts` |

Billing is enforced only when both `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set, so you can develop without
Stripe. When enforced, users without an active or trialing subscription cannot add carriers, and the daily job skips
their watches.

## Setup

1. `npm install`
2. Create a Supabase project. In the SQL editor run `supabase/migrations/001_init.sql`, then `002_billing_and_dashboard.sql`.
3. In Supabase, go to Authentication, then URL Configuration. Set the Site URL to your app URL and add
   `<your app URL>/auth/callback` (and `http://localhost:3000/auth/callback` for local work) to the redirect URLs.
   Keep the Email provider enabled. Magic links need working email, so for real use set up custom SMTP in Supabase,
   because the built-in sender is heavily rate-limited.
4. Register for a free FMCSA QCMobile web key.
5. Copy `.env.example` to `.env.local` and fill it in. `NEXT_PUBLIC_SITE_URL` must be the public URL in production,
   because login and Stripe redirects use it.
6. **Verify the FMCSA field names** against a real response before trusting alerts. `normalizeCarrier` in
   `src/lib/fmcsa/qcmobile.ts` maps the raw fields (for example `commonAuthorityStatus`, `bipdInsuranceOnFile`,
   `oosDate`), and the tests use my assumptions about them, not live data. Call
   `https://mobile.fmcsa.dot.gov/qc/services/carriers/<DOT>?webKey=<KEY>` for a carrier you know and compare.
7. Set `CRON_SECRET` to a long random string. Add all the same variables in Vercel.
8. Optional: `RESEND_API_KEY` and `ALERT_FROM_EMAIL` for real alert email (without them, alerts are logged to the
   console), and `ANTHROPIC_API_KEY` for Claude summaries.

### Stripe

1. Create a product with a recurring monthly price (the landing page says $25/month, so match it) and put the price
   id in `STRIPE_PRICE_ID`. Put your secret key in `STRIPE_SECRET_KEY`.
2. Add a webhook endpoint at `<your app URL>/api/stripe/webhook` for these events: `checkout.session.completed`,
   `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Put its signing
   secret in `STRIPE_WEBHOOK_SECRET`.
3. Turn on the customer portal in Stripe settings so "Manage billing" works.
4. Locally: `stripe listen --forward-to localhost:3000/api/stripe/webhook` gives you a webhook secret for development.

## Run locally

```bash
npm test            # 57 unit tests
npm run typecheck
npm run build
FMCSA_PROVIDER=mock npm run dev
```

With `FMCSA_PROVIDER=mock`, the fixture carriers are DOT 1000001 and 1000002 (MC 100001 and 100002).

Trigger the daily job by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/snapshot
```

## Rules in v1

| Rule | Severity |
| --- | --- |
| Not allowed to operate | critical |
| Common, contract or broker authority lost | critical |
| Liability insurance dropped to $0, or below the required minimum | critical |
| Legal name and address both changed (identity takeover pattern) | critical |
| New out-of-service date | critical |
| Liability insurance reduced, cargo insurance dropped, name alone, address alone | warning |
| DBA changed, fleet size doubled or halved (fleet of 5+) | info |

## Known limits

- Public FMCSA data only. It cannot see double brokering in progress, fake pickups or stolen identities that haven't yet
  changed the carrier's record. Describe it to customers as monitoring, not a guarantee.
- The first snapshot for a carrier is a baseline and never alerts.
- A subscription in any state other than active or trialing (including past_due) pauses monitoring right away. Add a
  grace period in `src/lib/billing.ts` if you want one.
- Emails go to the account email only. Per-user alert preferences come later.
- The login link must be opened in the same browser that requested it (a Supabase PKCE requirement).
- Not tested against live Supabase, Stripe or FMCSA from here. What I ran: unit tests, type-check, a production build,
  and a smoke test of the public pages, the login redirect and the unauthenticated API responses.
