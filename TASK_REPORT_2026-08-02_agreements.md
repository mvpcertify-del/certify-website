# Task Report — 2 August 2026 (Partner Legal Agreements)

Covers the WCA GLOBAL agreements document. Before building anything we mapped it against the existing code and reported that **~70% of the e-signature system already existed** (built 21 July for consultancies). You approved **Option A** — the signed-agreement system for all four partner roles — plus setting the referral rate to a **flat 10%**. Both are done.

**Summary: delivered. Needs one database migration before it works. Two payout engines described in the contracts are deliberately out of scope — see "Not built".**

---

## What was delivered

### 1. All four partner roles now have their own legal agreement to sign
- **Referral Partner** (10% commission), **Country Admin** (1% override), **Lead Auditor** (5%/10% audit fee + 25% sales bonus), and **Consultancy Partner** (25%, already existed).
- The exact text of the three new agreements was transcribed from your document into the platform, where an administrator can rewrite every word later (which publishes a new version and never rewrites an already-signed copy).
- The contract shown and signed is decided by the person's **role on the server** — nobody can be recorded as signing an agreement that isn't theirs.

### 2. Force-scroll to accept
As the developer guide asked: the **"I agree" checkbox stays disabled until the person has scrolled to the bottom** of the agreement. A short agreement that needs no scrolling enables straight away, so it never locks anyone out unfairly.

### 3. The immutable signature record — now in your document's exact shape
Every acceptance is recorded permanently with **who signed, which agreement version, the exact text they saw, their network address, and a server-set timestamp** — plus a generated PDF of the signed agreement.

Your document specified a ledger named `core_legal_signatures` with a precise set of columns (`signature_id`, `user_id`, `role_type`, `contract_version`, `client_ip`, `is_accepted`, `timestamp_utc`). That now exists **exactly as specified** — as a view over the authoritative table, so there is a single source of truth for the signatures and no risk of two records disagreeing. The three items the spec had that the table lacked were added: an explicit `is_accepted` flag, a string version label (e.g. `v1_UIL_NetSales`), and `client_ip` made non-null (an address we genuinely can't capture is recorded honestly as "unknown", never invented). Role labels are returned in your document's format (Referral_Partner, Country_Admin, Lead_Auditor, Consultancy_Partner).

### 4. Referral commission set to flat 10%
Per your decision, the referral rate is now a **flat 10%**, replacing the earlier Bronze/Silver/Gold volume ladder. This matches the Referral Partner Agreement text. Consultancy stays at 25%; an admin can still set a custom rate for an individual partner.

### 5. Security-reviewed (it's legal evidence)
Because a signature is legal evidence, the capture path was reviewed adversarially. The core was already sound — the signer's identity and which contract they sign are both taken from the verified session, never from the request, so **forgery and signing-on-someone-else's-behalf are not possible**. One real weakness was found and fixed:

- **The recorded IP address was spoofable.** It trusted the leftmost value of a client-supplied header, so a signer could have made the record show any address they liked — exactly the field that is supposed to be un-forgeable evidence. It now uses the platform's trusted client-IP header (and ignores a forged one). Verified against four spoofing attempts.

Two minor issues were also fixed: the role now authoritatively decides the contract type (over a legacy field), and an admin can no longer publish a template under a mistyped role.

---

### 6. Signing is now enforced, at first login ("during registration")
The document asked for acceptance "during registration". Because email verification was removed, a new partner now lands on their dashboard the moment they register — so the very first thing they are shown is their agreement, and **they cannot reach anything else on the platform until they scroll through it and sign.** An already-signed partner is never interrupted. If the agreement's wording is later updated (a new version), they are asked to accept the new one before continuing. The check fails safe: a network glitch or a not-yet-published agreement never locks a partner out.

### 7. Brand shown as "Certify.cx™" throughout
The developer guide asked for the brand to render strictly as **Certify.cx™** across public views, headers and legal clauses. The header/logo, emails and PDFs already carried the ™; we swept the remaining rendered text — the legal pages (Privacy, Terms), the invoice footer and partner-agreement copy in all nine languages, the platform-name setting, and the social/link-preview tags — so the mark is now consistent everywhere it is shown.

---

## ⚠️ Before this works — one migration

**Run `phase29`** (seeds the three new agreements: Referral, Country Admin, Lead Auditor). Without it, those three roles will see "no agreement published". Then deploy the code.

---

## 🔴 Not built — and why (needs your decision)

The four agreements *describe* commission payouts. Displaying and signing the agreements (what you approved) is done. But the actual **payout engines** for two of them do **not exist** and were **not** built — they are a much larger, separate phase, and building payout logic from contract prose before the commercial rules are settled is how you end up paying wrong amounts:

| Contract promises | Reality today |
|---|---|
| **Country Admin — 1% override** on every sale in their country network | No override engine exists. Country admins are paid nothing today. |
| **Lead Auditor — 5%/10% audit fee + 25% sales bonus** | No auditor payout exists today. |
| Net-net calculation (revenue after VAT/discounts/fees), automated clawbacks on refunds, per-partner digital wallet | None of these exist yet. |

The agreements can be signed now; **the money side of the Country Admin and Lead Auditor contracts is a follow-up phase** (roughly 6–9 days, as estimated in the analysis) once you confirm the exact rules. Referral (10%) and Consultancy (25%) payouts **do** work today.

Also worth noting: we did **not** re-word the existing Consultancy agreement to match your document's version, because consultancies have already signed the current text and changing it would force them all to re-sign. Say the word if you want the consultancy wording aligned too (it publishes as a new version).

---

## Technical status

- `npm run build` passes; API still within the 12-function hosting limit (no new function — the contract actions live in the existing user route).
- All changed files lint-clean (two pre-existing warnings in the menu file were confirmed present before this work).
- New "scroll to continue" text translated into all nine languages.
- The role→contract mapping (7 cases), the referral 10% rate, and the anti-spoof IP capture (4 cases) were each unit-tested.
- The signature-capture path was reviewed adversarially; the one real finding (spoofable IP) and two minor ones were fixed.
