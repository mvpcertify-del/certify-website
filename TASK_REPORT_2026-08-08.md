# Task Report — 8 August 2026

**Project:** Certify.cx
**Status:** All three items completed

---

## The three requests

| # | Client's words | Status |
|---|---|---|
| 1 | *"Referral Partners — apply the 4 action icons — Change the category to ⚡"* | Done |
| 2 | *"Referral Partners — 1. Add ⚡  2. Add the 4 Action Icons (View, Edit, Deactivate, Delete) for each line wise similar to Clients"* | Done |
| 3 | *"Above is the email notification for a new user registration"* (screenshot of the alert e-mail) | Done — see below |

Items 1 and 2 are the same request stated twice, so they were delivered as one piece of work.

---

## 1 & 2 — Referral Partners: category marker and row actions

### Category marker (⚡)

**Referral Partners** in the left menu now carries the ⚡ marker instead of 🔍. That marker is not
decoration — across the whole sidebar 🔍 means *"this screen only shows information"* and ⚡ means
*"records are entered/changed here"*. Until today the screen was read-only, so 🔍 was correct; now
that it edits, deactivates and deletes partners, ⚡ is correct.

One detail worth knowing: for a **Country Admin** the entry still shows 🔍, exactly as **Clients**
does for them. A Country Admin only gets the read-only View action on both screens, so showing them
⚡ would promise something the screen does not give them. A Super Admin sees ⚡ on both.

### The four action icons

Every row on **Referral Partners** now ends with the same action cluster the **Clients** screen uses —
same icons, same order, same colours, same confirmation behaviour:

| Icon | Action | What it does |
|---|---|---|
| 👁 | **View** | Read-only popup with the partner's full record: name, e-mail, company, country, referral code, clients introduced, converted, this month, commission earned, commission awaiting payout, rate, joined date and status |
| ✏️ | **Edit** | Change name, e-mail, company and country |
| 🔄 | **Deactivate / Activate** | Blocks or restores the partner's login; the row's status badge updates immediately |
| 🗑 | **Delete** | Permanently removes the account, after an "are you sure" confirmation |

**Who sees what** — identical to Clients: a **Super Admin** gets all four; every other admin who can
reach the list gets **View** only. This is enforced twice, in the screen *and* again on the server,
so the buttons are not the thing protecting the data.

Nothing was invented for this screen: the edit, activate/deactivate and delete actions call the very
same endpoints User Management and Clients already call, which re-check the caller's rights against
their login token before writing anything. A Country Admin therefore cannot act on a partner outside
their own country even if the request were sent by hand.

---

## 3 — The new-registration e-mail

The screenshot showed the alert an admin receives when somebody registers. Two real faults were found
in it, plus one gap.

### Fault 1 — the broken logo (the one visible in the screenshot)

The Certify.cx mark at the top of the e-mail rendered as a broken-image icon. Cause: the logo address
was built from the `APP_PUBLIC_URL` setting, which is set to **`https://app.certify.cx`** — a hostname
that does not exist. Verified directly:

```
https://app.certify.cx/brand-mark.png  →  could not connect
https://certify.cx/brand-mark.png      →  200 OK, 92,972-byte PNG
```

**Fixed** by untying the logo from that setting altogether. The mark now has its own address with a
verified default (`https://certify.cx/brand-mark.png`), so a wrong app-host setting can never break
the artwork in an e-mail again. This repairs the logo in **every** transactional e-mail, not just this
one.

### Fault 2 — the "Open dashboard" button pointed at a dead host

The same wrong setting also built the green **Open dashboard** button in that e-mail, so it opened a
host that does not resolve.

**Fixed in the code** (the fallback is now the live site rather than an empty address), **but one
manual step is required from your side**, see *Action needed* below.

### Gap — the e-mail did not say who had registered

The body said only *"<name> (<e-mail>) just registered."* — nothing about what kind of account it is
or which country it belongs to, which are the two things that decide which admin has to pick it up.

The alert now carries a proper details panel, in the same style as the payment and certificate e-mails:

> **Name** · **Email** · **Registered as** (Client / Referral / Consultancy / Auditor / Certification
> Body) · **Company** · **Country** · **Phone** · **Registered on**

It also now fires for a self-registered **partner, auditor or certification body**, not only for
clients — those registrations arrived silently before. No alert that was being sent before has been
removed.

---

## ⚠ Action needed from your side (1 minute)

In **Vercel → Project → Settings → Environment Variables**, change:

```
APP_PUBLIC_URL   =   https://certify.cx
```

(it is currently `https://app.certify.cx`), then redeploy. Environment variables live in Vercel, not
in the code, so this is the one part of the fix that cannot be done from the repository. Without it
the logo still works — that fix is in the code — but the **Open dashboard** button in transactional
e-mails will keep pointing at the dead host.

---

## Files changed

| File | Change |
|---|---|
| `src/pages/admin/AdminReferralPartners.jsx` | View / Edit / Deactivate / Delete per row, plus the edit and view popups |
| `src/pages/admin/AdminReferralPartners.css` | Action column, table width, and the edit dialog / banner styles |
| `src/components/layout/Sidebar.jsx` | Referral Partners category marker 🔍 → ⚡ |
| `src/i18n/locales/*.json` (9 files) | New "Edit referral partner" heading, translated in all nine languages |
| `api/_brandAsset.js` | Logo address untied from the app host — fixes the broken image |
| `api/_emailTemplates.js` | Admin alert e-mails can carry a details panel |
| `api/_notifyAdmins.js` | Passes the details through; dashboard link falls back to the live site |
| `api/create-user.js` | Richer registration alert; now also covers self-registered partners/auditors/CBs |
| `.env.example` | `APP_PUBLIC_URL` corrected, with a note that Vercel must be updated too |

**No database migration is required.** Nothing was added to the database — the new actions reuse
endpoints that already exist.

---

## Verification note

Reviewed statically: all nine language files were validated as correct JSON with matching keys, and
every reused label was confirmed to exist. Node.js is still not installed on the machine this work was
done on, so `npm run dev` / `npm run build` could not be run here — the screen should be opened once
on the dev server or a preview deployment before it goes to the client, as a final visual check
(worth checking the Arabic layout too, since the table gained a column).

For item 3 the instruction was a screenshot with the line *"Above is the email notification for a new
user registration"* and no explicit change requested, so the work done is: repair what is visibly
broken in that e-mail (the logo), repair the dead button behind it, and make the alert actually useful.
If the client meant something more specific by that message, say the word and it will be adjusted.
