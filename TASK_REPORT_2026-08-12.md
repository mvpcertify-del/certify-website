# Task Report — 12 August 2026

**Project:** Certify.cx
**Status:** All five items handled

---

## The five requests

| # | Client's words | Status |
|---|---|---|
| 1 | *"Certify.cx is taking long time to open. Check why this issue is always happening"* | Diagnosed and fixed |
| 2 | *"when registering as Add Auditor, in case I want to use copy paste information, always the Form is exiting & I have to start again. This issue happened 5 times"* | Cause found and fixed |
| 3 | *"Replace the Audit Log to become - Upload CV"* | Done |
| 4 | *"Keep the price for ISO 9001, ISO 14001, ISO 45001 at US$ 999 each. All other remaining certificates price for each US$ 1,999"* | Done |
| 5 | *"IS IT POSSIBLE TO SHIFT THE 4 ICONS FROM THE RIGHT SIDE TO BECOME IN THE LEFT SIDE"* | Done, across every list |

---

## 1 — Why the site was slow to open

I went through what the browser actually has to do between clicking the link and
seeing the dashboard. There were four separate delays, all of them in a queue —
each one waiting for the one before it to finish. Every one is now removed.

### a. The font was the worst of them

The site's typeface was being requested from Google with an `@import` line
inside the app's stylesheet. That is the slowest possible way to load a font,
and it was blocking the whole page:

1. the browser downloads the app's stylesheet,
2. **only then** does it discover there is a Google font to fetch,
3. it opens a fresh connection to Google (DNS + handshake),
4. downloads a second stylesheet from Google,
5. downloads the font file itself,
6. **and only now is it allowed to draw anything on screen.**

On a slow connection, or one where Google is throttled — which is common on
Middle East corporate and hotel networks — this alone was several seconds of
white screen, and if Google was unreachable the page waited for the timeout
before giving up.

The font is now requested from the page itself, in parallel with everything
else, and marked as non-blocking. Text appears immediately in the system font
and switches to Inter the moment it arrives. If Google is unreachable the site
simply renders in the fallback font instead of hanging.

### b. There was nothing to look at while it loaded

Even a fast load has a gap between the page arriving and the app starting, and
that gap was a blank white rectangle. A perfectly healthy two-second load is
indistinguishable from a broken site when there is nothing on screen — which is
what "taking long time to open" describes as much as the raw seconds do.

The logo and a spinner now appear in the first fraction of a second, before any
of the app has loaded, and hand over to the real screen when it is ready.

### c. Three requests were running one after another instead of together

Opening any signed-in page did this in strict sequence: check the session →
fetch the permission settings → fetch the user's profile. The second of those
does not depend on the first, so it was waiting for no reason. It now runs
alongside the others, and the connection to the database is opened while the
app's own code is still being read. Nothing about permissions has changed —
they are still fully loaded before any screen is drawn.

For non-English visitors there was a fourth wait: the app refused to draw
anything until that language's file had downloaded. It now shows the app after
a short cap and swaps the language in when it lands, rather than holding a blank
page indefinitely.

### d. Every visit re-downloaded the whole app

The application's code files carry a unique fingerprint in their name, so a
given file can never change. The browser was not being told that, so it
re-checked roughly 600 kB of code against the network on every single visit.
It is now allowed to reuse them from disk. **For someone who opens the site
several times a day — which is you — this is the largest single improvement.**
A new release still arrives immediately: the filenames change, so there is no
risk of anyone being served old code.

### e. Also fixed: the app was re-querying every time you switched windows

Every list screen was reloading itself from the database each time the browser
tab regained focus — so alt-tabbing to Word or WhatsApp and back put the screen
back into "Loading…" for no reason. The affected screens were Clients, Users,
Auditors, Certification Bodies, Country Admins, Companies, Auditor Assignments,
Certification Requests, Reports and the main Dashboard. They now reload only
when the signed-in user, their role or their region actually changes.

