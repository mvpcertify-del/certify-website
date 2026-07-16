# Task Report — 15 July 2026

Second batch of client changes, focused on **registration and profiles**. The client is actively testing the **affiliate/referral registration link**, so that was done first.

> ⚠️ One database migration must be run for the profile changes to work:
> **`supabase/phase18_profile_fields.sql`** (adds the picture / city / contact-number fields + the avatars storage bucket). This is **in addition** to the still-pending `phase17` migration from the 14 July report.

---

## 1 — "General" tab hidden for normal users ✅

The **General** tab in *My Profile* (Platform Name / Email Notifications / Two-Factor) showed platform-wide settings to **every** user, which was confusing.
- It is now **admin-only**. Referrals, auditors, CBs, clients and consultants no longer see it; only Super Admin / Country Admin do.

## 2 — "My Profile" fields reworked ✅

On every user's *My Profile* page:
- ✅ **Company name field removed.**
- ✅ **Profile picture** — users can now upload a photo (stored in a new public `avatars` bucket; shown as their avatar).
- ✅ **Contact number** with a **country dial-code** selector (+971, +966, …) added.
- ✅ **City** field (where the person lives) added.
- ✅ **Country** field (where the person lives) added.
- These save to the profile and reload so the new picture/details show immediately.

*Needs the `phase18` migration to be run first (adds `city`, `avatar_url` columns + the avatars bucket; `phone`/`country` are also ensured in case `phase17` hasn't run yet).*

## 3 — "View" enabled for all categories of users ✅

The read-only **View** button in the admin user lists (auditors, certification bodies, country admins, etc.) was only shown to the **Super Admin**.
- It is now available to **every admin** who can open the list, for **all user categories**. Destructive actions (edit / deactivate / delete) stay Super-Admin-only.
- *If you actually meant something else by "View", tell me and I'll adjust — this was the most likely reading.*

## 4 — Public Sign-Up is for Clients only ✅

The "**How would you like to join?**" account-type picker has been **removed** from `/signup`.
- Anyone who clicks **Sign Up** now goes **straight to the Client registration**.
- Auditors, CBs, Consultants and Referrals/Affiliates are **invite-only** — they register through their **shared `/register/:type` link**, exactly as the client asked. Those links still work.

## 5 & 7 — Simple Affiliate/Referral registration ✅ (the urgent one)

The referral/affiliate sign-up used to be a **3-step wizard**. It is now **one short form** with only what the client listed:
- **Name**, **Contact number (with +country code)**, **Email**, **Location** (the existing city/country search — "existing is good"), plus a **password** to create the login.
- No company, activity, certificates or role fields — the shortest possible registration for non-technical affiliates.
- (Investors use the same simple form.)

## 6 — Stakeholders log in after email verification ✅

Auditors, Affiliates, CBs and Consultants used to be **blocked until an admin approved** them.
- Now, once they **finish registering and confirm their email**, they can **log in** — no separate admin-approval step.
- Email verification is still required (the account can't log in until the confirmation link is clicked), so this is the single, automatic gate the client described.
- **Note:** anyone who *already* registered before this change and is still marked "pending" would need a one-time approve/flip; all **new** registrations from now on are automatic.

---

## To run before this goes live

1. **`phase18_profile_fields.sql`** — required for the profile picture / city / contact-number fields (Task 2).
2. **`phase17_...sql`** — still pending from the 14 July report (checkout + country field).

## Technical status

- `npm run build` passes.
- New/changed code is lint-clean (two pre-existing advisory warnings in `AuthContext.jsx` were left untouched — they exist in the current committed code, not from this batch).
- **Not yet deployed** — awaiting go-ahead.
