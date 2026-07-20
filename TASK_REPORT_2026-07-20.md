# Task Report — 20 July 2026

Covers the **19–20 July** task list (both days together). Every item was checked against the actual code before being marked below.

**Summary: 6 of 8 done. 1 blocked on us, 1 needs the correct screenshot from you.**

> ✅ **This batch is LIVE.** Unlike the previous report, the code has been deployed and the work was carried out on the production site. Sparck's invoice and receipt exist in Certify.cx now.

---

# ✅ DONE

## 1 — Discount coupon in **$** instead of **%**

> *"Need to create Discount coupon to share with Clients based on $ instead of %. For example: US$ 200 Discount"*

The Discount Coupons page now offers a **percent / fixed-amount** choice. A US$200 coupon can be created directly, with quick presets for $50 / $100 / $200 / $500.

Where a client qualifies for both a percentage and a fixed amount, the system applies **whichever saves the client more**.

## 2 — Generate the invoice and share it with the client

> *"Need to generate the Invoice & be shared with the Client with mode of payment displayed & full payment information."*

Every application now has a **Billing** section. It produces a proper PDF invoice showing issuer details, bill-to, line item, subtotal, discount, total, **mode of payment** and bank details. It can be downloaded or emailed to the client.

## 3 — Payment receipt voucher

> *"After payment is received from Client, certify.cx will issue a payment receipt voucher & sent to client."*

Recording a payment issues a numbered **receipt PDF** and settles the invoice automatically — it flips to **Paid** and the client's balance clears.

## 4 — Sparck Services: complete onboarding up to invoice and receipt

Recorded end-to-end on the live site:

- **Application** — ISO 9001:2015 QMS, scope "Pest Control Services", Lebanon
- **Invoice INV/2026/117** — US$999.00 less US$699.00 ("Approved discount – WCA Global Management") = **US$300.00**, Cash, dated 10 July 2026 → **Paid**
- **Receipt CCX/RCP/2026/0001** — US$300.00 cash received 10 July 2026

> **Neither document has been emailed to Josephine.** They were held back deliberately so you can review the PDFs first — an invoice sent in error cannot be recalled. **Confirm and they will be sent.**

## 5 — Gap Analysis must not appear for consultancies

> *"This screen should not appear. THE GAP ANALYSIS IS ONLY OPTIONAL FOR CLIENTS."*

Removed for consultancies and investors. Only clients seeking their own certificate see it.

## 6 — "I am not able to add Sparck Services as a client" / "unable to view the dashboard" / "Consultancy can have the same process features as Referral/Affiliate"

All three were **one root cause**: a consultancy was being stored as a **client**.

That gave WCA the wrong dashboard entirely — the Gap Analysis prompt, "New Application", "My Certificates" — and, critically, **no way to add or track the clients it introduced**. That is exactly why Sparck could not be added.

Consultancy now has the same shape as Referral/Affiliate, as instructed. All three errors are resolved.

---

# ❌ NOT DONE

## 7 — Display WCA GLOBAL's 25% credit (US$75)

> *"WCA GLOBAL is the consultancy which brought the client Sparck Services… need to also display the 25% credit from the net sales in WCA GLOBAL account."*

**This will not happen automatically.** Sparck paid cash outside the platform, so nothing in the system links WCA to that sale. The credit has to be entered directly, and that requires WCA GLOBAL's account ID from the database.

**This is blocked on us, not on you** — it will be finished as soon as that lookup is run.

> Worth knowing: **future sales through the live checkout have the same gap.** Checkout never records which consultancy introduced the buyer, so no commission would be credited automatically. Sparck was handled by hand. Closing that properly is a separate piece of work — say the word.

## 8 — "Convert the above into the process to complete the payment & uploading the full documents up to the certification"

The screenshot attached to this instruction is the platform's **Companies list page** — not a flow diagram or a process chart. We cannot tell what is meant to be converted into what.

**Most likely the wrong image was attached.** Please resend it or describe the steps. (See Q4.)

---

# ⚠️ NEEDS VERIFYING — please run this first

One migration in this batch reassigned consultancy accounts. The screenshot of the run appeared to be missing a filtering line. **If it really was missing, every client in the system was converted into a referral.**

```sql
SELECT role, stakeholder_type, count(*)
  FROM public.profiles
 GROUP BY 1,2
 ORDER BY 1;
```

**Expected:** one `referral / consultancy` row (WCA GLOBAL). If a large `referral / client` group appears, tell us immediately — it is reversible, but it must not be left as is.

This has been requested several times and the result has not come back yet.

---

# ❓ QUESTIONS — please confirm

### Q1 — Whose name goes on the invoice?

The invoice currently shows **WCA GLOBAL FZE**, B21-057 Block B SRTI Park, Sharjah, **TRN 104366665800003**, with Mashreq bank details — all taken from the sample invoice you shared.

Your instruction says *"issue the Invoice & Receipt from Certify.cx"*.

If Certify.cx is a separate entity with its own address, TRN and bank account, **please send those details.** An admin can change them directly — no development work needed. Until then, every invoice the platform issues carries WCA GLOBAL's name and bank account.

### Q2 — What does the US$300 actually buy?

| Source | Model |
|---|---|
| **Certify.cx platform** | One fee of US$999 covering **3 years**, yearly surveillance included |
| **Your invoice to Sparck** | **"1 Year Initial"** + **US$150/year** surveillance in years 2 and 3 |

Two different commercial models. The answer changes **what Sparck is billed next year**. Please confirm which applies.

### Q3 — How many employees does Sparck have?

The employee count was set to **50** so the price came to US$999 and matched your figures (999 − 699 = 300). **Sparck's real headcount is not known to us.** If it differs materially, the list price changes.

### Q4 — The "HOW TO CONVERT THE ABOVE" screenshot

As above — please resend the intended image.

### Q5 — Was the US$699 a one-off, or should it be a reusable coupon?

Applied to Sparck as a one-off manual discount. The fixed-amount coupon feature is built either way — we only need to know whether a reusable code should exist.

### Q6 — Does the 25% apply to every consultancy, or only WCA GLOBAL?

Currently **every** consultancy is set to 25%. If that rate was agreed with WCA specifically, the others will be set individually.

---

# 🔧 Bugs found and fixed (not on your list)

Both were found while doing task 4, and both were blocking it.

1. **Admins could not create an application for a client at all.** The "Add Application" form submitted and silently did nothing — the database was rejecting every admin-created application. This affected all admins, not only this case.

2. **Every invoice carrying a discount would have failed to generate.** The PDF generator could not handle the minus sign on the discount line and aborted the whole document. Fixed more broadly than the symptom: invoices are now safe against special characters pasted from Word (curly quotes, long dashes) and non-Latin text, each of which would have caused the same failure.

---

# Technical status

- Deployed and verified working on the live site.
- New/changed code adds **no new lint errors** (the few that appear were verified as already present in the committed code).
- Migrations `phase19`, `phase20` and `phase21` have been run.
- Still outstanding from earlier batches: `phase9`, `phase13`, `phase17`, `phase18` have **never been run**. `phase9` is why "My Certificates" reports a missing table.
