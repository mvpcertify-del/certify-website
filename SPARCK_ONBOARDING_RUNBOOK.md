# Sparck Services — complete onboarding runbook

Recording an **already-completed offline sale** inside Certify.cx.

| | |
|---|---|
| Client | SPARCK SERVICES S.A.R.L — pest control, Lebanon |
| Contact | Josephine Semaan · josephine@sparck.services |
| Package | ISO 9001:2015 QMS Certification |
| List price | US$ 999 |
| Discount | US$ 699 — approved by WCA GLOBAL Management (not a coupon) |
| **Net paid** | **US$ 300, cash, 10 July 2026** |
| Introduced by | WCA GLOBAL (consultancy) |
| **WCA commission** | **US$ 75 — 25% of the US$ 300 net** |

**End state:** Sparck's account shows $0 due; WCA GLOBAL sees $75 on their own dashboard.

---

## Step 0 — Prerequisites (do these first, in order)

**0a. Verify phase19 did what it was supposed to.** The screenshot of the run appeared to be missing the `AND stakeholder_type = 'consultancy'` line. If it was, every client in the system became a referral.

```sql
SELECT role, stakeholder_type, count(*)
  FROM public.profiles
 GROUP BY 1,2
 ORDER BY 1;
```

Expected: exactly one `referral / consultancy` row (WCA GLOBAL). If a large `referral / client` group appears, **stop** — that needs reversing before anything else.

**0b. Run the outstanding migrations, in this order:**

1. `supabase/phase9_certificates.sql` — fixes the "Could not find the table 'public.certificates'" error
2. `supabase/phase13_renewal_reminders.sql`
3. `supabase/phase17_checkout_repair_and_country.sql`
4. `supabase/phase18_profile_fields.sql`
5. `supabase/phase20_billing_invoices_receipts.sql` — invoices, receipts, $-coupons, `payout_status`

**0c. Only then `git push`** (commit `350c358` is ready and waiting).

> ⚠️ Deploying before 0b breaks the Discount Coupons page and the Billing panel. This is the same failure mode that took production checkout down when phase8/11 were skipped.

---

## Step 1 — Confirm Sparck's records exist

```sql
-- The client account (it appeared in the Companies screenshot, joined 23/06/2026)
SELECT id, email, full_name, company_name, role, region, country, approval_status
  FROM public.profiles
 WHERE email = 'josephine@sparck.services';

-- Their application — the Billing panel lives on the application detail page
SELECT id, status, payment_status, payment_method, recommended_iso,
       selected_package, total_amount, coupon_code
  FROM public.applications
 WHERE client_id = '<SPARCK_PROFILE_ID>';
```

**If no application row exists**, create one — the Billing panel has nothing to attach to otherwise:

```sql
INSERT INTO public.applications (
  client_id, company_name, country, status,
  recommended_iso, selected_package, total_amount,
  payment_method, payment_status
) VALUES (
  '<SPARCK_PROFILE_ID>',
  'SPARCK SERVICES S.A.R.L',
  'Lebanon',
  'pending',
  'ISO 9001',
  'Standard',
  300,              -- what they actually paid
  'cash',
  'verified'        -- cash confirmed received 10 July
)
RETURNING id;
```

Keep the returned application id — Step 2 needs it.

---

## Step 2 — Issue the invoice (in the UI)

Open the application → **Billing** panel → **Create Invoice**.

| Field | Value |
|---|---|
| Bill to | `SPARCK SERVICES S.A.R.L` |
| Address | `Jounieh, Ghazir, Kesserwan` |
| Country | `Lebanon` |
| Email | `josephine@sparck.services` |
| Invoice number | **see the decision below** |
| Description | `ISO 9001:2015 QMS Certification — 1 Year Initial` |
| Subtotal | `999` |
| Discount amount | `699` |
| Discount label | `Approved discount — WCA Global Management` |
| Amount paid | `300` |
| Payment method | `Cash` |
| Issue date | `2026-07-10` |
| **Send by email** | **UNTICK IT — see below** |

### 🚨 Untick "send by email" on the first pass

That email goes straight to Josephine at a real company. Download the PDF, check it, show Midhat Sir, and only then send. An invoice that goes out wrong cannot be recalled.

### 🚨 Invoice number — decide before issuing

WCA has **already sent Sparck an invoice numbered `INV/2026/117`** for this exact sale.

