# Task Report — 27 August 2026

**Project:** Certify.cx
**Status:** Part 1 and Part 3 of today's request are built, verified and pushed (commit `743ce5e`).
Part 2 — replies coming back into the dashboard — is **not built**, and cannot be until
two questions about your `support@certify.cx` mailbox are answered. Details at the end.

**One step is yours before any of this works: run `supabase/phase32_partner_outreach.sql`.**
Until it runs, the new button is visible and every send fails.

---

## What you asked for

> **1.** Configure and enable all Referral Partners to send emails from their own
> dashboard using `support@certify.cx` as the introductory email with clients
> (new and existing).
>
> **2.** Replies from clients go to the notification dashboard of the referral
> partner + linked Country Admin + Super Admin. The reply is linked to that RP
> and is not shown to other RPs.
>
> **3.** The RP sends the email template + attached file to the leads they have
> added in Certify.cx.

You supplied the sample letter (Phyllis Kungu → University of Embu, ISO 21001)
and a four-page briefing PDF.

**A preview was sent with this report** (`outreach-preview-27aug.html`). It opens
from your Downloads with no internet and shows the real letter — rendered by the
same code the server will run, not a mock-up.

---

## 1 & 3. The partner can now send the letter, with the file attached

A new **Send Proposal** button sits on every lead in the partner's Referrals
page, beside the existing Invite button. Pressing it asks two things:

- **which standard** to propose, and
- **optionally**, a certification the organization already holds.

Then it sends. The email leaves from the Certify.cx domain, carries the WCA
GLOBAL letterhead and the partner's own sign-off, and attaches that standard's
briefing note.

### What is template and what is variable

Your sample is one letter to one university about one standard. Made into a
feature, it splits like this:

| Part of the letter | What happens |
|---|---|
| The organization's name | The lead's company, as the partner entered it |
| "commend you on ISO 9001" | **Optional.** Only appears if the partner names a certification they hold |
| "ISO 21001 – Educational Organizations Management Systems" | Whichever standard the partner picks |
| The paragraph describing the standard | That standard's own — twelve written, one per standard |
| Phyllis Kungu's sign-off | **Each partner's own**, from the signature they already save on their profile |
| WCA GLOBAL identity and taglines | Fixed, exactly as you wrote it |

