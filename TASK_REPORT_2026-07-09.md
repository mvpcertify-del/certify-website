# Task Report — 9 July 2026

**Project:** Certify.cx™ (landing + web app)
**Focus:** Email delivery fix (verification emails) + logged-in profile icon in the header
**Build:** ✅ Lint clean. *(Full production build not re-run after the final header change.)*
**Deploy status:** ⚠️ Not deployed. The email fix needs **one environment-variable change in Vercel**
(see "Action required" below) — that part needs no code deploy.

This report continues from [TASK_REPORT_2026-07-08.md](TASK_REPORT_2026-07-08.md), where the
verification-email problem was still open.

---

## Summary Table

| # | Item | Status |
|---|------|--------|
| 1 | Verification email not being delivered — find the real cause | ✅ **Solved** — cause found & proven |
| 2 | Email sending — restore working delivery | ✅ **Working** (test email accepted by Resend) |
| 3 | Apply the fix to the live site | 🔴 **Action required from admin** — update 1 variable in Vercel |
| 4 | Show a profile icon in the header once a user is logged in | ✅ Done (code complete, not deployed) |

---

## 1. Verification email — the real cause (solved)

### What we thought yesterday (this was wrong)
Yesterday's report concluded the sender domain `mail.certify.cx` was **not verified** in Resend,
because every send attempt returned:

> `403 — The mail.certify.cx domain is not verified.`

That error message was **misleading**, and it sent us down the wrong path.

### What we actually found today

We checked the domain from two independent public DNS servers (Google `8.8.8.8` and
Cloudflare `1.1.1.1`), and confirmed it against the Resend dashboard. **The domain is fine:**

| Record | Purpose | Status |
|--------|---------|--------|
| DKIM (`resend._domainkey.mail`) | Proves the email is genuinely from us | ✅ Verified |
| SPF (`send.mail`) | Authorises Resend to send on our behalf | ✅ Verified |
| MX (`send.mail`) | Handles bounces | ✅ Verified |

So the domain was **never** the problem.

### The actual cause

> **The API key stored in the website's settings belonged to a *different* Resend account.**

The key in `.env` / Vercel started with `re_EToUS1Si_…`. That key **does not exist** in the
`mvpcertify` Resend account that actually owns the verified `mail.certify.cx` domain.

The key was valid — it authenticated successfully — but it authenticated into a *different*
account, where `mail.certify.cx` naturally isn't verified. Resend then reported the confusing
"domain is not verified" message instead of "wrong account".

**Analogy:** the door was unlocked all along (domain verified). We were simply holding the key
to a different house (wrong API key).

### Side note (not a fault)
`mail.certify.cx` shows *"This site can't be reached"* in a browser. That is **expected and
correct** — it is a mail-only subdomain, not a website. It was never meant to open in a browser.

---

## 2. Email sending — now working

**Actions taken:**
1. Created a **new API key** in the correct `mvpcertify` Resend account
   (name: `certify-production`, permission: **Full access**).
2. Sent a **live test email** to `heysamiul09@gmail.com` with that key.

**Result:**

| Attempt | Key used | Outcome |
|---------|----------|---------|
| Before | old key (`re_EToUS1Si…`) | ❌ `403 — domain is not verified` |
| After | new `certify-production` key | ✅ **`200 OK`** — accepted, message id `70d33544-da09-…` |

Resend **accepted and dispatched** the message. *(Recipient to confirm it landed in the inbox —
if not visible, check the Spam / Junk folder.)*

3. Updated the **local** `.env` file to use the new key, so local development also sends correctly.

**Conclusion:** email sending is fixed. No code change was needed — this was purely a credential
(API key) problem.

---

## 3. ⛔ Action required — apply the fix to the live site

The local file is updated, but **the live website reads its key from Vercel**, not from the local
file. Until this is changed, real users will still not receive verification emails.

**Steps (admin, ~2 minutes — no code deploy needed for the variable itself):**

1. **Vercel** → the `certify-website` project → **Settings** → **Environment Variables**
2. Find **`RESEND_API_KEY`** → **Edit**
3. Replace the old value with the **new `certify-production` key**
   *(the key value was shared directly with the admin — it is deliberately **not** written into
   this report, since API keys must never be stored in project files)*
4. **Save**
5. **Deployments** → newest deployment → **···** → **Redeploy**

Within ~1–2 minutes of the redeploy, new users will begin receiving verification emails.

### Optional (not required, safe to skip)
Two Resend records remain incomplete. **Neither blocks sending:**
- **Enable Receiving** (`MX` on `mail`) — only needed if we ever want to *receive* mail at this
  subdomain. Currently "Not Started".
- **Enable Tracking** (`CNAME` on `support.mail`) — only for open/click tracking. Currently "Pending".
- A **DMARC** record exists on `certify.cx` but not on `mail.certify.cx`. Adding
  `_dmarc.mail` → `v=DMARC1; p=none;` would slightly improve deliverability reputation.

---

## 4. Profile icon in the header after login ✅ *(code complete)*

**Requested:** Once a user has confirmed their email and is signed in, the website header should
no longer show **Log In** and **Sign Up** — it should show a **profile icon** instead.

**Done:**
- When a visitor is **signed in**, the header's *Log In* and *Sign Up* buttons are replaced by a
  **circular profile avatar** showing the first letter of their name.
- Clicking the avatar opens a menu with:
  - their **name and email**,
  - **Dashboard** — goes to the correct dashboard for their role (client, auditor, admin, etc.),
  - **Profile**,
  - **Sign Out** (in red) — signs out and returns to the landing page.
- The **mobile menu** behaves the same way (avatar + name, then Dashboard / Profile / Sign Out).
- **Start Your Free Gap Analysis** stays visible for everyone, signed in or not.

**Details:**
- Reuses the **same avatar design** already used in the dashboard top bar, so the look is consistent.
- Clicking anywhere outside closes the menu.
- No "Log In / Sign Up" flicker while the session is still loading.
- **No new translations needed** — it reuses existing labels, so it already works in English,
  Spanish and Arabic (including right-to-left).

**Verification:** lint passes. The production build was not re-run after this last change.

---

## Current State

- ✅ **Email root cause** — identified and proven (wrong Resend account's API key, *not* the domain).
- ✅ **Email sending** — confirmed working with the new key (live test returned `200 OK`).
- 🔴 **Live site email** — still broken until `RESEND_API_KEY` is updated in **Vercel** and redeployed.
- ✅ **Profile icon after login** — complete in code, not yet deployed.

**Next actions:**
- **Admin:** update `RESEND_API_KEY` in Vercel → Redeploy. *(This alone fixes live email.)*
- **Recipient:** confirm the test email arrived at `heysamiul09@gmail.com` (check Spam too).
- **Security:** the new API key was shared over chat during troubleshooting. Once everything is
  confirmed working, it is good practice to delete that key in Resend and generate a fresh one.
- **Deploy:** the profile-icon change (and the still-pending items from 7–8 July) go live on the
  next deploy.

*Note: nothing has been committed or pushed anywhere — all code changes remain local and
lint-verified, pending the go-ahead.*
