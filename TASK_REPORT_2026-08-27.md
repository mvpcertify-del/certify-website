# Task Report — 27 August 2026

**Project:** Certify.cx
**Status:** All three points of today's request are built, verified and pushed.
Commits `743ce5e` (send the letter) and `e0decd7` (route the replies back).

**Two steps are yours before any of it works — both listed under "What you must do".**
Neither is code; one is a database script, the other is a single DNS record.

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
and a four-page briefing PDF. **All three are done.**

A preview was sent with this report (`outreach-preview-27aug.html`). It opens
from your Downloads with no internet and shows the real letter — rendered by the
same code the server runs, not a mock-up.

---

# Part 1 & 3 — the partner sends the letter, with the file attached

A **Send Proposal** button now sits on every lead in the partner's Referrals
page, beside the existing Invite button. It asks two things:

- **which standard** to propose, and
- **optionally**, a certification the organization already holds.

Then it sends — from `support@certify.cx`, with the WCA GLOBAL letterhead, the
partner's own sign-off, and that standard's briefing note attached.

### What is template and what is variable

Your sample is one letter, to one university, about one standard. Made into a
feature it splits like this:

| Part of the letter | What happens |
|---|---|
| The organization's name | The lead's company, as the partner entered it |
| "commend you on ISO 9001" | **Optional.** Only appears if the partner names a certification they hold |
| "ISO 21001 – Educational Organizations Management Systems" | Whichever standard the partner picks |
| The paragraph describing the standard | That standard's own — twelve written, one per standard |
| Phyllis Kungu's sign-off | **Each partner's own**, from the signature they already save on their profile |
| WCA GLOBAL identity and taglines | Fixed, exactly as you wrote it |

**Your ISO 21001 paragraph is used word for word.** The other eleven were written
to match its sentence shape, so a partner pitching ISO 45001 sends a letter that
reads as though it came from the same pen rather than from a different template.

### Why the congratulations line had to become optional

The sample opens by commending the reader on their ISO 9001 — true of the
University of Embu, untrue of most leads. An opening line congratulating someone
on something they never did is worse than no opening line, so it appears only
when the partner fills that field in. Both versions are in the preview.

### The attachment — the part that could not be hard-coded

You supplied one PDF, for ISO 21001. Attaching it to an ISO 45001 proposal would
have been worse than attaching nothing.

So documents are looked up **by standard**, from a library you control. There is
a new Super Admin screen — **Briefing Documents** in the sidebar — listing all
twelve standards with an upload button on each. It deliberately shows the empty
ones too: the gaps are the point, and a list that hid them would look complete
when it is not.

A standard with no document **still sends the letter** — without an attachment,
and without the sentence claiming one. That sentence is driven by whether the
file is actually in hand, so the letter can never say "please find attached" over
an email carrying nothing.

### The link goes to Certify.cx, not to wca-global.com

Your sample ends *"Kindly click on the link shared for more details about us —
wca-global.com"*, which reaches a brochure site with nothing to buy.

The letter's main button now goes to **the standard's own page on Certify.cx** —
where the price and the payment gateway are — carrying the sending partner's
referral code, so a sale that starts from this letter is credited to them. The
wca-global.com link is still there, lower down, because your copy asks for it.
Say the word if you want that reversed; it is one line.

---

# Part 2 — the client's reply comes back into the dashboard

This is the half that needed a decision from you. **It is built, and built in a
way that does not need the decision** — explained below.

When a client replies, three things happen:

1. The reply appears in a new **Messages** screen in the partner's dashboard.
2. The partner gets an in-app notification and an email.
3. **The Country Admin for that partner's region, and every Super Admin,** get
   the same notification.

The partner can reply straight from the dashboard, and the client's answer to
*that* comes back to the same place.

### How a reply finds the right partner

Every conversation carries a random token, and that token goes into the address
the letter asks for replies at. So the **address** identifies the thread — not
the sender.

