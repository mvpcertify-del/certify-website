# Task Report — 17 July 2026

Covers the client's **15–16 July** batch. Each item below was checked against the actual code, not from memory.

> ⚠️ **Two migrations must be run in Supabase before this is deployed** — see *To run before this goes live*.

---

## 13 / 9 — Country Admin (Kenya) could not log in ✅ FIXED

**This was a real bug, and it affected every user an admin created — not just the Kenya admin.**

What was happening:
- When an admin creates a user from the dashboard, the account was created but **no verification email was ever sent**. The code only sent that email when a person signed up *themselves*.
- The account is unusable until the email is confirmed, so the user was **permanently locked out**.
- The dashboard still showed them as **"Active"**, because that badge reflects a different field entirely and has nothing to do with email confirmation. That is why the problem was invisible.

What was fixed:
- Admin-created users **now receive the verification email**, exactly like self-registered users.
- If the email fails to send, the admin now sees a **warning** instead of a plain success message. (Previously a mail outage would have silently recreated this same bug.)
- A **"Resend verification email"** button was added to every row in User Management.

**To unblock the Kenya admin right now — no deploy needed:** open **User Management**, find the user, click the **✉ Resend verification** icon. The same applies to anyone else created before this fix; they are all still locked out until they get a link.

## 1 — "General" tab hidden for normal users ✅

Already correct in the code. Referrals, auditors, CBs, clients and consultants no longer see it — only Super Admin / Country Admin do. **Not visible live yet** (not deployed).

## 2 — "My Profile" fields ✅ + one popup bug fixed

Company removed; profile picture, contact number with country dial code, City and Country all added.

**Bug found and fixed:** a separate "Complete your profile" popup still demanded a **Company Name**. Affiliates and investors have no company, their registration deliberately never asks for one, and the profile page no longer has that field — so the popup would have been **impossible to clear** and would have returned on every login. It no longer appears for them.

*Requires the `phase18` migration.*

## 3 — "View" enabled for all categories of users ✅

Available to **every admin**, for **all user categories**. Destructive actions (edit / deactivate / delete) remain Super-Admin-only.

One page — **Clients / Companies** — had been missed and gave non-super-admins no View button at all. Fixed.

## 4 / 10 / 11 — Sign Up is for Clients only ✅

The "How would you like to join?" picker is **fully removed**. `/signup` goes straight to Client registration. Auditors, CBs, Consultants and Affiliates reach their form only through their shared `/register/...` link.

**The page in your screenshot is the live site, which has not been updated yet.** The code is correct; it needs a deploy. This will keep looking "not done" until then.

## 5 / 6 / 8 — Simple Affiliate registration ✅ + one bug fixed

One short form: **Name, Contact number (+country code), Email, Location**, plus a password to create the login.

**Bug found and fixed:** the **City was collected but never saved** to the profile — it would have shown blank on the affiliate's profile and in the admin list. Now saved.

**Open question for the client:** the request says *only 4 fields*, but a password is currently needed to create the login. Options: (a) keep the password, or (b) drop it and email the affiliate a sign-in link instead (the same passwordless approach already used at checkout). **Please confirm which you want.**

## 7 — Electronic contract with T&C ❌ NOT BUILT — needs a decision first

Nothing for this exists yet: no contract text, no accept/reject step, no record of acceptance, no dashboard copy.

**There is a direct contradiction that must be resolved before this can be built:**
- **15 July instruction:** stakeholders log in as soon as they verify their email — *no admin approval*.
- **This request:** the affiliate accepts the contract *"before the approval of his/her registration by the SA"* — which requires exactly the approval step that was removed.

Both cannot be true. **Recommendation:** affiliates alone go back to requiring SA approval (after contract acceptance); all other stakeholders stay auto-approved. This is the narrowest reading of both instructions — **but it reverses a written instruction from two days earlier, so please confirm with the client.**

Also worth stating plainly: *"cannot download, email, edit or delete — only view"* can be enforced against ordinary use (no download button, no file, no print, database-level deny on edit/delete), but **not against a determined user with a screenshot**. No web page can guarantee that.

## 12 — Admin invite by email ❌ NOT BUILT — needs a decision first

Today the "Email" button on the shared-links page just opens **your own mail app** with a blank To: field. The platform does not send anything.

Building it is straightforward. **But one question first:** the `/register/...` links are currently **public** — anyone holding one can register. Making it genuinely "invitation only" means locking each link to an invited email, which would **break every link already shared**. Since affiliates are being tested with those links right now, please confirm before this changes.

---

## Security issues found and fixed (not requested — found during the review)

These were not on the client's list, but were found while fixing the above and are worth knowing about:

1. **The user-creation endpoint had no authentication at all.** Anyone on the internet could have created themselves a **Country Admin** account with a single request. It now requires a valid admin login.
2. **Anyone could self-approve their own registration** by tampering with the sign-up request. Approval is now decided by the server only.
3. **A Country Admin could create users in other countries' regions** by tampering with the request. Now clamped to their own region.
4. **A Country Admin could create Affiliate accounts** (which carry commission entitlements) despite the permission matrix not allowing it. Now enforced server-side.
5. **Failed profile creation was being silently reported as success**, leaving accounts that exist but can never be used. It now fails loudly and cleans up. This is the same class of failure that took checkout down previously.

---

## To run before this goes live

1. **`supabase/phase18_profile_fields.sql`** — required for the profile picture / city / contact-number fields.
2. **`supabase/phase17_...sql`** — still pending from the 14 July report (checkout + country field).

**Order matters: run the migrations first, then deploy.** Deploying the code first would break registration and the profile page.

## Technical status

- `npm run build` passes.
- New/changed code adds **no new lint errors** (the handful that appear are already in the committed code and were verified as pre-existing).
- Every change above was reviewed by independent automated review passes, and their findings were fixed.
- **Not yet committed or deployed** — awaiting go-ahead.
