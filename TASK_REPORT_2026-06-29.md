# CertifyCX — Task Report

**Date:** 29 June 2026
**Prepared for:** Client (Midhat Sir)
**Git commit:** `db73031` — pushed to `main` (`github.com/mvpcertify-del/certify-website`)
**Build status:** ✅ Passed (`npm run build` — built in 36.5s)

---

## 1. Summary

The client sent a batch of **9 tasks**. All work that can be done in code is **complete, verified against the codebase, and pushed to GitHub**.

| Category | Count | Status |
|---|---|---|
| Built in code (verified) | 7 | ✅ Done |
| Needs configuration / external account (not code) | 2 | ⏳ Pending client/admin action |

> **Important:** Tasks 1 & 5 (emails) and the WhatsApp part of Task 3 are **not coding problems** — they need account setup and configuration (Resend domain, Vercel env vars, Supabase hook, WhatsApp provider). The code side is ready and waiting.

---

## 2. Tasks Completed in Code (Verified)

### ✅ Task 4 — Sidebar expand/collapse arrow
**Client:** Collapsed left sidebar had no arrow/cursor to expand it back.
**Done:** An always-visible toggle button. Shows **►** when collapsed (to expand) and **◄** when open (to collapse). The collapsed/expanded choice is remembered across pages and reloads.
**Files:** `src/components/layout/Sidebar.jsx`, `DashboardLayout.jsx`, `Sidebar.css`

### ✅ Task 6 — 3-tier pricing per Certification Body, per certificate
**Client:** Each CB must have a per-certificate cost in **US$**: Initial / Surveillance 1 / Surveillance 2, entered manually, **mandatory** at CB creation. (e.g. ICL ISO 9001 = $100 / $50 / $50.)
**Done:** Three price fields per ISO standard, labelled **Initial / Surveillance 1 / Surveillance 2**. Saving a CB is **blocked until all three prices are filled** for every selected standard.
**File:** `src/pages/bodies/CertificationBodies.jsx`

### ✅ Task 7 — 4 action icons on every CB row
**Client:** Each CB row should have the same 4 icons as other sections: View, Deactivate, Edit, Delete.
**Done:** Every CB row now shows **View, Deactivate/Activate, Edit, Delete**. View opens a read-only detail popup; Deactivate/Activate flips the CB's status.
**File:** `src/pages/bodies/CertificationBodies.jsx`

### ✅ Task 8 — "Pressing a tab logs out / loses data" fix
**Client:** When adding/editing a CB and switching browser tabs, it logged out and the data was not saved.
**Done:** Fixed the root cause — switching tabs triggered a session refresh that reset the whole app and wiped open forms. The app now refreshes the session **in the background** without unmounting; **open forms (like the CB add/edit modal) are no longer lost.**
**File:** `src/contexts/AuthContext.jsx`

### ✅ Task 9 — Post-signup "next steps" guidance
**Client:** After creating an account and finishing the test, it went straight to the dashboard; it should direct the user to contact someone / next steps.
**Done:** After signup, the email-verification screen now shows a clear **"Next steps"** guide (3 steps + a support contact line) on both signup flows.
**File:** `src/pages/auth/SignUp.jsx`

### ✅ Task 2 — Privacy Policy (and Terms of Service)
**Client:** Add a Privacy Policy to certify.cx.
**Done:** Standalone public **Privacy Policy** and **Terms of Service** pages (full content, 10 sections each), reachable at `/privacy` and `/terms`, and linked from a new **Legal** column in the landing-page footer.
**Files:** `src/pages/legal/PrivacyPolicy.jsx`, `TermsOfService.jsx`, `Legal.css`, `App.jsx`, `LandingPage.jsx`

### ✅ Task 3 — Notification automation (in-app + email + WhatsApp scaffold)
**Client:** Super Admin — notifications (Email & WhatsApp) activated for every new & existing user, automated on events (reset, new lead, deleting, inactive, etc.).
**Done (code side):**
- Admins are alerted when a **user is deleted**.
- When a user is **deactivated / reactivated**, both the affected user and the admins are notified (in-app + WhatsApp if a phone is on file).
- New-lead / registration alerts already existed and are retained.
- A **per-user notification switch** (`notifications_enabled`, default ON for everyone).
- The user's **phone number is now saved** at signup (needed for WhatsApp).
- A **WhatsApp helper** that is provider-agnostic and **safely does nothing** until WhatsApp credentials are configured — so production is never broken by it.

**Files:** `api/_notifyWhatsApp.js` (new), `api/_notifyAdmins.js`, `api/notify-event.js`, `api/delete-user.js`, `api/user.js`, `api/create-user.js`, `supabase/phase15_notifications.sql` (new)

---

## 3. Tasks That Need Configuration (Not Code)

### ⏳ Task 1 — Reset-password email not arriving
### ⏳ Task 5 — Registration verification email not arriving
**These are not bugs in the code — they need email service setup.** The platform sends all auth emails through Resend, which requires:
1. Verifying the sending domain in Resend.
2. Setting the email environment variables in Vercel (`RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `APP_PUBLIC_URL`).
3. Enabling the Supabase **Send Email Hook** (URL + signing secret).
4. Setting the Supabase Site/Redirect URLs.

**Full step-by-step is in `EMAIL_SETUP_GUIDE.md`.** Until this is done, reset and verification emails will not be delivered.

---

## 4. Action Items — Required Before It Works Live

| # | Action | Who | Why |
|---|---|---|---|
| 1 | Run `supabase/phase15_notifications.sql` in Supabase (SQL Editor) | Admin | Adds `phone` + `notifications_enabled` columns. Without it, Task 3's phone/WhatsApp/toggle won't work in production. |
| 2 | Complete email setup per `EMAIL_SETUP_GUIDE.md` | Admin / Client | Makes Tasks 1 & 5 (reset + verification emails) actually deliver. |
| 3 | Provide a WhatsApp Business provider account (Meta Cloud API / Twilio) and set `WHATSAPP_API_URL`, `WHATSAPP_API_TOKEN`, `WHATSAPP_FROM` in Vercel | Client | Turns on the WhatsApp side of notifications. Paid 3rd-party service. Until then, WhatsApp stays a safe no-op. |
| 4 | Live-test all features on the deployed site after deploy | Team | Code is verified, but on-site testing is still pending. |

---

## 5. Security Note (Pre-existing)

`.env.example` contains a **real Resend API key** (line 20) committed to the repository. Recommended: **revoke that key in the Resend dashboard, issue a new one, and replace it with a placeholder** in `.env.example`. This predates this task batch but should be addressed.

---

## 6. Final Status

- **Coding tasks (4, 6, 7, 8, 9, 2, 3): 100% complete and verified in code.**
- **Email delivery (1, 5) + WhatsApp sending: pending configuration / accounts — not code.**
- **All work committed and pushed to GitHub (`db73031`).**
- **Live testing on the deployed site: pending.**