That distinction is the whole feature. Matching on the sender's email address
fails the moment a lead replies from a different mailbox to the one written to —
a personal address, a shared inbox, a colleague they forwarded it to. And it
breaks outright when the **same company is a lead of two different partners**,
where the sender identifies the company but not whose thread it belongs to.
That is precisely the case your *"will not be displayed to other RPs"* is about.
A token has exactly one owner and cannot be ambiguous.

### Your `support@certify.cx` mailbox is not touched

I asked last time where `support@certify.cx` delivers today, because receiving
mail means pointing an MX record somewhere and I would not guess with your
support mail.

**You do not need to answer.** The reply address lives on a **subdomain** —
`reply.certify.cx` — which has its own MX record and cannot affect `certify.cx`
at all. Wherever `support@certify.cx` goes today, it keeps going there.

The reader still sees `support@certify.cx`. Only the machine-readable Reply-To
differs, and no recipient ever looks at that.

### Who can see a thread

The owning partner, their Country Admin, and Super Admin. **Nobody else — and
expressly not another referral partner.**

That rule is enforced **in the database**, not in the page. The inbox screen
queries without any filter of its own, on purpose: writing the rule a second time
in JavaScript means two copies, and the copy that quietly stops matching is the
one nobody notices. Neither table accepts writes from a browser at all — every
write runs through the server. A partner who could edit a conversation row could
hand a thread to another partner by rewriting one field, which is the one thing
you asked to prevent.

### A bug this uncovered

You named the **Country Admin** as someone who must see these replies. But in the
platform's permission table, a regional admin does **not** hold the referral
permission. Gating the Messages page on it would have locked the Country Admin
out of the very inbox you named them for — while the database happily returned
their region's threads to a page they could never open. Gated by role instead.

---

## Two more fixes made on the way through

**The sender was wrong.** Point 1 asked for `support@certify.cx`. Both partner
letters were going out as the generic `noreply` address. Now both use the support
identity.

**`?ref=` was being dropped, and would have cost partners their commission.**
The code was only read on the checkout and signup pages. A visitor landing on
`/iso/iso-21001?ref=PARTNERCODE` and pressing **Get Started** arrived at checkout
with the code stripped, and the partner credited with nothing. Nothing linked to
that URL until this letter did — it would have started silently losing every sale
this feature produced, from the first send. Fixed.

---

## A risk worth naming before volume picks up

These are **cold sales emails** to people who never contacted you. Sent at volume
from `certify.cx`, spam complaints damage that domain's reputation — and the same
domain carries **account verification and password resets**. The failure mode is
new customers unable to log in, and it does not look connected to its cause when
it happens.

Daily send caps bound it, and both partner letters now share **one** pair of caps
rather than one each — counting them separately would have handed every partner
two independent allowances over the same domain.

The real fix is a separate subdomain for outreach, kept away from the mail that
matters. Small change, same DNS access as the record below. Say the word.

---

## What you must do

**1. Run two database scripts** (Supabase → SQL Editor). Both are safe to re-run.

- `supabase/phase32_partner_outreach.sql`
- `supabase/phase33_partner_inbox.sql`

Until the first runs, the Send Proposal button is visible and every send fails.
Until the second runs, the Messages screen cannot load.

**2. Upload the ISO 21001 PDF.** Sidebar → **Briefing Documents**. Until then,
ISO 21001 proposals go out unattached.

**3. Add one DNS record**, to turn replies on:

- An **MX record on `reply.certify.cx`** pointing at the inbound mail provider
  (Resend Inbound is the natural choice — you already send through Resend).
- Point the provider's inbound webhook at `https://certify.cx/api/inbound-email`.
- Set two environment variables in Vercel:
  `INBOUND_REPLY_DOMAIN=reply.certify.cx` and `INBOUND_WEBHOOK_SECRET=<the
  provider's signing secret>`.

**Everything except step 3 works without step 3.** Until that record exists, the
letters still send exactly as described, and replies go to the partner's own
mailbox as they do today. Nothing is lost while you arrange it. All of it is
documented in `.env.example`.