**Your ISO 21001 paragraph is used word for word.** The other eleven were written
to match its sentence shape ("*X is specifically designed for … and provides a
framework for …*"), so a partner pitching ISO 45001 sends a letter that reads as
though it came from the same pen rather than from a different template.

### Why the congratulations line had to become optional

The sample opens by commending the reader on their ISO 9001. That is true of the
University of Embu and untrue of most leads. An opening line congratulating
someone on something they never did is worse than no opening line, so it appears
only when the partner fills that field in. Both versions are in the preview.

### The attachment — the part that could not be hard-coded

You supplied one PDF, for ISO 21001. Attaching it to an ISO 45001 proposal would
have been worse than attaching nothing.

So documents are looked up **by standard**, from a library you control. There is
a new Super Admin screen — **Briefing Documents** in the sidebar — showing all
twelve standards with an upload button on each. It deliberately shows the empty
ones too: the gaps are the point, and a list that hid them would look complete
when it is not.

A standard with no document **still sends the letter** — just without an
attachment, and without the sentence claiming one. That sentence is driven by
whether the file is actually in hand, so the letter can never say "please find
attached" over an email that carries nothing.

**Upload your ISO 21001 PDF on that screen once the migration has run.** Until
you do, ISO 21001 proposals go out unattached.

### The link goes to Certify.cx, not to wca-global.com

Your sample ends *"Kindly click on the link shared for more details about us —
wca-global.com"*. That link reaches a brochure site with nothing to buy.

The letter's main button now goes to **the standard's own page on Certify.cx** —
where the price is, and the payment gateway — carrying the sending partner's
referral code, so a sale that starts from this letter is credited to them. The
wca-global.com link is still there, lower down, because your copy asks for it.

**Say the word if you want that reversed** — it is one line.

### A bug this uncovered, which would have cost partners their commission

`?ref=` was only ever read on the checkout and signup pages. A visitor who landed
on `/iso/iso-21001?ref=PARTNERCODE` and pressed **Get Started** arrived at
checkout with the code stripped — and the partner who sent them credited with
nothing.

Nothing linked to `/iso/:slug?ref=` until this letter did, which is why it never
surfaced. It would have started silently losing every sale this feature produced,
from the first send. Fixed.

---

## 2. Replies back into the dashboard — not built, and here is exactly why

This is the hard half and it is blocked on you, not on me.

Right now the letter's **Reply-To is the partner's own email address**, so no
reply is lost — it simply lands in the partner's inbox instead of the dashboard.

To bring replies inside, Certify.cx has to start **receiving** mail, which it has
never done. That needs an **MX record on `certify.cx`** — and that is where the
risk sits:

> **Where does `support@certify.cx` deliver today?**
> If it reaches a real mailbox that someone reads, pointing it at the platform
> can break your existing support mail. I will not touch it on a guess.

**The safe version, and my recommendation:** leave `support@` alone. Use a
separate address for replies — `partners@certify.cx` or `reply@certify.cx` —
while the letter continues to *display* `support@certify.cx`. The client sees no
difference and your support mailbox is never at risk.

Once that is settled, the rest is roughly **2–3 days**: a unique reply address
per send (so a reply maps to exactly one partner and one lead — matching on the
sender's address fails the moment they reply from a different one), a table for
the messages, security rules so no other partner can see them, notifications to
the three recipients, and the inbox screen itself.

**Two answers and I can start:** where `support@` delivers today, and who controls
the `certify.cx` DNS.

---

## A risk worth naming before volume picks up

These are **cold sales emails** to people who never contacted you. Sent at volume
from `certify.cx`, spam complaints damage that domain's reputation — and the same
domain carries **account verification and password resets**. The failure mode is
new customers being unable to log in, and it is not obviously connected to its
cause when it happens.

The existing daily send caps bound it, and both partner letters now share **one**
pair of caps rather than one each — counting them separately would have handed
every partner two independent allowances over the same domain.

The real fix is a separate subdomain for outreach, kept away from the mail that
matters. That is a small change and I can do it whenever you want; it just needs
the same DNS access as the point above.

---

## Also decided, and reversible

**The letterhead is WCA GLOBAL, as your sample was** — but the footer says
*"Sent via Certify.cx on behalf of WCA GLOBAL™"*. The mail leaves the certify.cx
domain, and concealing that is what gets a domain reported instead of replied to.
If you would rather the letter were Certify.cx-branded throughout, that is one
file to change.

---

## Files changed

| File | Change |
|---|---|
| `supabase/phase32_partner_outreach.sql` | **New** — the document library, the private bucket, two columns on the send log |
| `api/_outreachCopy.js` | **New** — the WCA identity and the twelve per-standard paragraphs |
| `api/_emailTemplates.js` | The letter itself; the shared layout now accepts a different letterhead |
| `api/outreach-assets.js` | **New** — Super Admin upload / replace / remove, PDF only, 3 MB cap |
| `api/referrals.js` | The `send-outreach` action; both letters now share one pair of send caps |
| `src/pages/admin/AdminOutreachDocs.jsx` + `.css` | **New** — the Briefing Documents screen |
| `src/pages/referrals/Referrals.jsx` + `.css` | The Send Proposal button and its composer |
| `src/components/pricing/PricingTiers.jsx` | **Bug fixed** — `?ref=` now survives the hop to checkout |
| `src/App.jsx`, `src/components/layout/Sidebar.jsx` | The new admin route and its sidebar entry |
| `public/wca-global-mark.png` | The WCA logo from your email, trimmed and scaled (24 KB) |
| `src/i18n/locales/*.json` (9 files) | 30 new strings, in all nine languages |

---

## Verification

Unlike the last few reports, **this machine now has Node.js installed**, so these
are real runs rather than static checks:

- **The production build passes** (`vite build`, 23s, no errors).
- **ESLint is clean** on every file added or changed today.
- **Every API module imports successfully in Node** — including `api/checkout.js`,
  which shares code with the files touched today. A broken import there would
  take the whole payment endpoint down on Vercel.
- **All nine language files parse**, and all 30 new strings are present in every
  one of them. No key falls back to English.
- **Every translation key** used by the new screens resolves against the English
  file — no missing-string placeholders.
- **The letter was rendered and read**, in both variants (with and without the
  prior certification, with and without an attachment). That is what the preview
  file contains.
- The partner-typed organization name is escaped everywhere it enters HTML.

**Not checked here:** the migration has not been run, so no live send has
happened. What needs your eyes after deploy:

1. Run `supabase/phase32_partner_outreach.sql`.
2. Open **Briefing Documents** in the sidebar and upload the ISO 21001 PDF.
3. Open a referral partner's Referrals page, press **Send Proposal** on a lead you
   control, choose ISO 21001, and check the email arrives **with the PDF attached**.
4. Press the button in that email and confirm you land on the ISO 21001 page with
   the price, and that the URL still carries `?ref=`.
5. Try a standard with no document uploaded — the letter should arrive with no
   attachment and no mention of one.

---

## Still open from earlier

None of it affected by today's work — listed so nothing is lost:

- **`supabase/phase31_checkout_org_size.sql`** from 16 Aug, if it has not been run.
- **The eight Compliance Audit prices** from 22 Aug. All eight are still live at
  $1,999, which is a placeholder.
- **The two pricing tables** still disagree — the landing calculator and the
  checkout quote different surcharges for the same company size.
- **The trademark question** on the six third-party marks now sitting beside a
  price and a payment button.
- **27 missing `certBody.*` strings** in German, French, Hindi, Portuguese,
  Russian and Chinese. Those screens fall back to English; nothing is broken.
- **The referral-partner and client registration testing** you asked for before
  the Compliance Audits task came in — still not started.