- Leave the field blank → Certify.cx issues `CCX/INV/2026/0001`, and Sparck now holds **two different invoice numbers for one purchase**.
- Enter `INV/2026/117` → one consistent number, but Certify.cx's own sequence no longer matches its documents.

This is the client's call, not ours.

---

## Step 3 — Record the payment

Same panel → **Record Payment**:

| Field | Value |
|---|---|
| Against invoice | the invoice from Step 2 |
| Amount | `300` |
| Payment method | `Cash` |
| Payment date | `2026-07-10` |
| Memo | the invoice number |
| Send by email | untick on the first pass |

The invoice settles automatically and flips to **paid** — Sparck's account is now clear.

---

## Step 4 — Credit WCA GLOBAL with the $75

**This will not happen by itself.** Sparck never went through platform checkout, and the live guest-checkout path has no referral logic at all — so nothing links WCA to this sale. It has to be inserted.

```sql
-- 1. Get WCA GLOBAL's profile id
SELECT id, email, full_name, role, stakeholder_type, commission_percent_override
  FROM public.profiles
 WHERE stakeholder_type = 'consultancy';
```

Expected after phase19 + phase20: `role = 'referral'`, `commission_percent_override = 25`.

```sql
-- 2. Record the referral and its commission.
--    referred_email MUST be Sparck's login email — that is the only link
--    between a referral row and the buyer.
INSERT INTO public.referrals (
  referrer_id, referred_id, referred_email, referred_name, referred_company,
  status, payment_amount, commission_percent, commission_amount,
  tier_label, payout_status, converted_at
) VALUES (
  '<WCA_GLOBAL_PROFILE_ID>',    -- <<< from query 1
  '<SPARCK_PROFILE_ID>',        -- <<< from Step 1
  'josephine@sparck.services',
  'Josephine Semaan',
  'SPARCK SERVICES S.A.R.L',
  'converted',
  300,                          -- net sale
  25,                           -- agreed consultancy rate
  75,                           -- 25% of 300
  'Consultancy',
  'pending',                    -- not yet paid out to WCA
  '2026-07-10T00:00:00Z'
);
```

**Replace both placeholder ids before running.** Getting `referrer_id` wrong credits $75 to the wrong partner.

---

## Step 5 — Verify it end to end

```sql
-- Sparck owes nothing
SELECT invoice_number, subtotal, discount_amount, total, amount_paid, status
  FROM public.invoices WHERE bill_to_email = 'josephine@sparck.services';
-- expect: 999 / 699 / 300 / 300 / paid

-- The receipt exists
SELECT receipt_number, amount, payment_method, payment_date
  FROM public.payment_receipts WHERE customer_name ILIKE 'SPARCK%';
-- expect: 300 / Cash / 2026-07-10

-- WCA is credited
SELECT referred_company, payment_amount, commission_percent, commission_amount, payout_status
  FROM public.referrals WHERE referred_email = 'josephine@sparck.services';
-- expect: 300 / 25 / 75 / pending
```

Then **log in as WCA GLOBAL** and open the **Referral** page. Total Earnings must read **$75.00** and Sparck must be listed. That is the "display the 25% credit in WCA GLOBAL account" the client asked for.

> Before phase19, WCA was on the `client` role and could not reach that page at all — that was the "unable to view the dashboard" error in their screenshot.

---

## Still unanswered — confirm with the client

1. **Invoice number** — `INV/2026/117` or a new Certify.cx series? (Step 2)
2. **Invoice issuer** — the PDF currently carries WCA GLOBAL's name, address, TRN and Mashreq bank details, taken from the client's own sample invoice. The instruction says "issue from Certify.cx". If Certify.cx has its own entity and bank account, an admin can change it in `org_settings` without a code change.
3. **What does the $300 actually buy?** WCA's invoice describes it as **"1 Year Initial"** with **US$150/year surveillance** for years 2 and 3. The platform sells one $999 package covering **3 years**. These are two different commercial models, and the answer changes what Sparck is billed next year.
4. **Was the $699 a one-off, or should a reusable coupon exist?** The `$`-amount coupon feature is built either way.
5. **25% — WCA only, or every consultancy?** phase20 currently seeds *every* consultancy at 25%.

---

## Known limitation worth raising

Future sales through the live checkout **will not credit a consultancy automatically** — `guestCheckoutHandler` never resolves a referral. Sparck is being handled manually here, but every subsequent sale would need the same manual insert until that gap is closed. It is a separate piece of work; say the word.
