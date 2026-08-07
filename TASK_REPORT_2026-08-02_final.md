# Task Report — 2 August 2026

Covers the WCA GLOBAL partner-agreements document. We first analysed it against the existing platform and found that ~70% of the signature system already existed (built 21 July for consultancies). You approved building the signature system for all four roles, with the referral rate set to a flat 10%. **That is complete and has been deployed.** The commission *payout* engines the contracts describe are a separate phase and are not included — details at the end.

---

## What was delivered (committed & pushed)

### 1. All four partner roles now sign their own legal agreement
Referral Partner (10%), Country Admin (1% override), Lead Auditor (5%/10% audit fee + 25% sales bonus), and Consultancy Partner (25%). The three new agreements were seeded from your document; an administrator can rewrite every word from the admin panel, which publishes a new version and never alters an already-signed copy. The agreement a person sees and signs is decided by their **role, on the server** — nobody can be recorded against an agreement that isn't theirs.

### 2. Force-scroll to accept
The **"I agree" checkbox stays disabled until the person has scrolled to the bottom** of the agreement, exactly as the developer guide specified. A short agreement that needs no scrolling enables immediately, so it never locks anyone out unfairly.

### 3. Signing enforced at first login ("during registration")
Because email verification was removed, a new partner lands on their dashboard the moment they register — so the very first thing they see is their agreement, and **they cannot use anything else on the platform until they scroll through it and sign.** An already-signed partner is never interrupted; if the wording is later updated, they are asked to accept the new version. The check fails safe — a network glitch never locks a partner out.

### 4. The immutable signature ledger — in your document's exact shape
Every acceptance is recorded permanently: **who signed, which version, the exact text they saw, their network address, a server-set timestamp**, plus a generated PDF.

Your document specified a ledger named `core_legal_signatures` with a precise column set (`signature_id`, `user_id`, `role_type`, `contract_version`, `client_ip`, `is_accepted`, `timestamp_utc`). That now exists **exactly as specified** — provided as a view over the authoritative signature table, so there is a single source of truth and no risk of two records disagreeing. Role labels are returned in your format (Referral_Partner, Country_Admin, Lead_Auditor, Consultancy_Partner).

### 5. Evidence integrity — the recorded IP is now un-forgeable
A signature is legal evidence, so the capture path was security-reviewed. The reviewer confirmed the identity of the signer and which contract they sign are both taken from the verified session, never the request — **forgery and signing-on-someone-else's-behalf are not possible.** One real weakness was found and fixed: the recorded IP address had been spoofable (it trusted a client-supplied header); it now uses the platform's trusted client-IP and ignores forged values. Verified against four spoofing attempts.

### 6. Referral commission set to a flat 10%
Per your decision, matching the Referral Partner Agreement. Consultancy stays at 25%; an admin can still set a custom rate for an individual partner.

### 7. Brand shown as "Certify.cx™" throughout
Swept the remaining rendered text — legal pages (Privacy, Terms), the invoice footer, partner-agreement copy in all nine languages, the platform-name setting, and the social/link-preview tags. The header, logo, emails and PDFs already carried the mark.

---

## ⚠️ Before signing works — one migration

**Run `phase29` and `phase30`** (they seed the three agreements and add the exact signature-ledger columns/view). Until then, partners see "no agreement published" and the sign-before-use gate stays open (nobody is locked out, but nobody can sign either). The code is already deployed; only the migrations remain.

---

## 🔴 Not included — the commission payout engines

The agreements *describe* payouts. Displaying and signing them (what you approved) is done. The actual money side is a much larger, separate phase, and two parts of it cannot be built without inputs only you can provide:

| Contract promises | Status |
|---|---|
| Referral 10% payout | ✅ Works today |
| Consultancy 25% payout | ✅ Works today |
| Country Admin — 1% network override | Not built. Buildable once you confirm how a partner is tied to a country admin (by region, or a separate network code). |
| Lead Auditor — 5%/10% fee + 25% bonus | Not built. Depends on the audit workflow (assignment, remote/on-site, quality check), which is only partial today. |
| "Net-net" (revenue after VAT/discounts/fees) | **Cannot build yet** — the platform does not record VAT per sale. We would compute a wrong figure. Needs VAT capture, or your agreement to treat "net-net" as "after discounts only". |
| Automated clawbacks on refunds | **Cannot build yet** — there is no refund flow in the platform to hook into. |
| Per-partner digital wallet | Not built. Needs the payout method decided (manual transfer, bank details, etc.). |

You said you'll advise on payouts later. When you do, three answers unblock most of it: (1) how a partner maps to a country admin, (2) whether "net-net" means after-tax or after-discount, and (3) how money reaches a partner.

---

## Technical status

- `npm run build` passes; API still within the 12-function hosting limit (the contract actions live in the existing user route — no new function).
- All changed files lint-clean.
- The role→contract mapping, the referral 10% rate, and the anti-spoof IP capture were each unit-tested; the signature-capture path was reviewed adversarially and its one real finding fixed.
- **Committed and pushed** (`0a8ee23`). The two migrations above are the only remaining step for signing to go live.
