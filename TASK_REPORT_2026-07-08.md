# Task Report — 7–8 July 2026

**Project:** Certify.cx™ (landing + web app)
**Source:** Client "Certify.cx Remarks 7.7.26" document + boss's WhatsApp messages
**Build:** ✅ Passing (`vite build` clean, lint clean)
**Deploy status:** ⚠️ Code complete **locally, not yet committed/deployed.** Changes go
live only on the next deploy. Task 1 is held for client approval; Task 5 is a
Resend/DNS action outside the codebase.

This report covers the 7 July client remarks and the follow-up email investigation.

---

## Summary Table

| # | Client's Request | Status |
|---|------------------|--------|
| 1 | Sign Up → popup to pick account type (Client, Auditor, Affiliate, Consultant, Certification Body, Investor), then Gmail/email register | 🟡 Code + template ready — **awaiting client approval** |
| 2 | Add 3rd header button "Start Your Free Gap Analysis" (different colour) + reword "Simplify your ISO certification" → "Register by your Gmail or Email" | ✅ Done |
| 3 | Login error "Failed to fetch dynamically imported module" must be resolved | ✅ Done |
| 4 | ISO 22000 FSMS — food-chain codes A–K with short descriptions; check if in certify.cx | ✅ Done (were missing — now added) |
| 5 | Verification email not arriving | ✅ **Solved on 9 July** — see [TASK_REPORT_2026-07-09.md](TASK_REPORT_2026-07-09.md) *(cause was a wrong API key, not the domain)* |

---

## 1. Sign Up — account-type picker 🟡 *(code ready, awaiting approval)*

**Client asked:** The Sign Up button should first open a popup with a drop-down to
choose the type of sign-up — **Client, Auditor, Affiliate, Consultant, Certification
Body, Investor** — because it is not always registering for certification. After
choosing, guide them to complete registration via Gmail or their own email. Match the
sequence to certify.cx's already-created categories. Create a drop-down template to
review first.

**Done:**
- Built an **interactive template** (shared as a private preview link) so the client
  can view and approve the design before it goes live.
- Implemented the working feature in code (`SignUp.jsx`): clicking **Sign Up** now
  shows the 6-type picker first. Choosing **Client** continues in the simple
  Gmail/email flow; the other five open their existing registration wizard.
- Mapped each option to the category that already exists in certify.cx:
  **Affiliate → the existing "Referral" programme**, **Consultant → "Consultancy"**;
  Client, Auditor, Certification Body, Investor already exist as-is.
- Labels translated (English, Spanish, Arabic; other languages fall back to English),
  right-to-left (Arabic) handled. Build passes.

**Pending — 2 confirmations from client before deploy:**
1. Keep the label **"Affiliate"**, or rename it to **"Referral"** everywhere?
2. Is **"Consultant" = "Consultancy"** acceptable?

---

## 2. Header button + wording change ✅ *(done)*

**Client asked:** Add a third header button **"Start Your Free Gap Analysis"** next to
Log In + Sign Up, in a different colour (so 3 buttons total). Separately, replace the
Sign Up screen heading **"Simplify your ISO certification"** with **"Register by your
Gmail or Email"**.

**Done:**
- Added the **"Start Your Free Gap Analysis"** button to the header in a **blue**
  colour (distinct from the green Sign Up button), linking to the existing
  `/gap-analysis` page. Added to both the desktop nav and the mobile menu.
- Replaced the heading with **"Register with your Gmail or Email"** across **all 9
  languages** (English, Arabic, Spanish, French, German, Portuguese, Russian, Chinese,
  Hindi).

---

## 3. Login "Failed to fetch dynamically imported module" error ✅ *(done)*

**Reported:** Trying to log in / open the app produced a runtime error —
*"Failed to fetch dynamically imported module: …/LandingPage-xxxx.js"* — followed by a
"Something went wrong" screen.