---

## Files changed

| File | Change |
|---|---|
| `supabase/phase32_partner_outreach.sql` | **New** — briefing-document library, private bucket, two columns on the send log |
| `supabase/phase33_partner_inbox.sql` | **New** — conversations, messages, and the one shared visibility rule |
| `api/_outreachCopy.js` | **New** — the WCA identity and the twelve per-standard paragraphs |
| `api/_replyAddress.js` | **New** — the per-thread reply address and the token parser |
| `api/_conversations.js` | **New** — open a thread, file a message |
| `api/inbound-email.js` | **New** — the signed webhook that receives a reply |
| `api/partner-messages.js` | **New** — mark read, and reply from the dashboard |
| `api/outreach-assets.js` | **New** — Super Admin upload / replace / remove, PDF only, 3 MB cap |
| `api/_emailTemplates.js` | The proposal letter and the reply letter |
| `api/_resendClient.js` | Can now set a Reply-To |
| `api/referrals.js` | `send-outreach`; both letters share one pair of caps, send from support@, and open a thread |
| `src/pages/messages/Messages.jsx` + `.css` | **New** — the inbox |
| `src/pages/admin/AdminOutreachDocs.jsx` + `.css` | **New** — the Briefing Documents screen |
| `src/pages/referrals/Referrals.jsx` + `.css` | Send Proposal button and its composer |
| `src/components/pricing/PricingTiers.jsx` | **Bug fixed** — `?ref=` survives the hop to checkout |
| `src/App.jsx`, `src/components/layout/Sidebar.jsx` | Two new routes and their sidebar entries |
| `public/wca-global-mark.png` | The WCA logo from your email, trimmed and scaled (24 KB) |
| `src/i18n/locales/*.json` (9 files) | 45 new strings, in all nine languages |
| `.env.example` | The inbound-email setup, documented |

---

## Verification

This machine now has Node.js installed, so these are real runs, not static checks.
(Earlier reports said the opposite and were right at the time; that has changed.)

- **The production build passes** — twice, once per commit.
- **ESLint is clean** on every file added or changed today.
- **Every API module imports successfully in Node**, including `api/checkout.js`,
  which shares code with the files touched. A broken import there takes the whole
  payment endpoint down on Vercel.
- **The reply-address routing is unit-tested — 17 assertions, all passing.**
  Token generated → address built → token recovered, across both address formats
  and every shape a mail provider hands a recipient back in: a bare string, an
  object, an array, a display name in angle brackets, an address uppercased in
  transit, a comma-separated list, and the address arriving in Cc instead of To.
  Plus 2,000 generated tokens checked for collisions, and unrelated addresses
  confirmed to return nothing.
- **The webhook signature check is tested — 4 assertions, all passing.** Both
  header spellings verify; a tampered body and a wrong secret are both rejected.
- **All nine language files parse**, and all 45 new strings are present in every
  one. No key falls back to English.
- **Every translation key** used by the new screens resolves against the English
  file.
- **The letter was rendered and read**, in both variants — with and without the
  prior certification, with and without an attachment. That is the preview file.
- Partner-typed text is escaped everywhere it enters HTML; inbound message bodies
  are stored and rendered as plain text only.

**Not verified here, and I want to be straight about it:** no migration has been
run and no live email has been sent or received from this machine. What needs
your eyes after deploy:

1. Run both migrations.
2. Upload the ISO 21001 PDF under **Briefing Documents**.
3. Press **Send Proposal** on a lead you control, choose ISO 21001, and check the
   email arrives **from support@certify.cx with the PDF attached**.
4. Press the button in that email — you should land on the ISO 21001 page with
   the price, and the URL should still carry `?ref=`.
5. Try a standard with no document — the letter should arrive with no attachment
   and no mention of one.
6. After the DNS record is live: reply to that email, then check the **Messages**
   screen, the partner's notifications, and a Country Admin's notifications.
7. Sign in as a *different* referral partner and confirm the thread is not there.

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
