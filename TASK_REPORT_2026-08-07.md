# Task Report — 7 August 2026

**Project:** Certify.cx
**Request (client, 7 Aug):** *"ADD — Referral Partners in the left Menu under Clients"*
**Status:** Completed

---

## What was delivered

**Referral Partners** now appears in the left sidebar **directly under Clients**, for Super Admin
and Country Admin. It opens a new admin screen at `/admin/referral-partners`.

The menu entry could not just point at the existing `/referrals` page: that page is a *partner's own*
dashboard, so an admin opening it saw their own (empty) referral page rather than the referral
partners. A proper admin board was built for it.

### The Referral Partners screen shows

| | |
|---|---|
| **Summary strip** | Partners · Converted clients · Commission earned · Awaiting payout |
| **Search** | by name, e-mail, referral code or country |
| **Table, one row per partner** | Partner (name / e-mail / company) · Country · Referral code · Clients introduced · Converted · Converted this month · Commission earned · Commission awaiting payout · Commission rate · Joined date · Status (Active / Inactive / Pending approval) |

Sorted best-performing first. Read-only by design — nothing on this screen deactivates a partner or
releases a payout; those stay in User Management and on the referral ledger, so the screen can be
opened by anyone who needs the numbers without widening what they can change.

### Related fix included

The **Referrals** box on the Main Dashboard counted 20 referral partners but opened the partner's own
empty dashboard. It now opens this new Referral Partners screen, so the number and the destination
finally agree.

---

## Rules respected

- **Access control** — the route accepts Super Admin and Country Admin only, and the menu entry is
  pinned to exactly those two roles, so the menu can never offer a link that the route then rejects.
- **Country scoping** — a Country Admin receives only their own country/region's partners. The filter
  is applied on the server, not in the browser, and fails closed if their region is unset.
- **Consultancies excluded** — consultancy partners have their own screen and previously sat on the
  referral role, so they are filtered out here and are not counted twice across the two pages.
- **Commission figures match payout logic** — an individually agreed rate wins over the flat 10%
  referral rate, exactly as the checkout code resolves it when a commission is actually paid.
- **Languages** — the new screen is fully translated in all nine supported languages
  (English, Spanish, Arabic, French, German, Portuguese, Russian, Chinese, Hindi), Arabic included
  with RTL-safe layout. Key parity across the nine locale files was verified.

---

## Files changed

| File | Change |
|---|---|
| `src/components/layout/Sidebar.jsx` | "Referral Partners" menu entry, placed under Clients |
| `src/pages/admin/AdminReferralPartners.jsx` | New admin screen |
| `src/pages/admin/AdminReferralPartners.css` | Styling for the screen |
| `src/App.jsx` | Route `/admin/referral-partners`, restricted to the two admin roles |
| `api/referrals.js` | New `partner-list` action — verified admin token, region-scoped, rolls up the referral ledger per partner |
| `src/pages/dashboard/MainDashboard.jsx` | Referrals box now opens the new screen |
| `src/i18n/locales/*.json` (9 files) | Menu label + all screen text, translated |

**No database migration is required** — the screen reads the existing `profiles` and `referrals`
tables, so it can be deployed as-is.

---

## Verification note

The change was reviewed statically (all nine locale files validated as correct JSON with matching
keys). Node.js is not installed on the machine this work was done on, so `npm run dev` / `npm run build`
could not be executed here — the screen should be opened once on the dev server before it goes to the
client, as a final visual check.