**Cause:** After each new deploy, the app's file names change (content hashing). A
browser holding the **old cached page** tries to fetch old file names that no longer
exist on the server, so the page-load fails. There was no recovery handling.

**Fix (3 layers):**
- Added a global listener that, on this stale-chunk error, **hard-reloads the page
  once** to pull the fresh files — guarded so it can never loop.
- Wrapped every lazily-loaded page so a failed load triggers the same one-time reload.
- Updated the error screen's **"Try Again"** button to do a real reload on chunk errors
  (instead of re-rendering the same broken page).

Takes effect from the next deploy onward.

---

## 4. ISO 22000 FSMS food-chain categories A–K ✅ *(done — data)*

**Client asked:** Update the ISO 22000 codes with a short description for each; check
whether they are already in certify.cx.

**Check result:** These food-chain categories **did not exist anywhere in certify.cx.**

**Done:** Added all **11 categories (A–K)** with short descriptions as reference data:

> **A** Farming of Animals · **B** Farming of Plants · **C** Food Manufacturing ·
> **D** Animal Feed Production · **E** Catering · **F** Distribution ·
> **G** Transport & Storage Services · **H** Services ·
> **I** Food Packaging & Packaging Materials · **J** Equipment Manufacturing ·
> **K** Bio chemicals.

*Scope note:* the client confirmed **data-only is enough for now.** If we later want
clients to **select** their category during ISO 22000 registration, that needs a small
database column added (to be run in Supabase) plus a form field — a follow-up task.

---

## 5. Verification email not arriving ⚠️ *(superseded — see 9 July report)*

> **Correction (9 July):** the conclusion below turned out to be **wrong**. The domain
> `mail.certify.cx` **was** fully verified. The real cause was that the `RESEND_API_KEY` belonged
> to a different Resend account. This is now solved — see
> [TASK_REPORT_2026-07-09.md](TASK_REPORT_2026-07-09.md). The original text is kept below for
> the record.

**Reported:** A new user (`auditor@wca-global.com`, and others) did not receive the
verification email. The app itself shows: *"Your account is created, but we couldn't
send the verification email… Couldn't send right now."*

**Investigation (verified with a live test):**
- The email system uses **Resend** (not Zoho — the app no longer uses Zoho SMTP at all).
- The **Resend API key is valid** and able to send.
- The **Vercel environment variables are correct.**
- **Root cause:** the sender domain **`mail.certify.cx` is NOT verified in Resend.**
  A live test send to `heysamiul09@gmail.com` returned:
  *"The mail.certify.cx domain is not verified."* → Resend rejects **every** send, so no
  verification email can go out.

**Fix required (client/admin — no code change):**
1. In Resend → **Domains**, add & verify **`mail.certify.cx`** (or use an already-verified
   domain).
2. Add the **SPF / DKIM** DNS records Resend provides to the certify.cx DNS zone.
3. Once the domain shows **Verified (green)**, emails start sending immediately — no
   redeploy needed.

**Status:** Blocked on the domain verification. (Send the DNS records from Resend and
they can be set up step-by-step.)

---

## Current State

- ✅ **Tasks 2, 3, 4** — complete in code, build passing. Go live on the next deploy.
- 🟡 **Task 1** — complete in code + template shared; **held for client approval** and
  the two naming confirmations above, then included in the deploy.
- 🔴 **Task 5** — root cause identified; requires **Resend domain verification** (DNS),
  which is outside the codebase. This is independent of the deploy.

**Next actions:**
- **Client:** review the Sign Up type-picker template → approve + confirm the
  Affiliate/Referral and Consultant/Consultancy naming.
- **Admin (has Resend access):** verify `mail.certify.cx` in Resend to fix email.
- **Deploy:** once Task 1 is approved, one deploy makes Tasks 1–4 live.

*Note: nothing has been committed or pushed anywhere yet — all changes are local and
build-verified, pending the go-ahead.*
