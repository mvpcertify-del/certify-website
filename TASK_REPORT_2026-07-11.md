# Task Report — 11 July 2026

**Focus:** Client purchase experience — remove confusing steps, make checkout easy (per client feedback of 10–11 July).

Two batches were completed today:
- **Batch A** — Rebuilt the purchase funnel (pay-first, no signup gate).
- **Batch B** — Removed the extra-employees / extra-locations pricing calculator from the packages page.

---

## Batch A — New pay-first purchase flow

### Summary

| # | Client request | Status |
|---|----------------|--------|
| 1 | Remove the "How would you like to join?" account-type step for buyers | ✅ Done |
| 2 | Remove email verification *before* purchase (for clients) | ✅ Done |
| 3 | Remove the "Sign in / create account" gate before checkout — register in the final payment step | ✅ Done |
| 4 | Fix the confusing pricing area (two calculators showing different prices) | ✅ Done |
| 5 | Payment options stacked on top of each other: Card / Cash / Bank Transfer | ✅ Done |
| 6 | New 3-step purchase flow + verification email with dashboard link after payment | ✅ Done |
| 7 | Only clients who completed payment get dashboard access | ✅ Done |

### The new purchase flow (exactly as requested)

**1. Customer selects the certification** → lands on the ISO page.

**2. Customer views packages & selects one** → Bronze / Silver / Gold.

**3. Payment window opens** — no login, no signup, no account-type page:
- The three payment methods are shown **stacked**: **Card**, **Cash**, **Bank Transfer**.
- The customer fills in their **contact information** (name, email, company, phone, country) right here.
- **Card:** pays securely via Stripe → on success, the account is created and a **verification email with a one-click link to the dashboard** is sent.
- **Cash / Bank Transfer:** the order is recorded and the customer is told we'll email their dashboard link **once our team confirms the payment** (admin verifies, then the link is sent automatically).

**Access rule:** Only customers who have completed payment can reach the dashboard. Unpaid orders cannot log in.

### What was removed / changed
- ❌ The account-type selection page ("Client / Auditor / Affiliate / …") is no longer part of buying.
- ❌ The "Almost there — sign in or create your account" gate before payment is gone.
- ❌ Email verification is no longer required *before* buying. The verification email now arrives *after* payment, as the access link.
- ✅ Payment methods reduced to the three requested (PayPal and MoneyGram removed).

---

## Batch B — Removed the extra-employees / extra-locations calculator

Per the 11 July message ("For ISO 9001, hide the pricing calculator for extra employees & extra locations… remove all above information"):

- ❌ Removed the **Organization Size** control (Additional employees / Additional locations).
- ❌ Removed the **Pricing Calculator** and its price summary.
- ❌ Removed the **"prices are based on up to 10 employees…" note**.

The packages section now shows **three clean prices only** — the customer picks one and pays. Applied across all ISO standards for a consistent look (using ISO 9001 as the review example).

**Prices shown (ISO 9001):** Bronze **$799** · Silver **$999** · Gold **$1,199** (organization up to 10 employees at 1 location). Larger organizations are handled by the team after purchase.

**Desktop + Mobile preview provided** for client review (shareable link).

---

## Notes / still needed from client

- **Bank IBAN and cash-collection contact details are still placeholders** (`XXXX`) in the code. Please share the real bank account (beneficiary, bank name, IBAN, SWIFT) and the cash-payment contact so Cash / Bank Transfer can go live. **Card payments work already.**
- **Scope check (Batch B):** the calculator was removed on all ISO pages, not only ISO 9001. If it should stay on other standards, let us know.
- Larger organizations no longer size themselves on the pricing page — this is now handled after purchase.

---

## Technical status
- All changes build successfully and passed an internal review (security + payment-flow checks). Two dedicated review passes were run on the new checkout code; all findings were fixed.
- **Ready for a live test run** on the deployed site.
- Not yet committed/deployed — awaiting go-ahead.
