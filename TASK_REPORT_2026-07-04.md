# CertifyCX — Task Report (4 July 2026)

**Prepared for:** Client (Midhat Sir)
**Repository:** github.com/mvpcertify-del/certify-website (branch `main`)
**Build:** ✅ Passing · **Lint:** ✅ Clean on changed files

This report covers the batch of requests the client sent on 3–4 July 2026.

---

## Summary Table

| # | Client's Request | Status |
|---|---|---|
| 1 | Add a **Payment** step — 3 steps become 4 | ✅ **Complete** (committed) |
| 2 | **Mobile language option** — switch language on mobile | ✅ **Complete** (committed) |
| 3 | **Auto default language by country** (e.g. Brazil → Portuguese) + change to English | ✅ **Already working** + mobile switch added |
| 4 | Adobe / Arabic document (Arabic default in an Arab country) | ✅ **Covered** — same auto-language feature (no separate work) |
| 5 | Change enquiry emails to **info@wca-global.com** | ⏸️ **On hold** — see note |

---

## 1. Payment step (3 → 4 steps) — ✅ Complete

**Client asked:** On the landing page "How Certification Works", add a Payment step. The existing 3rd step ("Receive Certification") should become step 4. Total 4 steps: 1, 2, 3, 4.

**Done:**
- Inserted a new **"Complete Payment"** step (card icon) as **step 03**.
- "Receive Certification" moved to **step 04**.
- Section subtitle updated to "…in four simple steps".
- Text added to all 9 languages (English final; others marked draft, functionality unaffected).

**New order:**
1. Register Your Company
2. Select ISO Standard
3. **Complete Payment** *(new)*
4. Receive Certification

**Files:** `src/pages/landing/LandingPage.jsx`, 9 locale files.
**Commit:** `b98c2e5`

---

## 2. Mobile language option — ✅ Complete

**Client asked:** On the mobile version, we need the language option (like supabase.com mobile). It should be possible to change to English.

**Problem found:** On mobile, the landing page's top navigation was completely hidden, and there was **no menu button** — so on a phone there was **no way to change the language** (and no visible Login / call-to-action either).

**Done:**
- Added a **hamburger menu button (☰)** to the landing navigation, visible on phones/tablets.
- Tapping it opens a menu containing: the page links, the **language switcher**, Login, and the "Start Gap Analysis" button.
- The language switcher offers **9 languages**: English, العربية (Arabic), Español, Français, Русский, **Português 🇧🇷**, Deutsch, 中文, हिन्दी.

**Files:** `src/pages/landing/LandingPage.jsx`, `src/pages/landing/LandingPage.css`, 9 locale files.
**Commit:** `3f091f2`

---

## 3. Auto default language by country — ✅ Already working

**Client asked:** The site should open automatically in the country's default language, with an option to change to English. If logging in from Brazil, the default should be Portuguese (Brazil).

**Status:** This was **already built** in the platform and needs no new code:
- The app detects the visitor's country (via IP address, timezone, and browser locale) and automatically opens in that country's language.
- **Brazil → Portuguese**, Arab countries → Arabic, Spain/Latin America → Spanish, etc. are all already mapped.
- The visitor can then **change to English** (or any of the 9 languages) — and now, thanks to task #2, this is possible on mobile too.

So the only gap was the **mobile switch button**, which is now fixed.

---

## 4. Adobe / Arabic document example — ✅ Covered

**Client's note:** The shared document should show Arabic by default (since currently in an Arab country) with the option to change to English.

**Status:** This is the **same auto-language behaviour** as task #3 — when a visitor is in an Arab country, the site opens in Arabic automatically, and they can switch to English. No separate development was required.

---

## 5. Enquiry emails → info@wca-global.com — ⏸️ On hold

**Client asked:** Change all default certification-enquiry emails on **wca-global.com** (some forms use contact@wca-global.com) to **info@wca-global.com**.

**Why it's on hold:** The domain **wca-global.com** and the address **contact@wca-global.com** **do not exist anywhere in the certify.cx codebase** (a full search confirmed this). This appears to belong to a **separate website**, not the certify.cx platform.

**Needs from client:** Please confirm whether wca-global.com is part of this same project or a different website. If it's a different site, this change must be made there, not here.

---

## Current State

- ✅ **Tasks 1, 2, 3, 4 complete** and committed to the `main` branch.
- ⏸️ **Task 5 (emails)** awaiting client confirmation about wca-global.com.
- ⏳ **Not yet pushed to GitHub / deployed** — after push, a quick live test on a real phone is recommended (payment step display + mobile language menu).

**Commits this batch:**
- `b98c2e5` — Payment step (3 → 4)
- `3f091f2` — Mobile hamburger menu with language switcher
