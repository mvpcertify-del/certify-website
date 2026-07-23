# Task Report — 23 July 2026

Covers the three faults you reported today. All three were the same fault, and it was ours.

**Summary: cause identified, fixed and verified. Awaiting deployment.**

> ⚠️ **The fix is not live yet.** It is complete and tested locally. Deploying it takes a few minutes and restores everything described below. Until then, please do not attempt to change a user's role or create a new registration — they will keep failing.

---

# What you reported

| # | What you saw | Where |
|---|---|---|
| 1 | *"I am trying to change my Role to do testing but the system is showing ERROR"* — `A server error has occurred FUNCTION_INVOCATION_FAILED` | Users → Edit User Role |
| 2 | *"I also tried to sign up as a new user, but failed"* — `Signup failed` | Public sign-up page |
| 3 | *"a issue that fails for a new registration, which I am trying to create"* | Users → new registration |

---

# What actually happened

**All three were one fault, and it was introduced by yesterday's work.**

Yesterday's auditor changes added a new shared file listing the ISO standards, auditor levels and the 39 IAF sector codes. Two server functions — the one that changes a user's role, and the one that creates any new account — now read their valid values from that shared file, so the browser form and the server can never disagree about what is allowed.

That file referred to two other files by name but left off the file extension.

The website builder tolerates that and fills in the extension automatically. **The server does not.** When either function started up, it could not find the files it was asking for, so the function refused to load at all — which is exactly what `FUNCTION_INVOCATION_FAILED` means.

Because it fails at start-up rather than while running, **every** request to those two functions failed, regardless of what you were trying to do. That is why changing a role and creating an account broke at the same moment, with two different-looking errors.

**Why it was not caught:** the build succeeded, the code checker reported no problems, and the site loaded normally. Nothing failed until a live request actually reached the server. It is a genuine blind spot in our checks, not something that was overlooked.

---

# The fix

The two file references now carry their extensions.

Every server function has then been started under the same engine the live site uses, and each one loads cleanly:

| Server function | Result |
|---|---|
| User management (roles, profiles, auditors) | ✅ Loads |
| Account creation (admin-created and self sign-up) | ✅ Loads |
| Checkout and payments | ✅ Loads |

The whole chain of shared files those functions depend on was re-checked, and this was the only place the problem occurred.

A note has been written into the file explaining why the extensions must stay, so that the same mistake is not reintroduced by a later change.

---

# What this restores

- **Edit User Role** works again — including changing your own role to test the platform as a Client, Auditor, Referral or Certification Body.
- **Public sign-up** works again.
- **Admin-created registrations** work again.

---

# ⚠️ Two things to be aware of

## 1. This was live for roughly a day

Yesterday's release went out and this fault went with it. Anyone who tried to register during that window would have seen "Signup failed". If you know of anyone who tried, they should be asked to try again once this is deployed — nothing was saved, so there are no half-created accounts to clean up.

## 2. The auditor database step is still outstanding

From yesterday's report, and still not done: **the `phase24` database migration has not been run.**

The new auditor fields — standards, levels, IAF sectors, certificate uploads — are live in the interface but the database has nowhere to store them. Adding an auditor with those fields will fail until the migration runs.

It also creates the storage area for auditor certificates, which has never existed. Auditor document uploads have been failing silently since that screen was first built.

**Please confirm whether we should run it, or whether you will run it.**

---

# Recommendation

We would like to add one automated check that starts every server function before a release goes out and blocks the release if any of them fails to load. It takes minutes to build and would have caught this fault before it reached you.

This is outside today's task list, so **we will not add it without your go-ahead.**

---

# Technical status

- `npm run build` passes.
- The changed file and both affected server functions are lint-clean.
- All three server functions verified to load under the production engine.
- Fix is committed to the working copy, **not yet deployed.**

---

# Still outstanding

- **`phase24` migration** — blocking the auditor fields. *(from 22 July)*
- **WCA GLOBAL's US$75 commission** on the Sparck sale still not credited. *(from 19 July)*
- **Sparck's invoice and receipt** still held back from the client pending your review.
- **Pricing model** — one US$999 fee covering 3 years, versus "1 Year Initial" plus US$150/year — still unanswered.
- **Consultancy contract** still awaiting legal review before any partner signs.
- **3-month inactivity rule** — flag only, or automatic deactivation? Still unconfirmed.
- **Item 10** on your 22 July list was left blank. Please tell us what it was.
- **In-app logo colour** — currently forced to black/white while the favicon, invoices and emails are teal. We recommend making it teal to match, but have not changed it without your approval.
- **Further security issues** found and reported on 22 July remain untouched, as instructed. Please say when you want them addressed.
