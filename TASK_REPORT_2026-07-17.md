# Task Report — 17 July 2026

Covers the **15–16 July** task list. Every item was checked against the actual code before being marked below.

**Summary: 6 of 8 done. 2 need your decision before they can be built (Q1–Q5 at the end).**

> ⚠️ **Nothing is live yet.** The screenshots you sent (the Sign Up page, the Kenya admin) show the **current live site**, which has not been updated. The fixes exist but are not deployed. If you re-check the site now, everything will still look unchanged — see *Before this goes live*.

---

# ✅ DONE

## 13 / 9 — Country Admin (Kenya) could not log in — FIXED

**This was a real bug, and it affected every user created by an admin — not only the Kenya admin.**

What was happening:
- When an admin created a user from the dashboard, the account was created but **no verification email was ever sent**. The system only sent that email when a person registered *themselves*.
- An account cannot be used until its email is confirmed — so the user was **permanently locked out**.
- The dashboard still showed them as **"Active"**, because that label reflects a different setting and has nothing to do with email confirmation. **That is why this was invisible.**

What was fixed:
- Admin-created users **now receive the verification email**, the same as self-registered users.
- If an email fails to send, the admin now sees a **warning** instead of a plain success message. (Previously a mail outage would have silently recreated this exact bug.)
- A **"Resend verification email"** button was added to every row in User Management.

**To unblock the Kenya admin immediately — no deploy needed:** go to **User Management**, find the user, click the **✉ Resend verification** icon. Everyone else created before this fix is in the same state and can be unblocked the same way.

## 1 — "General" tab hidden for normal users

Referrals, auditors, CBs, clients and consultants no longer see it. Only Super Admin / Country Admin do.

## 2 — "My Profile" fields reworked

- ✅ Company name field **removed**
- ✅ **Profile picture** upload added
- ✅ **Contact number** with country dial code (+971, +966, …) added
- ✅ **City** added
- ✅ **Country** added

**Bug also found and fixed:** a separate *"Complete your profile"* popup still demanded a **Company Name**. Affiliates and investors have no company, their registration deliberately never asks for one, and the profile page no longer has that field — so this popup would have been **impossible to close** and would have returned on every single login. It no longer appears for them.

## 3 — "View" enabled for all categories of users

The read-only **View** button is now available to **every admin**, for **all user categories**. Edit / deactivate / delete remain Super-Admin-only.

One page — **Clients / Companies** — had been missed entirely and gave non-super-admins no View button at all. Fixed.

## 4 / 10 / 11 — Sign Up is for Clients only

- The **"How would you like to join?"** picker is **completely removed**.
- **Sign Up** now goes **straight to Client registration**.
- Auditors, CBs, Consultants and Affiliates can only reach their form through their **shared `/register/...` link**. Those links still work.

## 5 / 6 / 8 — Simple Affiliate registration

The affiliate sign-up was a 3-step wizard. It is now **one short form**, exactly as requested:
**Name · Contact number (with +country code) · Email · Location** — plus a password to create the login (see **Q1**).

No company, activity, certificates or role fields.

**Bug also found and fixed:** the **City was being collected but never saved**. It would have shown blank on the affiliate's own profile and in your admin list. Now saved correctly.

---

# ❌ NOT DONE — waiting on your answers

## 7 — Electronic contract with T&C

Nothing for this exists yet: no contract text, no accept/reject step, no record of who accepted, no copy on the dashboard.

It has **not** been started on purpose, because the request contradicts a written instruction from two days earlier. Building the wrong version would mean redoing it. **See Q2 and Q3.**

## 12 — Admin sends the registration invite by email

Right now, the "Email" button on the shared-links page only opens **your own mail app** with an empty To: field — the platform itself sends nothing.

This is straightforward to build, but one decision changes the design significantly. **See Q4.**

---

# ❓ QUESTIONS — please confirm (Q&A for the client)

Please answer these five and both remaining tasks can be finished.

### Q1 — Affiliate registration: password, or emailed sign-in link?

> *"Only they will need to fill 4 fields as above mentioned."*

