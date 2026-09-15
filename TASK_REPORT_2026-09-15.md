# Task report — 15 September

**Branch:** `main` · **Status:** committed and pushed
**Build:** passing · **Lint:** 53 problems (unchanged baseline — no new errors)
**Locales:** en/es/ar fully translated for every new string; no missing keys

---

## The 2 points

| # | What the client asked (from the screenshots) | Done | Where |
|---|---|---|---|
| 1a | "The page line should be in 50 contacts" | ✅ | Investors table — 50 rows/page |
| 1b | "An icon could be added with reference to companies CEOs whom I contact in LinkedIn" | ✅ | Investors row actions — new toggle icon |
| 2 | "An extra box to be added — displaying the number of Funds CEOs which I have contacted through LinkedIn" | ✅ | Investors dashboard — new stat card |

---

## 1 — Investors list: pagination + "contacted" icon

**Pagination.** The register lists all 150 funds on one page today. It now
shows 50 at a time with Previous/Next controls and a "Showing 1–50 of 150"
line under the table. Any search or filter change (region, active-only,
missing-email) resets back to page 1, so it can never land you on a page
that filtering just emptied.

**The new icon.** The row actions already had a LinkedIn icon that *opens*
the partner's or fund's profile — that was last week's feature and it's
unchanged. What was missing is a way to record that you have actually
**messaged** that person. There is now a second icon next to it (a
person-check mark) that toggles a fund between "not yet contacted" and
"contacted on LinkedIn" — it turns solid blue once marked, and hovering it
says who it's tracking (the key partner's name, or the fund's name if no
partner is on file). It is independent of the Active/Inactive status: a
fund can be active and never contacted, or contacted and later deactivated.

This is a real, saved field — not a UI-only checkbox — so it survives a
page refresh and is visible to any Super Admin who opens the list.

## 2 — New dashboard box: "Contacted on LinkedIn"

A fifth stat card sits next to Funds / Active / With an email / Regions,
showing a live count of how many funds are currently marked contacted.
Clicking it, like the other boxes, filters the table down to just those —
so it doubles as a running tally and as a way to review who's already been
reached out to.

---

## What had to change under the hood

- **New database column.** `investors.linkedin_contacted` (true/false) plus
  `linkedin_contacted_at` (when it was marked) — migration
  `supabase/phase36_investor_linkedin_contacted.sql`. You ran this by hand
  against Supabase already; the code assumes it's live.
- **`RowActions`** (the shared 5-icon action cluster used across every admin
  list) gained an optional 6th icon, so this pattern is available to any
  other screen later without copy-pasting it.
- **Translations** added to all three locales (en/es/ar) for every new
  label — the "contacted" icon's tooltip, the new box, and the pagination
  controls.

---

## Verified

- `npm run build` — passes.
- `npm run lint` — 53 problems, identical to the pre-existing baseline; zero
  new errors from this change.
- i18n audit — the new `investors.*` keys are present and translated in
  en/es/ar (the project's three supported locales per CLAUDE.md). The
  additional hi/pt/ru/zh/de/fr locale files carry old, unrelated drift from
  before this work and were not touched.
- Not independently re-checked against the live database (no DB access from
  here) — this relies on your confirmation that the migration ran. If the
  toggle errors on click, the column likely didn't apply; the fix is
  re-running `supabase/phase36_investor_linkedin_contacted.sql`.

Both of today's points are done end-to-end: schema, toggle, stat box,
pagination, and translations. Nothing here is placeholder or "coming soon."

---

## Part 2 — Resend email audit ("kaunsa email galat address se ja raha hai")

**Commits:** `4083dce` (sender identities), `53d8f9c` (Google-signup welcome email)

### What was found and fixed

No email's "from" address was ever a hardcoded literal anywhere in the code —
every sender read it from an environment variable. Two real problems were in
that configuration, not the code:

1. `RESEND_FROM_EMAIL` pointed at `noreply@mail.certify.cx`, a subdomain that
   had never verified in Resend — the actual reason system emails were
   silently failing. Moved to `noreply@certify.cx` (root domain, now
   verified) — **you deployed this.**
2. `RESEND_SUPPORT_FROM_EMAIL` (the business identity: referral outreach,
   invoices, certificate mail, partner replies) was documented but never
   actually set — every business email was silently falling through to the
   system address. Now set explicitly to `support@certify.cx`.
3. `mvpcertify@gmail.com` (a personal inbox, not a from-address) was shown to
   end-users in 5 places as a "contact us" line — 3 copies of the
   registration-declined message, a referral payout instruction, and the
   investor page's "contact us" line across all 9 locales. Replaced with
   `support@certify.cx` everywhere.
4. Google-OAuth signup never sent any branded email at all (only Google's own
   generic security notice) — email/password signup did. Added the same
   welcome email to the Google path.

### Live-tested against production (via Resend's own delivery log — the
### definitive source, not guesswork)

| Test | Result |
|---|---|
| Fresh self-signup (email+password) → Welcome email | ✅ **delivered**, from `CertifyCX <noreply@certify.cx>` |
| Same signup → admin "New registration" alert | ✅ **delivered**, from `Certify.cx Support <support@certify.cx>` |
| Password reset (`/auth/v1/recover`) on that same account | ❌ **Supabase itself returned `500 unexpected_failure: "Hook requires authorization token"` — no email even attempted.** Confirmed by the Resend log: zero new entries after the recovery call. |

### The bug you're seeing right now

**Password reset — and everything else that runs through Supabase's own auth
flows (magic link, invite, email-change) — is broken**, and it is broken
**on the Supabase Dashboard side**, not in this codebase. The error text
("Hook requires authorization token") comes straight from Supabase's auth
server, before our `api/auth-email-hook.js` is ever reached — grepped the
whole repo, that string exists nowhere in our code. This is exactly Step 3 of
`EMAIL_SETUP_GUIDE.md`, still outstanding:

1. Supabase Dashboard → **Authentication → Hooks → Send Email Hook**
2. Confirm it's **enabled**, URL = `https://certify.cx/api/auth-email-hook`
3. Re-generate (or re-copy) the **signing secret** and paste it into Vercel's
   `SUPABASE_AUTH_HOOK_SECRET` — format `v1,whsec_...`. Your local `.env` has
   this **blank**; if Vercel's copy is also blank or stale, that alone
   explains the failure.
4. Redeploy after saving it.

New registration ("Welcome" email) is confirmed working and is a **separate,
already-correct code path** (`api/create-user.js`, doesn't touch this hook at
all) — that part of "nothing is going out" is not accurate; it was verified
delivered twice today with a live timestamp in Resend's own log.

### Test accounts left behind (need your cleanup — same restriction as before)

- `aromahomeofficial+certifytest15sep-b@gmail.com` — created during this
  test, still live. Delete from Admin → Users when convenient.

### Not fixed by me

Supabase Dashboard configuration is outside this codebase — no file to
change, no commit to push. Steps above are yours to run; ping me once done
and I'll re-run the exact same recovery test to confirm.