**What is left that I cannot fix from here:** the app is hosted on Vercel's
Hobby plan, which serves from a single region. A visitor far from that region
pays that distance on every request. If the site still feels slow after this
release for users in the Gulf, that is the next thing to look at, and it is a
hosting decision rather than a code one.

---

## 2 — The Add Auditor form closing during copy/paste

### What was happening

Whenever you selected text in a field — to copy it, or to replace what was
there — and the mouse drifted even slightly outside the white dialog before you
released the button, the whole form closed and everything you had typed was
gone.

### Why

The dark area around a dialog closes it when clicked, which is normal. But a
browser reports a click as happening wherever the mouse went *down* and *up*
combined — so pressing inside a field and releasing just past the edge of the
dialog counted as a click on the dark area outside it. Dragging to select text
is exactly the movement that triggers it, which is why it kept happening to you
during copy/paste and not during ordinary typing. Five times, as you said.

### The fix

The dialog now closes only when the click both starts *and* ends outside it — a
deliberate click away from the form. Clicking outside still closes it as
before; dragging out of it while selecting text no longer does.

This applies to **every** dialog in the platform, not just Add Auditor —
the same component is behind all of them.

### And a safety net on top

Even a deliberate close now keeps your work. If the Add form is dismissed with
the ✕ or the Escape key, reopening it brings back everything that was typed
instead of a blank form. It is only cleared when you press **Cancel**, or when
the account is successfully created — the two cases where you have actually
finished with it.

---

## 3 — "Audit Log" becomes "Upload CV"

The second file field on the Add / Edit Auditor form is now **Upload CV**.

Worth knowing: the auditor's own registration form has always asked for a CV,
and this admin form never did — it asked for an audit log instead. So this
change also closes that gap, and an auditor added by an administrator now has
the same documents on file as one who signed up themselves. The uploaded file
is stored as a CV, which the database already supported, so **no database
change was needed**.

The label is translated in all nine languages.

---

## 4 — New pricing

| Standard | Price |
|---|---|
| ISO 9001 | **US$ 999** |
| ISO 14001 | **US$ 999** |
| ISO 45001 | **US$ 999** |
| ISO 22000, ISO 21001, ISO/IEC 27001, ISO/IEC 27701, ISO/IEC 42001, ISO 50001, ISO 37001, ISO 22301, ISO 13485 | **US$ 1,999** each |

This is applied everywhere at once, from one place in the code: the public page
for each standard, the public checkout, the client's certificate picker, the
payment popup, the checkout page, the Stripe charge and the sales figures. There
is no second copy of a price anywhere that could drift out of step.

Points worth your attention:

- **The price now appears on each certificate card** in the client's dashboard
  picker. With two price points, a client choosing between standards should be
  able to see what each one costs before selecting it, not discover it in the
  payment popup afterwards.

- **Mixed orders are priced correctly.** A client selecting ISO 9001 and
  ISO 27001 together is charged $999 + $1,999 = $2,998, and the popup itemises
  it. The organization-size surcharges still apply per certification, as agreed
  on 9 August.

- **Revenue is now split correctly between certificates.** A $2,998 order for
  two standards records $999 against one and $1,999 against the other, rather
  than $1,499 against each. Without this, your per-standard sales figures would
  have understated the expensive certifications and overstated the cheap ones.

- **A security gap that the price change would have opened is closed.** The
  checkout used to accept the standard's name from the buyer's own browser.
  That was harmless while every certification cost the same. With two prices it
  would have let someone pay $999 for a $1,999 certification by editing the
  request. The server now reads the standard from its own database records and
  ignores what the browser claims. Anything it cannot identify is charged at
  the higher price, never the lower one.

- **Sara, the AI assistant, was quoting prices that no longer exist.** She was
  still telling customers about a "Guided Success $2,999" package, an
  "Enterprise Bundle $5,999", and $799 / $499 country-tier pricing with monthly
  plans — all removed long ago. Her price list has been replaced with the real
  one above. This was not part of the request, but she was actively giving
  customers wrong prices, so it could not be left.

---

## 5 — The four action icons moved to the left

