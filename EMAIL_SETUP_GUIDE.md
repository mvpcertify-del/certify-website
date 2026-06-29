# 📧 Email Fix Guide — Reset Password & Verification Emails

**Problem (client report):**
1. "Reset password by email is not working — no email with the reset link is received."
2. "For a new registration, a popup says check the email & verify, but no email reaches the new user."

**Good news:** The code for both emails is already built and working. These are **configuration / DNS issues**, not code bugs. Follow the steps below in order. (No coding required.)

---

## Why emails are not arriving

Both emails are sent through **Resend** (our email provider). They fail silently when:

| Cause | Affects |
|------|---------|
| The sending domain is **not verified** in Resend | Verification **and** reset |
| `APP_PUBLIC_URL` is missing/wrong on the server | Verification links go to the wrong place |
| The **Supabase "Send Email Hook"** is not turned on | Password reset (Supabase never calls our sender) |
| `SUPABASE_AUTH_HOOK_SECRET` missing/incorrect | Password reset (hook rejected) |

---

## Step 1 — Verify the sending domain in Resend ✅ (fixes BOTH emails)

1. Log in to **https://resend.com** → **Domains**.
2. Add the domain you send from — e.g. `certify.cx` (or `mail.certify.cx`).
3. Resend shows **DNS records** (SPF, DKIM, and sometimes a return-path/MX). Copy them.
4. Go to your **DNS provider** (where `certify.cx` DNS is managed — cPanel / Cloudflare / domain registrar).
5. Add each record exactly as Resend shows (type, name/host, value).
6. Back in Resend, click **Verify**. Wait until the domain shows **Verified** (green). DNS can take 5–60 min.

> ⚠️ Until the domain is **Verified**, every email bounces silently. This is the #1 cause.

---

## Step 2 — Confirm the email environment variables (Vercel)

In **Vercel → Project → Settings → Environment Variables**, make sure these exist and are correct, then **Redeploy**:

| Variable | Value (example) |
|----------|-----------------|
| `RESEND_API_KEY` | `re_xxxxxxxx` (from Resend → API Keys) |
| `RESEND_FROM_EMAIL` | `Certify.cx <noreply@certify.cx>` — the address **must** be on the verified domain from Step 1 |
| `APP_PUBLIC_URL` | `https://certify.cx` (the live site URL, no trailing slash) |

> After changing any variable in Vercel you **must redeploy** for it to take effect.

---

## Step 3 — Turn on the Supabase "Send Email Hook" 🔑 (fixes password reset)

Password reset goes through Supabase, which must be told to call our sender.

1. Open **Supabase Dashboard → Authentication → Hooks** (or **Emails → Hooks**).
2. Find **Send Email Hook** → **Enable**.
3. Set the **URL** to:
   ```
   https://certify.cx/api/auth-email-hook
   ```
   (use your real live domain)
4. Supabase generates a **signing secret** that looks like `v1,whsec_xxxxxxxx`. **Copy it.**
5. In **Vercel → Environment Variables**, add / update:
   | Variable | Value |
   |----------|-------|
   | `SUPABASE_AUTH_HOOK_SECRET` | `v1,whsec_xxxxxxxx` (the secret from step 4) |
6. **Redeploy** the Vercel project.

---

## Step 4 — (Optional but recommended) Set Supabase Site URL & Redirects

In **Supabase → Authentication → URL Configuration**:
- **Site URL**: `https://certify.cx`
- **Redirect URLs**: add `https://certify.cx/reset-password` and `https://certify.cx/login`

This makes sure the links inside the emails open the correct pages.

---

## Step 5 — Test

1. **Verification email:** Register a brand-new test account (use an email **you control** — not the developer's). The verification email should arrive within ~1 minute.
2. **Reset email:** Go to **Forgot Password**, enter that email. The reset link email should arrive.
3. If nothing arrives, open **Resend → Emails** (the activity log) — it shows every attempt and whether it was delivered, bounced, or rejected. That tells you exactly what's wrong.

---

## Quick troubleshooting

| Symptom | Most likely fix |
|---------|-----------------|
| No email at all, Resend log shows nothing | `RESEND_API_KEY` wrong, or Supabase hook not enabled (reset) |
| Resend log shows "bounced" / "domain not verified" | Finish Step 1 (domain verification) |
| Email arrives but link is broken / wrong site | Fix `APP_PUBLIC_URL` (Step 2) + Supabase Site URL (Step 4) |
| Verification works but reset doesn't | Supabase Send Email Hook + `SUPABASE_AUTH_HOOK_SECRET` (Step 3) |

---

**Note:** Do not send test emails to the developer's personal inbox. Always test with an email address you own and can check.
