# Odoo Accounting mirror (MVP)

Status: **built and tested. Connection to Odoo verified read-only on 10 Nov 2026. Runs in dry-run by default. Migration phase46 not applied to any database.**
Odoo: `https://certify.odoo.com`, database `certify`, **Odoo 20.0+e (Enterprise)**, 14-day trial. JSON-2 API works with the API key.

### Observed in the Odoo database (read-only, 10 Nov 2026)
- Company **CERTIFY**, country India, **company currency INR**. **USD exists but is inactive**: it must be activated before USD invoices can be created.
- Journals: `Sales` (id 9, sale), `Bank` (id 14, bank), plus purchase/general journals. No Whop-specific bank journal yet.
- Income accounts present (ids): Local Sales 89, Retail Sales 90, Export Sales 91, Local Services 92, Export Services 93, and others. Which one certification fees belong in, the tax treatment (Indian GST on a foreign customer), the USD to INR rate and which bank journal receives Whop money are **accounting decisions for the owner or accountant**; nothing is defaulted.

## What it does

For every **verified Whop card payment for a certification order**, it mirrors the accounting record into Odoo:

1. **Customer**: finds or creates the Odoo contact (`res.partner`) for the buyer.
2. **Invoice**: creates and posts a customer invoice (`account.move`), one line per order in the payment.
3. **Payment**: registers the payment against that invoice, only because the Whop `payment.succeeded` event was signature-verified.

Certify.cx keeps issuing its own customer-facing invoice. Odoo holds the mirrored accounting record. Out of scope: CRM, HR, Sales, MICRO monthly plans, bank-transfer/cash orders, refunds, Whop fees.

## Safety, by design

| Rule | How it is enforced |
|---|---|
| Off by default | Two switches, both must be on: env `ODOO_SYNC_ENABLED=true` and the database row `odoo_sync_settings.enabled`. |
| **Dry-run by default** | `ODOO_DRY_RUN` is true unless set to `false`. In dry-run nothing is sent to Odoo, no credential is needed, and each job stores the exact operations it would have performed (admin screen: "View plan"). |
| Existing payments untouched | No edit to `api/checkout.js`, the Whop webhook or fulfilment. A database trigger on `whop_webhook_events` only enqueues a job, and can never fail a payment (errors are swallowed with a warning). |
| No back-fill | Only events created after the switch was turned on are enqueued. |
| No duplicates | One job per Whop payment id (`UNIQUE`), atomic claim, look-up of an existing Odoo invoice by `ref` before creating, Odoo ids saved the moment they exist, payment skipped if the invoice is already paid. |
| Never "paid" on a guess | The payment is registered only from a verified event, for the verified amount. |
| No invented accounting | Journals and income account/product come only from settings; tax lines are explicitly empty unless `ODOO_TAX_IDS` is set; the invoice total is checked against the payment while still a draft, so a wrong total (for example Odoo adding tax) is never posted. |
| Stop and ask | Amount mismatch, refunds, unknown currency, two matching customers, validation errors: the job goes to `needs_review` for a person. |
| Preview vs production | A preview deployment refuses `ODOO_ENV=production`; the production deployment refuses `sandbox`. |
| Secrets | Odoo credentials are server-side env vars only; error text is redacted before it is stored or logged; the admin screen never receives them. |
| No 13th function | Handlers live in `_`-prefixed files and hang off `api/notify-event.js` (the cron route). The function count stays at 12. |

## Files

New
- `supabase/phase46_odoo_accounting.sql`: settings switch, job queue, record map, enqueue trigger, RLS (Super Admin and Finance read only).
- `api/_odoo.js`: configuration, redaction, Odoo client (JSON-2 for Odoo 19, JSON-RPC for older).
- `api/_odooSync.js`: the sync logic (customer, invoice, payment), retry and backoff, worker.
- `api/_odooDryRun.js`: dry-run stand-in for Odoo and the "remember nothing" store wrapper.
- `api/_odooStore.js`: persistence over Supabase.
- `api/_odooAdmin.js`: admin actions and the cron sweep.
- `src/components/admin/OdooSyncPanel.jsx` and `.css`: the "Odoo accounting" tab.
- `tests/odoo/*.test.mjs` and `fakes.mjs`: automated tests (58).
- `scripts/odoo-sandbox-check.mjs`: integration check against a real sandbox.

Modified
- `api/notify-event.js`: 11 added lines (dispatch `odoo-*` actions; run the sweep on the daily cron).
- `src/pages/admin/AdminBilling.jsx`: a Super-Admin-only "Odoo accounting" tab.
- `src/i18n/locales/en.json`: `odooSync.*` keys. `package.json`: `test:odoo`. `.env.example`: Odoo block.

## Environment variables (server-side, Vercel)

Nothing is needed for dry-run except the switch:

