# Task report — 16 September

**Commit:** `0849acc` · **Branch:** `main` · **Status:** committed, pushed, migration run by you
**Build:** passing · **Lint:** 53 problems (unchanged baseline — no new errors)
**Locales:** es/ar — 0 missing keys against en

---

## The six points

| # | What the client asked | Done | Where |
|---|---|---|---|
| 1 | Display Options — 10 / 50 / All per page, move control to the top | ✅ | Investors table |
| 2 | How to access `support@certify.cx` to email new referral partners | ✅ answered | Not code — see below |
| 3 | Super Admin's own email/password showing pre-filled on the public registration form | ✅ | `SignUp.jsx`, `ResetPassword.jsx` |
| 4a | Post-registration redirect page is confusing — add a welcome/next-steps message | ✅ | `PartnerContract.jsx` |
| 4b | Remove "WCA GLOBAL" from the Referral agreement — focus on Certify.cx™ only | ✅ (migration applied) | `contract_templates` table |
| 5 | Make the Certify.cx logo transparent | ⚠️ blocked | See below — asked for the reference image again |
| 6 | ™ next to "Certify.cx" | ✅ already true | `BrandLogo` component, sitewide |

Built with three parallel subagents (client asked for multi-agent), each scoped to a disjoint set of files so they could run concurrently without stepping on each other.

---

## 1 — Investors: Display Options, moved to the top

Pagination was fixed at 50/page with the summary and Previous/Next buttons below the table. Now there's a page-size selector — **10 / 50 / All** — sitting above the table next to the search and region filters, with the "Showing X–Y of Z" summary and paging controls moved up alongside it.

"All" is handled as its own real mode, not a page size of `Infinity` or some huge number — `pageCount` becomes 1 and the full filtered list renders directly, so there's no `Math.ceil`/overflow edge case to worry about. Changing the page size (like any filter change) resets back to page 1.

## 2 — Accessing `support@certify.cx`

Not a code task — answered directly, verified against live DNS:

- `certify.cx`'s MX records point to **Cloudflare Email Routing** (`route1/2/3.mx.cloudflare.net`), not Zoho as the original June plan assumed.
- Cloudflare Email Routing is **forward-only** — it has no inbox or webmail of its own to send from. It only forwards incoming `support@certify.cx` mail to a real mailbox (e.g. a Gmail account).
- To actually *send* as `support@certify.cx`: find which real inbox it forwards to (Cloudflare dashboard → the domain → Email → Email Routing), then in that inbox use Gmail's **Settings → Accounts → "Send mail as"** to add `support@certify.cx` — Gmail verifies it by emailing a confirmation link to that same forwarded inbox.
- For a proper two-way inbox instead of a forward, the real fix is a mailbox provider (Zoho Mail or Google Workspace) for the domain.

## 3 — Autofill leaking the Super Admin's own credentials

**What was actually wrong:** the public "Register as Referral" (and every other role's) sign-up form had **zero `autoComplete` attributes** on its email/password fields. With no hint telling the browser this is a *new* account being created, Chrome matched the fields against a saved login and silently pre-filled whoever's browser was open — in the client's test, their own Super Admin credentials — into a stranger-facing public form.

**Fix:** added `autoComplete="username"` to every email input and `autoComplete="new-password"` to every password/confirm-password input, across all three near-duplicate signup branches in `SignUp.jsx`, plus the same fix in `ResetPassword.jsx` (same bug class — an old saved password could otherwise get suggested there too). `Login.jsx` and `ForgotPassword.jsx` were deliberately left alone: those forms *should* offer the browser's saved autofill.

This was small enough to just fix outright rather than skip, per your fallback instruction.

## 4a — Welcome banner on the partner-agreement page

A new partner is auto-logged-in right after registering, and if they haven't signed their agreement yet, `DashboardLayout` silently redirects them to `/partner/contract` with no explanation — confusing, exactly as you found.

Added a welcome banner at the top of that page: *"One last step to activate your account — read and sign the agreement below to unlock your partner dashboard. It only takes a couple of minutes."* It only shows for a genuine first-time signer (never signed anything before) — a returning partner facing a contract-version update still sees the existing "this agreement has been updated" notice instead, so the wording never misleads a renewal case.

## 4b — "WCA GLOBAL" removed from the Referral agreement

The agreement text isn't in the code — it lives in the database (`contract_templates` table), so this needed a migration rather than a JS edit. `supabase/phase37_referral_agreement_drop_wca_global.sql` rewrites the **active referral template only**:

- Title: `WCA GLOBAL Referral Partner Agreement` → `Certify.cx Referral Partner Agreement`
- Body opening line: `WCA GLOBAL REFERRAL PARTNER AGREEMENT` → `CERTIFY.CX REFERRAL PARTNER AGREEMENT`
- Parties clause: `Parties: WCA GLOBAL (the "Company")` → `Parties: Certify.cx (the "Company")`

Everywhere else the body already just says "the Company" generically, so nothing else needed changing. **You've run this migration already** — worth opening the Referral agreement once to eyeball it now reads Certify.cx throughout.

**Left alone on purpose:** the Country Admin, Auditor, and Consultancy agreements carry the exact same "WCA GLOBAL" wording (seeded at the same time as the referral one). You only flagged Referral, so those three are untouched — say the word if you want them rebranded the same way.

## 5 — Logo transparency: investigated, found nothing to fix (yet)

Checked both logo files used across the site and in emails (`public/brand-mark.png` and `src/assets/brand-mark.png` — confirmed byte-identical) at the actual pixel/alpha-channel level, not just by eye. **The background is already fully transparent** — roughly 93,000 pixels at alpha 0, with only the logo's own stroke pixels opaque. What looks like a white background in a file preview is the preview tool's own matte, not something baked into the file.

So there's currently nothing in the code or the asset to fix. The reference image you mentioned ("similar to the idea I've just shared") didn't come through on this end — please resend it so the actual problem (if it's showing up somewhere specific, like an iOS home-screen icon plate) can be pinned down rather than guessed at.

## 6 — ™ next to "Certify.cx"

Already true everywhere. The shared `BrandLogo` component (used by the sidebar and every other place the wordmark appears) has always rendered `Certify.cx™` with the trademark symbol — confirmed by reading the component and its one call site in the sidebar header. If a specific screen is missing it, a screenshot would help track down which one bypasses the shared component.

---

## Verified

- `npm run build` — passes.
- `npm run lint` — 53 problems, identical to the pre-existing baseline.
- i18n audit — new keys (`investors.rowsPerPage`, `investors.showAll`, `partnerContract.welcomeTitle/Body/Note`) present with real translations in en/es/ar; 0 missing keys in es.json/ar.json against en.json.
- Migration `phase37` — idempotent (safe to re-run), and you've already applied it.

Five of six points are done end-to-end. Logo transparency stays open pending the reference image; ™ turned out to already be correct everywhere it's rendered from the shared component.