The 4 fields (Name, Contact number, Email, Location) are done. But an account still needs a **way to log in**, which the 4 fields don't provide. Two options:

- **(a)** Keep a password field — so the form is 5 inputs, not 4.
- **(b)** No password at all — the affiliate receives a **sign-in link by email** each time. This is a true 4-field form, and it's the same method already used at checkout.

**Which do you want?** *(Our recommendation: **(b)** — it matches "keep it simple" and they are not technical people.)*

---

### Q2 — Does the Super Admin approve affiliates, or not?

These two instructions conflict directly:

| Date | Instruction |
|---|---|
| **15 July** | *"Auditors, Affiliates, CBs, Consultants will be able to Log In once they complete their registration & are verified by email."* → **no admin approval** |
| **16 July** | *"…so that the Affiliate can review & accept or reject **before the approval of his/her registration by the SA**"* → **SA approval required** |

Both cannot be true at the same time. Options:

- **(a)** **Affiliates only** go back to needing SA approval (after they accept the contract). Auditors, CBs and Consultants stay automatic. ← *our recommendation, it satisfies both instructions*
- **(b)** Contract acceptance **is** the approval — no SA step at all.
- **(c)** Everyone goes back to needing SA approval (full revert of the 15 July instruction).

**Which one?**

---

### Q3 — "Cannot download, email, edit or delete — only view"

We can enforce this for normal use: no download button, no file to save, printing blocked, and the database itself refuses any edit or delete.

**But we cannot stop someone taking a screenshot or a photo of the screen.** No website can — this is a limitation of web browsers, not of our build.

**Please confirm you accept this**, so there is no misunderstanding later about what "cannot be copied" means.

---

### Q4 — Should the affiliate links you are testing right now keep working?

The `/register/...` links are currently **public** — anyone who has the link can register, invited or not.

To make it genuinely *"by invitation only"*, each link must be locked to the specific email it was sent to. The consequence:

> **Every link already shared would stop working**, and everyone would need a fresh invite.

- **(a)** Lock the links — true invitation-only, but **all existing links break**.
- **(b)** Keep links open — add the "admin sends the invite email" feature, but anyone with the link can still register.
- **(c)** Lock them **later**, after your affiliate testing is finished.

**Which?** *(We ask because you are testing affiliate registration through those links right now.)*

---

### Q5 — What does "View option should be enabled for all categories of users" mean?

The screenshot showed a user's **own profile page**, but the wording says *all categories of users*.

We built: **the read-only View button is available to every admin, for every user category** (auditors, CBs, clients, affiliates, country admins). Edit/delete stay Super-Admin-only.

**Please confirm this is what you meant** — if you meant something else, we will adjust.

---

# 🔒 Security issues found and fixed (not on your list)

These were **not requested**. They were found while fixing the above and were serious enough to fix immediately.

1. **The user-creation function had no security check at all.** Anyone on the internet could have created themselves a **Country Admin** account with a single request. It now requires a valid admin login.
2. **Anyone could approve their own registration** by tampering with the sign-up request. Approval is now decided by the server only.
3. **A Country Admin could create users in other countries' regions** by tampering with the request. Now locked to their own region.
4. **A Country Admin could create Affiliate accounts** (which carry commission entitlements) even though the permission rules don't allow it. Now enforced.
5. **Failed profile creation was being reported as success**, leaving accounts that exist but can never be used. It now fails properly and cleans up. This is the same type of failure that took **checkout** down previously.

---

# Before this goes live

**Order matters. Run the migrations first, then deploy.** Deploying the code first would break registration and the profile page.

1. **`supabase/phase18_profile_fields.sql`** — required for the profile picture / city / contact-number fields *(new, this batch)*.
2. **`supabase/phase17_checkout_repair_and_country.sql`** — still pending from the 14 July report *(checkout is still broken in production until this runs)*.
3. Then deploy.

# Technical status

- `npm run build` passes.
- New/changed code adds **no new lint errors** (the few that appear were verified as already present in the committed code).
- Every change was put through independent automated review passes; their findings were fixed.
- **Not yet committed or deployed** — awaiting go-ahead.
