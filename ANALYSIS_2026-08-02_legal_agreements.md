# Deep Analysis — "2 August 2026 Task" (Legal Agreements + E-Signature)

## What the document actually asks for

Two things, and it's important to separate them:

**Part A — the developer task (the "UI/UX Platform Configuration Guide").** This is the real build request:
1. Show each of **four** role-specific legal agreements in a scrollable box during/at registration.
2. **Force-scroll**: the "I agree" checkbox stays disabled until the user scrolls to the bottom of the contract.
3. An **immutable signature ledger** — a table (`core_legal_signatures`) recording who signed which contract version, from which IP, at what timestamp.
4. **Brand string** hard-coded to `Certify.cx™` everywhere.
5. Store the **four contracts** as editable text assets; the router serves the right one per role.

**Part B — the four contract texts themselves** (Referral 10%, Country Admin 1% override, Lead Auditor 5%/10% + 25%, Consultancy 25%). These are the *content* to display and sign. But their commission clauses also *describe payout engines* — which is a separate, much bigger question (see "The big catch" below).

---

## The single most important finding: ~70% of Part A already exists

We built a full partner-contract e-signature system on **21 July (phase23)** for consultancies. The document is essentially asking to extend it from one role to four. What already exists:

| The document asks for | Already built (phase23) |
|---|---|
| Contract stored as editable, versioned text | `contract_templates` table — `partner_type`, `version`, `title`, `body`, `term_months`. **`partner_type` already accepts any role.** |
| Immutable signature record with IP + timestamp + version | `contract_acceptances` table — `profile_id`, `partner_type`, `version`, **`accepted_ip`**, `user_agent`, `accepted_at`, `signed_name`, plus a **full snapshot of the exact text signed** (stronger than the document's spec) |
| "signs a version once" | unique index on (profile, partner_type, version) already enforces it |
| PDF of the signed agreement | `buildContractPdf` already generates + stores it |
| Admin can edit the contract text | `saveTemplate` + the Settings agreement tab already do this for consultancy |
| Scrollable contract + name + checkbox + submit | `PartnerContract.jsx` already renders all of this |
| Re-sign when the text changes | already handled (version bump → re-acceptance) |

So the document's proposed `core_legal_signatures` table is **already implemented, and more completely**, as `contract_acceptances`. We should reuse it, not build a second one.

**What is genuinely missing / new in Part A:**

| # | Task | Notes | Est. |
|---|---|---|---|
| A1 | **Force-scroll gate** — disable the checkbox until the contract is scrolled to the bottom | New UI logic in `PartnerContract.jsx` (and the registration form if inline). The document's core new requirement. | 0.5 day |
| A2 | **Add 3 contract texts** — Referral, Country Admin, Lead Auditor (Consultancy exists) | Migration seeding the exact text from the document; align the existing consultancy text to the doc's wording. Careful legal transcription. | 0.5 day |
| A3 | **Open the contract page to all 4 roles** | Today `/partner/contract` is gated to CONSULTANCY only. Extend the route + role→partner_type mapping so referral, country-admin and auditor each get theirs. | 0.5 day |
| A4 | **Show the agreement at registration** ("I agree during sign-up") for each role's tailored link | The document wants acceptance *at* registration. Today the consultancy signs it *after*, on its own page. Embedding the scroll-contract + force-scroll checkbox into the sign-up wizard per role is the biggest single piece. | 1–1.5 days |
| A5 | **Admin editing for all 4 templates** | Extend the existing consultancy admin tab to pick which of the 4 to edit. | 0.5 day |
| A6 | **Brand `Certify.cx™` audit** + generalise the PDF filename/labels for 4 roles | Mostly already done (the logo carries ™); a sweep + PDF label tweak. | 0.5 day |
| A7 | **i18n** for all new strings across 9 languages | | 0.25 day |
| A8 | **Signature ledger alignment** — confirm `contract_acceptances` captures everything the doc wants (add an explicit `is_accepted` / string `contract_version` label if you want them literally) | Reuse, don't rebuild. | 0.25 day |

**Part A total: ~3.5–4.5 days.**

---

## ⚠️ The big catch — the contracts promise payouts that DON'T EXIST yet

Each contract's commission section describes a payout the platform does not currently calculate. This is described in the *contract text*, but the developer guide (Part A) only asks to capture *signatures*. These are separate, much larger builds — and two of them are brand-new engines:

| Role | Contract promises | Reality today | New work if you want it live |
|---|---|---|---|
| **Referral Partner** | flat **10%** of net-net | We built a **volume tier ladder** (10/15/20/25%) on 19–24 July | ⚠️ **Conflict.** Flat 10% contradicts the tiers you approved. Needs a decision, then ~0.5 day to align. |
| **Consultancy Partner** | **25%** of net-net | Already **25%** | ✅ Matches. No work. |
| **Country Admin** | **1% override** on every sale by anyone in their country network | Country admins earn **nothing** today; there is no network-override engine at all | 🔴 **New engine.** Attribute every partner/auditor to a country admin, compute 1% on each cleared sale, ledger it, pay it out. **~2–3 days.** |
| **Lead Auditor** | **5%/10%** audit service fee **+ 25%** if they bring the client | Auditors are **not paid** anything today | 🔴 **New engine.** Two payout types (project fee + dual-role sales bonus), tied to audit completion + quality check. **~2–3 days.** |

Also embedded in the text but not built: **net-net calculation** (revenue after VAT/discounts/fees), **automated clawbacks** on refunds, and a **digital wallet balance** per partner. Each is real engineering, none exists today. Clawbacks + wallet: **~2–3 days** on their own.

---

## Recommended split — two decisions for the client

**Decision 1 — scope now:**
- **Option A (the document's actual dev request): just the signed agreements.** Show all 4 contracts, force-scroll, capture the immutable signature. This is legally the priority (it's what protects the company), reuses 70% of existing code, and is **~3.5–4.5 days**.
- **Option B: agreements + the payout engines.** Add the Country Admin 1% override and the Lead Auditor fee/bonus engines, net-net, clawbacks, wallet. **+6–9 days** on top of Option A.

**Decision 2 — the referral 10% conflict:** the referral contract says flat 10%, but you approved a 10/15/20/25% volume ladder last month. Which wins? (The contract text needs to match whatever the platform actually pays, or partners will dispute it.)

**Our recommendation:** do **Option A now** (the signature system — that's what the document's developer section is truly about), and treat the Country-Admin and Lead-Auditor payout engines as a separate, scheduled phase once you confirm the exact commercial rules. Building payout logic from contract prose, before those rules are settled against the existing tier system, is how you end up paying the wrong amounts.

---

## If you approve Option A, the build order

1. Migration: seed Referral / Country-Admin / Lead-Auditor templates + align Consultancy (A2, A8).
2. Force-scroll checkbox gate (A1).
3. Open the contract route to all 4 roles + role→type mapping (A3).
4. Registration-time acceptance per role (A4).
5. Admin editing for 4 templates (A5).
6. Brand ™ sweep + PDF generalisation (A6).
7. i18n (A7).
8. Verify: build, lint, and an adversarial review of the signature-capture path (it's legal evidence — the IP/version/timestamp must be un-forgeable).

---

*Analysis only — nothing built yet. Awaiting the two decisions above.*
