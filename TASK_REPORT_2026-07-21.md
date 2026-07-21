# Task Report — 21 July 2026

Covers the **21 July** task list (Add Consultancy / activate Consultancy partners / contract & KPI). Every item was checked against the actual code before being marked below.

**Summary: 9 of 10 done. 1 needs your clarification.**

> ⚠️ **READ THIS FIRST — the platform is currently in a half-applied state.**
>
> The database migrations have been run, but the code has **not** been deployed yet. That combination has one visible consequence: **the WCA GLOBAL account cannot be used right now.** The database has already moved it to the new Consultancy role, but the live site does not yet know that role exists, so the account signs in to an empty dashboard.
>
> Nothing else is affected — clients, applications, Sparck's invoice and receipt are all untouched. Deploying the code resolves it immediately. Until then, please do not test the WCA GLOBAL login.

---

# ✅ DONE

## 1 — "You need to Add Consultancy"

Consultancy is now a role in its own right. It appears in the **Create User** and **Edit User Role** dropdowns alongside Client, Auditor, Certification Body and Referral — the gap in your first screenshot.

## 2 — Consultancy in Roles & Permissions

The permissions grid now has a **Consultancy** column, so its access can be tuned like every other role. The database constraint behind that screen was widened too — without it the toggles would have looked like they saved and silently failed.

## 3 — "Do not classify as referral"

Consultancy is no longer the referral role.

This corrects a decision from 19 July. Your instruction then was *"Consultancy can have the same process features as Referral/Affiliate"*, and we implemented it by making consultancy **be** the referral role. That gave it the right screens but made it indistinguishable from an affiliate everywhere else — which is exactly what produced the two problems in your screenshots.

Consultancy now keeps the same screens while being counted, filtered and paid on its own terms.

## 4 — "Consultancy partners is already displayed in the Main Dashboard — you just need to activate it"

Fixed, and the cause is worth stating plainly: **the box read 0 because of our own change on 19 July.** It counts consultancies one way, and that migration moved them somewhere else, so from that moment the count could only ever be zero. The **Referrals** figure of 14 had absorbed them, so that number was overstated by the same amount.

Both boxes now count correctly and no longer overlap. The Consultancies box opens the new partner screen.

## 5 — "Consultancies will get 25% on each Client whom they onboard"

Every consultancy is set to 25% of the net sale. A partner onboarded in future also gets 25% automatically rather than falling onto the volume-based Bronze/Silver/Gold ladder, and an administrator can still set a different rate for an individual partner.

## 6 — "The monthly KPI for a Consultancy partner is 5 paying Clients per month"

A new **Consultancy Partners** screen shows, for each partner: clients this month against the target of 5, the last 3 months, lifetime clients, commission earned, commission rate, and contract status.

## 7 — "If no business is generated in 3 months then the account will be deactivated"

Partners with no business in 3 months are flagged **At risk** and listed first.

**One deliberate difference from the literal instruction, which we would like you to confirm:** the system flags these partners, it does **not** deactivate them automatically. Automatically disabling a partner's login with nobody reviewing it is difficult to undo, and the first account it would have affected is WCA GLOBAL. An administrator sees the flag and deactivates from User Management with one click. The screen states this so nobody assumes it happens by itself.

If you would prefer it to be fully automatic, say so and we will change it.

## 8 — "Create an Electronic contract which each Consultant partner will sign digitally"

A partner now has an **Agreement** page: they read the contract, type their full name, tick to confirm, and accept. The signature record stores the name, the date and time, and the network address it came from, and produces a **PDF** they can download at any time. Administrators can see who has signed and which version.

## 9 — "Valid for 12 months renewable & effective from date of approval by Certify.cx Administrator"

Implemented exactly as written: the 12 months run from the **administrator's approval date**, not from the date of signature. A partner who signs before being approved does not have a contract quietly counting down — the term starts the moment you approve them.

## 10 — "Already Consultancies has been created but requires proper activation & linking"

Existing consultancy accounts were migrated to the new role, given the 25% rate, and linked to the new partner screen.

---

# ❓ NEEDS YOUR CLARIFICATION

## "…& need to follow up with client to complete payment"

This is written into the agreement as the Partner's obligation, so the contractual side is covered.

What we have **not** built is a follow-up feature in the platform — a list of the partner's unpaid clients, reminders, or a chase workflow. It is not clear from the instruction whether you meant a contractual duty or a tool.

**Please confirm which**, and if it is a tool we will scope it separately.

---

# 📄 The contract text — please review before anyone signs

We have drafted the agreement from the terms in your own message: 25% commission, the 5-clients-per-month KPI, the 3-month rule, a 12-month renewable term running from approval, plus standard confidentiality, data protection, termination and governing-law clauses (UAE).

**This draft has not been reviewed by a lawyer.** It should be checked before a partner signs it.

You do **not** need us to change it. An administrator can rewrite every word from the admin panel. Two things to know about how that works:

- Editing publishes a **new version**. Anyone who already signed keeps the version they signed — their agreement is never rewritten underneath them — and is asked to accept the new one.
- The text is stored exactly as signed, so a signed contract can always be produced as it stood on the day.

---

# 🔒 Security issue found and fixed (not on your list)

**Anyone could approve or reject any registration.** The approval endpoint checked that the caller was an administrator *only if the request included an admin id* — leaving that field out skipped the check entirely. Approval is now verified from the signed-in session, and the approver's identity is recorded from that session rather than from the request.

---

# Before this goes live

The database migrations (`phase22`, `phase23`) have already been run. **The remaining step is to deploy the code.**

Until that happens the WCA GLOBAL account is unusable, as noted at the top of this report, and the Consultancies box will still read 0.

# Technical status

- `npm run build` passes.
- The two new screens are lint-clean; the few pre-existing errors elsewhere were verified as already present before this work.
- All new text is translated into all nine supported languages (English, Spanish, Arabic, German, French, Hindi, Portuguese, Russian, Chinese) — 77 of 77 keys verified present in every language.
- Contract PDF generation was tested directly, including against the character set that broke invoice PDFs yesterday.
- Committed, **not deployed**.

---

# Still outstanding from 19–20 July

- **WCA GLOBAL's US$75 commission on the Sparck sale has still not been credited.** It needs one database lookup to complete; we have asked for it several times and have not yet had it back.
- Sparck's invoice and receipt are still **held back from the client** pending your review, as agreed.
- The pricing-model question (one US$999 fee covering 3 years, versus your invoice's "1 Year Initial" plus US$150/year) is still unanswered and affects what Sparck is billed next year.