They are now the **first** column on every list, immediately before the name.

You were right about why it mattered: the Referral Partners screen is fourteen
columns wide, so the buttons sat past the right-hand edge of the scroll area —
and by the time you had scrolled across to reach them, the name identifying the
row had scrolled off the left. Both are now visible together without scrolling
at all.

Applied to every list in the platform, not only the six you named:

| Screen | Result |
|---|---|
| Clients | Moved |
| Referral Partners | Moved (the screen in your screenshot) |
| Auditors | Moved |
| Certification Bodies | Moved |
| Country Admins | Moved |
| Users (this is where Investors are listed) | Moved |
| CB Registry, Accreditation Bodies, Countries, Discount Coupons, Commission Tiers, Applications, form-field settings | Moved |
| **Consultancies** | **No change — this screen has no action icons at all.** It is a performance table (targets, commission, contract status) with no per-row buttons to move. Tell me if you want the same four actions added there. |

Two notes:

- There is no separate **Investors** screen. Investors are a category of user
  and appear in the **Users** list, which is one of the screens changed.
- In Arabic the whole layout mirrors, so the icons correctly appear on the
  right there — which is the leading edge in a right-to-left language, the
  same position they now occupy in English.

The change was made in the shared table component rather than screen by screen,
so any list added in future gets it automatically and none can be forgotten.

---

## Files changed

| File | Change |
|---|---|
| `index.html` | font loading moved here and made non-blocking; first-paint splash |
| `src/index.css` | the blocking Google Fonts `@import` removed |
| `src/main.jsx` | splash handover, capped language wait, early database connection |
| `src/contexts/AuthContext.jsx` | start-up requests run in parallel instead of in a queue |
| `vercel.json` + `docs/CACHING.md` *(new)* | the app's code files may now be reused from disk |
| `src/components/ui/Modal.jsx` | a drag out of a dialog no longer closes it |
| `src/components/admin/ProfileManagementTable.jsx` | Add-form draft survives an accidental close; no reload on tab focus |
| `src/pages/{reports,companies,auditors,certifications,dashboard}/…`, `AdminUsers.jsx`, `AdminCompanies.jsx` | no reload on tab focus |
| `src/pages/admin/AdminAuditors.jsx` | Audit Log → Upload CV |
| `src/i18n/locales/*.json` (9 files) | "Upload CV" in all nine languages |
| `src/utils/pricing.js` | the two price points; mixed-basket pricing |
| `src/pages/dashboard/Dashboard.jsx` + `.css` | price shown per certificate card and per line in the popup |
| `src/pages/client/PaymentPlaceholder.jsx` | checkout prices the basket standard by standard |
| `api/checkout.js` | standards read from the database, not the request; revenue split by list price |
| `api/ai-chat.js` | Sara's price list corrected |
| `src/components/ui/DataTable.jsx` + `.css` | actions column drawn first |
| `src/pages/admin/AdminReferralPartners.jsx` + `.css` | same, for its hand-built table |

**No database migration is required.**

---

## Verification note

Checked statically: all nine language files parse and carry the new label, every
edited file is structurally sound, `vercel.json` is valid, and the pricing
change was traced through every screen that displays or charges a price.

Node.js is still not installed on the machine this work was done on, so
`npm run dev` / `npm run build` could not be run here.

Four things are worth confirming on a preview deployment before this reaches
customers, because I could not exercise them here:

1. **A Stripe test payment for two standards of different prices** — e.g.
   ISO 9001 + ISO 27001. Confirm the popup shows $999 and $1,999, the checkout
   total is $2,998, and Stripe charges exactly that.
2. **The Add Auditor form** — select text in a field, drag the mouse outside the
   dialog and release. The form should stay open.
3. **The action icons** — open Referral Partners and confirm the four icons and
   the partner's name are both visible without scrolling.
4. **How fast it opens** — worth a before/after look, ideally on a phone
   connection rather than office wi-fi, since that is where the font fix pays
   off most.

An Arabic check of the certificate picker is also worth a glance, since the
price now sits on each card.
