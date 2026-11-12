# FreightShield

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
| Add carriers by paste or file upload | `src/app/dashboard/AddCarriers.tsx`, parsing in `src/lib/import-parse.ts` |
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
6. **Verify the FMCSA data against live responses before trusting alerts. Nothing here has been tested against live FMCSA.**
   Run `FMCSA_WEB_KEY=<key> node scripts/check-fmcsa.mjs <a DOT you know> <another>`. It prints which carrier fields
   come back, the raw `/authority` response, and (for insurance) the real Motus column names. The code reads authority
   from `/carriers/:dot/authority`; if that call fails it is logged and treated as unknown, never as "no authority".
   - Check the insurance numbers (`bipdInsuranceOnFile`) against the carrier's page on FMCSA's SAFER/L&I site. They may
     be stale if QCMobile derives them from FMCSA's older insurance extract.
   - Optional policy filings (cancellation notices): set `INSURANCE_SOURCE=motus` **only after** you have compared the
     real column names printed by the script with `src/lib/fmcsa/motus-columns.json` and corrected that file. The
     column names in it are guesses.
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
npm test            # 72 unit tests
npm run typecheck
npm run build
FMCSA_PROVIDER=mock npm run dev
```

With `FMCSA_PROVIDER=mock`, the fixture carriers are DOT 1000001 and 1000002 (MC 100001 and 100002).

Trigger the daily job by hand:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/snapshot
```

## Adding carriers by file

The dashboard accepts a pasted list or an Excel (.xlsx) or CSV file. The file is read in the browser and only the MC
and DOT numbers are sent to the server. The numbers are loaded into the text box first, so the user can review and edit
them before clicking Add. Rules for reading a file:

- A header row naming an `MC` or `DOT` column is the reliable way. Bare numbers in an MC column are read as MC numbers
  and bare numbers in a DOT column as DOT numbers. If a row has both, the DOT number is used. Other columns are ignored.
- A file with one column and no header is a plain list, and bare numbers are read as DOT numbers.
- A file with several columns and no MC or DOT header is read only for values with an explicit prefix, like `MC-123456`
  or `DOT 1234567`. Bare numbers are never guessed, because a zip code or quantity column would otherwise add unrelated
  carriers.
- Only the first sheet of a workbook is read. Old `.xls` files are rejected with a message to save as `.xlsx` or CSV.
- Limits: 2 MB per file, 500 carriers per submit. Submissions go to the server in batches of 20 so each request stays
  within the function time limit. If a batch fails (for example, the subscription lapsed), the carriers not yet
  processed stay in the text box.

`public/carrier-template.csv` is the template linked from the form.

## Rules in v1

| Rule | Severity |
| --- | --- |
| Not allowed to operate | critical |
| Liability cancellation notice (needs `INSURANCE_SOURCE=motus`): critical if no other policy is in force and it is within 14 days, else warning | critical/warning |
| Authority newly granted or reactivated | warning |
| Phone changed alone | warning |
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

## Alert settings (Settings page)

Run `supabase/migrations/003_alert_settings.sql` once. Each user then controls: email digest on/off and weekly (Fridays,
UTC) or daily cadence, text alerts (critical only, or critical plus review-level), a Slack webhook, and up to 5 extra
email recipients who get copies. Critical changes are always emailed at once when the digest is on. The digest is sent by
the same daily cron run. Texts need `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN` and `TWILIO_FROM_NUMBER`. The SMS, Slack
and digest sending code has unit tests but has not been run against live Twilio, Slack or Resend.