| Variable | Dry-run | Live | Notes |
|---|---|---|---|
| `ODOO_SYNC_ENABLED` | `true` to run | `true` | Anything else = off |
| `ODOO_DRY_RUN` | unset or `true` | `false` | Only the exact value `false` goes live |
| `ODOO_ENV` | n/a | `sandbox` or `production` | Must match the deployment (see above) |
| `ODOO_URL` | n/a | `https://certify.odoo.com` | https only |
| `ODOO_DB` | n/a | the database name | |
| `ODOO_API_KEY` | n/a | integration user's API key | Never `VITE_*`; never in chat |
| `ODOO_API_STYLE` | n/a | `json2` (default, Odoo 19) | `jsonrpc` for 14-18 (then `ODOO_LOGIN` too) |
| `ODOO_SALES_JOURNAL_ID` | n/a | id | Customer Invoices journal |
| `ODOO_PAYMENT_JOURNAL_ID` | n/a | id | Bank-type journal for Whop receipts |
| `ODOO_INCOME_ACCOUNT_ID` or `ODOO_PRODUCT_ID` | n/a | id | Never defaulted |
| `ODOO_TAX_IDS` | n/a | optional | Empty = no tax added |

## Odoo configuration checklist (done in Odoo)

1. Plan with **external API access** (Custom plan on Odoo Online); confirm before relying on the trial.
2. Accounting app installed; **fiscal localization / chart of accounts** chosen by the accountant.
3. **USD** currency enabled (Accounting settings).
4. A **Customer Invoices** (sales) journal; note its id.
5. A **bank-type journal for Whop receipts** (clearing); note its id. Reconciliation of Whop payouts is a later step.
6. An **income account** (or a product) for certification fees; note its id. Tax treatment is decided by the owner, not defaulted here.
7. A dedicated **integration user** with Invoicing access only (not an administrator), and an **API key** for it. Put the key only in Vercel's environment variables, in the Preview scope first.
8. Note the **database name** (for `ODOO_DB`).

## Database migration (staging first)

1. Create or pick the **staging/preview Supabase project**. Do not use production.
2. Run `supabase/phase46_odoo_accounting.sql` in its SQL editor. It is idempotent. Rollback commands are in the file's header.
3. The integration stays off: `odoo_sync_settings.enabled` defaults to `false`.
4. To start enqueueing (staging only): `UPDATE odoo_sync_settings SET enabled = true, enabled_at = now(), updated_at = now();`

## Test results

- `npm run test:odoo`: **58 tests, all passing** (configuration and safety rules, both Odoo transports with a mocked network, the full customer, invoice and payment flow, duplicate prevention, resume after failure, retry and backoff, dead jobs, the preview/production guard, secret redaction, dry-run behaviour and requeue).
- `npm run build` passes; lint is clean on every new and changed file; the serverless function count is still 12.
- The admin panel was rendered with mock data and checked visually (dry-run state, plan viewer, retry, status chips).
- **Not yet done: any test against a real Odoo** (no credentials by design). `scripts/odoo-sandbox-check.mjs` does that once credentials exist:
  - `node --env-file=<your sandbox env file> scripts/odoo-sandbox-check.mjs` (read-only: reach, credentials, journals, account, USD).
  - add `--write` for a round trip of one synthetic USD 1.00 payment run twice to prove no duplicate. Refuses unless `ODOO_ENV=sandbox`. Use a throw-away database: posted invoices cannot be deleted in Odoo.
- **Verified against the real server (read-only):** `GET /web/version` returns `20.0+e`; `POST /json/2/res.users/search_read` with the bearer key succeeds; company, currency, journal and account reads work. The write calls (create partner, create and post invoice, payment-register wizard) are **not yet exercised against a real Odoo**; they follow the Odoo JSON-2 conventions and are covered only by the mock tests. On the production database they are first exercised by the first real payment, in dry-run first. Posted invoices cannot be deleted in Odoo, so no synthetic test invoice is created there.

## Remaining manual tasks

1. Confirm the Custom plan and external API access; create the integration user and API key; note the database name and the journal/account ids.
2. Apply `phase46` to the **staging** Supabase project.
3. Staging Vercel (Preview scope) variables: `ODOO_SYNC_ENABLED=true`, leave dry-run on at first. Preview deployments currently share production's Supabase, Whop and Resend settings; point Preview at a separate Supabase project and Whop test mode before any end-to-end test.
4. Review dry-run plans on real staging payments ("Billing", "Odoo accounting", "View plan").
5. Run the sandbox check; then set `ODOO_DRY_RUN=false` in Preview, run one Whop test-mode payment, confirm the invoice and payment in Odoo.
6. Decide the open business points: tax treatment, income account, Whop fees and payouts, refunds (credit notes), bank-transfer orders, MICRO monthly plans.

## Deployment after approval (not before)

1. Review and approve the branch; merge `feat/odoo-accounting` to `main`. Vercel deploys it. With no Odoo variables set it is inert.
2. Apply `phase46` to the **production** Supabase project only now.
3. In production, set `ODOO_ENV=production` and the Odoo variables; keep `ODOO_DRY_RUN` unset (dry-run) and `ODOO_SYNC_ENABLED=true`; enable the database switch. Review dry-run plans on live payments.
4. When satisfied: set `ODOO_DRY_RUN=false`; in Billing, "Odoo accounting", use **Queue dry runs for live sync** if the dry-run payments should be mirrored, then **Sync now**.
5. Rollback at any time: set `ODOO_SYNC_ENABLED` to anything but `true`, or `UPDATE odoo_sync_settings SET enabled = false`. The Whop payment path is never affected.

Notes: the daily Vercel cron runs the sweep once a day on the Hobby plan; use "Sync now" for immediate processing. The worker has a short time budget so it cannot starve the renewal sweep.
