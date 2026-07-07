# Task Report — 5–6 July 2026

**Project:** Certify.cx™ landing page
**Repository:** github.com/mvpcertify-del/certify-website (branch `main`)
**Commits:** `2200dda`, `c698cea` (5 Jul) · `10602f9`, `90e1b91` (6 Jul) — all pushed, Vercel auto-deploys
**Build:** ✅ Passing

This report covers the last two days of client feedback (5 July and 6 July).

---

## Summary Table

| # | Client's Request | Day | Status |
|---|------------------|-----|--------|
| 1 | Bring all 4 steps in one line (desktop) / stacked (mobile) | 5 Jul | ✅ Done |
| 2 | Change green CTA button to **"Sign Up"** | 5 Jul | ✅ Done |
| 3 | Language must default by client IP (Lebanon → Arabic) | 5 Jul | ✅ Done |
| 4 | Mobile: language dropdown visible at the top | 5 Jul | ✅ Done |
| 5 | Make auth buttons professional (Log In / Log Out) | 5 Jul | ✅ Done |
| 6 | Step "03" was still English + showed `[DRAFT]` | 6 Jul | ✅ Done |
| 7 | Style Login/Logout as proper branded buttons | 6 Jul | ✅ Done |
| 8 | Any Arab country (Gulf etc.) → open in Arabic | 6 Jul | ✅ Done |

---

# Batch — 5 July 2026 *(commits `2200dda`, `c698cea`)*

### 1. Four steps in one line (desktop) / stacked (mobile) ✅
**Client asked:** On the "How Certification Works" section, show all 4 steps in a
single row on desktop, and stacked (one under the other) on mobile.

**Done:** The steps section is now a responsive grid — 4-in-a-row on desktop,
2 columns on tablet, and 1 column (stacked) on phones. The connecting arrows only
show on desktop where the steps sit side by side.

### 2. Green CTA button → "Sign Up" ✅
**Client asked:** Change the green "Start Your Free Gap Analysis" button to
**Sign Up**.

**Done:** All the green call-to-action buttons (top nav, hero, mobile menu) now
say **"Sign Up"** and go to the sign-up page. Translated in all 9 languages.

### 3. Default language by client IP — Lebanon → Arabic ✅
**Client asked:** Since the client is in Lebanon, the site should show Arabic; the
system should detect the client's IP by default (mobile & desktop).

**Problem found & fixed:** The auto-detection existed, but a caching bug meant the
IP-based choice was being suppressed on every load, so it never actually applied.
Fixed so the country/IP language now correctly takes effect — a Lebanon visitor
opens in Arabic. A manual language choice still overrides it and sticks.

### 4. Mobile — language dropdown visible at the top ✅
**Client asked:** On mobile, the language dropdown should be visible at the top so
the visitor can override the country default without digging into a menu.

**Done:** The language switcher now sits **always visible in the mobile top bar**
(next to the menu button), not hidden inside the dropdown menu.

### 5. Professional auth buttons — Log In / Log Out ✅
**Client asked:** Make the login button professional and consistent — Sign Up ↔
Sign Out, Log In ↔ Log Out.

**Done:** Standardised all wording to one professional set — **Sign Up** (new
users), **Log In** (existing users), **Log Out** (exit). Previously it was a mix
of "Login" / "Sign In" / "Sign Out".

---

# Batch — 6 July 2026 *(commits `10602f9`, `90e1b91`)*

### 6. Mobile step "03" showing English + "[DRAFT]" ✅
**Reported:** On the mobile Arabic view, step 3 ("Complete Payment") was still in
English and literally printed the text `[DRAFT]`.

**Cause:** When the Payment step was added, its translations were left as draft
placeholders (`[DRAFT] Complete Payment`) in the 8 non-English languages, so the
app showed that raw placeholder.

**Fix:** Translated the payment step (title + description) and the mobile menu
label into all 8 languages — Arabic, Spanish, French, German, Portuguese,
Russian, Chinese, Hindi. No more English or `[DRAFT]` on any language.
- Arabic step 3 now reads: **أكمل الدفع** — "ادفع بأمان مقابل باقة الشهادة المختارة لبدء عملية التدقيق."

### 7. Login / Logout as proper branded buttons ✅
**Reported:** Login/Logout were plain text; asked to style them as buttons with
proper width/height, brand colour, and aligned navigation — professional look.

**Fix:**
- **Landing top nav** — "Log In" is now an **outlined green (brand) button**,
  a matched pair next to the filled "Sign Up" button (same height/padding/aligned).
- **Hero section** — the "Log In" button now has a clear brand-green outline (was a
  barely-visible grey border that read as plain text).
- **Mobile menu** — "Log In" is a full-width outlined button matching "Sign Up".
- **Dashboard** — Sidebar "Log Out" and the top-bar "Log Out" were already proper
  buttons (padding, brand/danger colour, hover state) — left as-is.

### 8. Any Arab country → open the site in Arabic by default ✅
**Reported:** Any Arabic country (e.g. the Gulf countries) should default to
Arabic — the website should open in Arabic automatically.

**Fix:** Extended the automatic language detection to cover **all 22 Arab League
countries** (added Comoros and Western Sahara to complete the list). A visitor from
any of these opens the site in Arabic (RTL) by default:

> Saudi Arabia, UAE, Qatar, Kuwait, Bahrain, Oman, Jordan, Lebanon, Iraq, Syria,
> Yemen, Palestine, Egypt, Libya, Tunisia, Algeria, Morocco, Sudan, Somalia,
> Djibouti, Mauritania, Comoros, Western Sahara.

Detection uses (most accurate first): **IP location → timezone → browser language**.
If the visitor manually picks another language, their choice is kept and not
overridden.

---

## Current State

- ✅ All 8 items above are **complete, committed and pushed** to `main`.
- Live on the site once Vercel finishes the deploy (1–2 minutes per push).
- **Recommended live test (on a real phone):** 4-step layout (row on desktop /
  stacked on mobile), the "Sign Up" + "Log In" branded buttons, the mobile
  language dropdown at the top, and Arabic auto-loading from a Gulf/Arab IP.

*Note: some internal Super-Admin dashboard labels still carry `[DRAFT]` markers in
a few languages — these are not customer-facing and were out of scope. Can be
finished in a later translation pass if desired.*

*Still on hold (from the 3–4 July batch): changing enquiry emails to
info@wca-global.com — that domain is a separate website, not part of this
codebase; awaiting client confirmation.*
