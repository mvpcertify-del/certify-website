# Task Report — 25 July 2026

Two batches today: the morning items (referral invite email, "Payment Received", the three UI/permission changes) and the afternoon items (remove email verification, city/country autocomplete, auto phone code). Each was investigated against the live code before implementing; the three afternoon items were mapped by parallel reviews first.

**Summary: 9 items delivered. A few need a database migration and one Supabase setting before they work — listed at the end. Three security items from yesterday are still open and need your decision.**

---

# ✅ AFTERNOON BATCH (your three latest tasks)

## 1 — Email verification removed for everyone *(your 1st task)*

Nobody is asked to verify their email any more — not new users, not existing ones.

- **New users** are now created already-confirmed and are **signed in immediately** after registering; they land straight on their dashboard. No "check your inbox" screen, no verification link.
- The old verify-email screens, the "resend verification" buttons, and the verification email itself are all gone.
- The **welcome email** still goes out (it used to ride on the verification step; it now sends directly on account creation instead), so a new user is still welcomed.
- The **admin-approval** flow for pay-first clients is untouched — that is a separate control and you asked only for email verification to go.

**Two things you must do for existing users to be fully unblocked:**
1. In Supabase → Authentication → Providers → Email, turn **"Confirm email" OFF**. This is the master switch; with it off, any older unverified account can log in immediately.
2. A one-time backfill can mark all existing accounts confirmed for tidiness — but it must be run with the welcome-email trigger temporarily disabled, or every existing user gets a welcome email at once. We will run this carefully when you say go.

## 2 — City/Country autocomplete on registration *(your 3rd task)*

When registering, a person now types their **city**, sees suggestions as **"City, Country"**, and selecting one fills **both** the city and the country automatically — saved to their profile.

The lookup was also made reliable in two ways: it reads the city and country as separate structured fields (instead of guessing by splitting the text), and it now always asks for English place names — which matters for the Arabic version of the site, where the country name would otherwise not be recognised and the region/phone code would silently fail to fill.

This is live on the **partner / stakeholder registration** (auditor, certification body, consultancy, referral, investor) and on the **profile page**, so it is "reflected in the profile" as you asked.

## 3 — Phone number auto-fills the country code *(your 4th task)*

The contact-number field sits under City/Country and now **catches the country's dialling code automatically** from the city/country the person selected. They type only their local number — the code (e.g. +971) is already shown and saved. If the derived code is ever wrong, they can still change it manually.

This required a new country → dialling-code table covering the world, which was tested against the common cases before shipping.

---

# ✅ MORNING BATCH (delivered earlier today)

## 4 — Referral partners can email their clients directly
A partner can send a ready-made invitation email to any client they added — registration link with discount pre-applied, their discount code, an optional company-profile link, and their own signature. Sent through **mail.certify.cx** with the reply going to the partner. Safeguards: only approved partners, only their own clients, 20/day and at most 3 per client. An independent security review found and fixed a serious issue (the signature was being saved in a way that could have let a partner change their own account role — now routed through the server).

## 5 — "Payment Received" status
The application **Application Status** dropdown now has **Payment Received** right after **Awaiting Payment**, shown as a green badge and in the client's progress tracker. Separate from the Payment Status field (which records card/cash/bank).

## 6 — "Companies" page renamed to "Clients"
Menu, page title and count line now say **Clients**. Data unchanged.

## 7 — "Add Referral" is now "Add Client", with WhatsApp + Website fields
The referral partner's Add form is now **Add Client** and captures the client's **WhatsApp number** and **company website** (both optional).

## 8 — Four action icons on User Management
A Country Admin now has the full **View / Edit / Deactivate / Delete** icons on the Users page — but only for the users **in their own country**, and never another admin or themselves. Enforced on the server, not just hidden in the screen.

## 9 — Password show/hide on Settings
Both password fields on the Settings page now have an eye icon to reveal/hide.

---

# ⚠️ BEFORE THESE WORK — migrations + one setting

Order matters: **run the migrations first, then deploy.** Verified that if code goes live first, the affected features fail cleanly rather than corrupting data.

1. **Database migrations** — `phase26`, `phase27`, `phase28` (referral hardening, the invite signature + send-log, and the WhatsApp/Website fields). Without `phase28`, "Add Client" will fail.
2. **Supabase "Confirm email" → OFF** (for the email-verification removal to fully cover existing users).
3. **mail.certify.cx** DNS/SPF/DKIM verification in Resend (for the partner invite emails not to land in spam) — needs the domain owner.
4. **Company profile PDF/video link** for the invite email — send whenever ready, no code change needed.

---

# ❓ STILL NEEDS YOUR DECISION — security items from yesterday

Flagged 24 July, untouched as instructed. Two became more exploitable once yesterday's referral migrations went live:

1. Anyone can self-register as a referral partner and create **fake commission entries** in your payout queue. ~1 hour.
2. An older payment route **awards commission before any money is taken**, triggerable without signing in. ~1 hour.
3. **Every signed-in user can read every discount coupon.** ~15 minutes.
4. The database rule for who can edit a profile lives only in the live DB — please run and send us:
   ```sql
   SELECT policyname, cmd, qual, with_check FROM pg_policies WHERE tablename = 'profiles' AND cmd = 'UPDATE';
   ```
   If it's the plain "edit your own row" rule with no column limit, a user could set their own role to Super Admin.

**Recommendation: let us close all four now — about half a day.**

---

# Technical status

- `npm run build` passes; API still within the 12-function hosting limit.
- All changed files lint-clean (two pre-existing warnings elsewhere were confirmed present before this work).
- The permission rule, the dial-code lookup, and the invite safeguards were each unit-tested against their edge cases (wrong region, admin targets, self, rate limits, Gmail-dot/plus tricks, ISO-code vs country-name).
- The afternoon changes touch the login/registration flow — the auditor document-upload step and the welcome email were both specifically preserved through the verification removal.
- Committed and pushed earlier today; the migration + Supabase-setting steps above still need doing before the new items are live.

---

# Still outstanding from earlier

- **WCA GLOBAL's US$75 commission** on the Sparck sale — still not credited.
- **Sparck's invoice and receipt** — still held pending your review.
- **Pricing model** (US$999 for 3 years vs "1 Year Initial" + US$150/year) — still unanswered; also blocks the video script.
- **Self-registration vs admin approval** for paid card clients — please confirm which you want.
- **Consultancy contract** — awaiting legal review.
- **Item 10 of your 22 July list** — still blank.
