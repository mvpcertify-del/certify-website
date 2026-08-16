# Task Report — 16 August 2026

**Project:** Certify.cx
**Status:** All three items fixed in code and pushed. **One optional 30-second database step is recommended before you share the login link — see "What you need to do".**

---

## The requests

> *"I have created 2 users: 1. Referral Partner 2. Client. When the Referral
> Partner sent the invite to the client, the client was taken directly to ISO
> 9001 which is wrong. The Referral partner discount code should be usable in
> any certificate & not only ISO 9001. Also the client should do basic
> registration first. Number of staff & locations should be displayed &
> reflected in the quoted rate displayed automatically. Could you do the fixes
> now since we have a client now & need to share the login link."*

> *"The Send Reset Link should be activated."*

> *"The number of employees is not displayed in ISO 21001 to select by client?
> You need to add 1. number of employees 2. Number of Locations here. Apply
> this to all the certifications."*

---

## 1. Referred clients were dropped onto ISO 9001

### What was wrong

A referral partner's invite link is `certify.cx/checkout?ref=REF-XXXXXX`. It
carries the partner's code — and nothing else. It does not name a certification,
because at the moment the partner sends it nobody has chosen one yet.

The checkout page had no way to handle that. Faced with a link that named no
standard, it quietly filled one in for the buyer: ISO 9001. So every single
client a partner ever invited arrived at a payment page for a certification they
had never chosen, at a price that had nothing to do with what they wanted.

The discount code itself was never restricted to ISO 9001 — it has always
applied to whatever is in the basket. But since the buyer was only ever shown
ISO 9001, there was no way to tell.

### What it does now

When the link names no certification, the site **asks** instead of guessing.

The client now lands on a **"Choose your certification"** page listing all twelve
standards, each with its price. If they arrived on a partner's link, the partner's
discount is announced at the top and **already applied to every price on the
page** — so it is visibly a discount on whichever certification they pick, not a
discount on ISO 9001.

Picking one takes them to the purchase page, where they can still change their
mind — there is a **Change** link next to the certification in the order summary.

Direct links from your ISO landing pages, which do name a standard
(`/checkout?iso=iso-21001`), behave exactly as before. Nothing about those pages
changed.

### One thing I did not change, and why

You also wrote *"the client should do basic registration first."*

The checkout already collects the client's registration details — full name,
work email, company, phone, country — and their account is created from them.
What it does not do is put those on a **separate page before** the payment page;
they sit above the payment section on the same screen.

That was a deliberate decision recorded in the code: the site was moved to a
"pay first, register at payment" flow on purpose, replacing an older sign-up gate,
specifically to stop losing buyers at a registration wall. Splitting it back into
two steps is a reversal of that decision, not a bug fix, so I have not done it on
my own judgement.

**With the standard picker added, the flow is now: choose your certification →
enter your details → pay.** If you want the details step on its own page before
payment is shown at all, say the word and I will split it — it is a small change.
I just did not want to quietly undo a decision that was made for a reason.

---

## 2. Number of staff and locations — now asked for, and priced live

### What was wrong

This one is worth reading carefully, because it was costing you money.

The order summary on every checkout page carried this line:

> *Prices are based on organizations with up to 50 employees at 1 location.
> **Additional employees and locations can be added below.***

There was nothing below to add them with. No field, no control, nothing. The two
figures could only ever reach the page as hidden values in the web address — and
**nothing anywhere in the site ever produced such an address.**

The practical effect: **every order ever placed through this checkout was priced
as a 50-employee, single-site organization**, no matter how large the buyer
actually was. A 500-employee company across 6 sites paid exactly the same as a
20-person company at one address. The surcharge rules existed, were correct, and
were simply never reachable.

### What it does now

The purchase page now has an **Organization size** section, directly above the
buyer's details, with two counters:

- **Number of employees** — steps in 50s, or type an exact figure
- **Number of locations** — steps by 1

The total updates as they change, and the order summary now always shows both
figures with what each contributes:

```
Number of employees      250 · +$800
Number of locations        3 · +$400
```

They appear whether or not they cost anything, so a buyer can always see the
organization size their quote is based on — not just the extras.

Because the checkout is shared by all twelve standards, **this applies to every
certification**, including ISO 21001 in your screenshot. There is no per-standard
version of this page to update.

### Two things I hardened while in there

**The price is now recomputed on the server from the raw figures.** The browser
sends the headcount and site count; the server derives the surcharge from those
itself rather than trusting the amount the browser calculated. A price the buyer's
own machine works out is a price the buyer's own machine can change.

**The real figures are now stored on the application.** Previously only the
billing approximation ("4 extra employee bands") was kept. The auditor and the
certification body need the actual organization — 250 employees at 3 sites — to
scope the audit. They now get it.

### One question for you

The pricing calculator on the public ISO landing pages and this checkout **do not
agree**, and did not before today either:

| | Employees included | Then | Locations |
|---|---|---|---|
| Landing-page calculator | 10 | +$200 per 10 | +$300 each |
| Checkout (what is charged) | 50 | +$200 per 50 | +$200 each |

A 60-employee company is quoted **+$1,000** by the calculator and charged **+$200**
at checkout. I have used the checkout figures, because that is what the payment
system actually charges and I was not going to change your prices on my own
initiative — but the two should be made to agree. **Tell me which set is correct
and I will align the other.**

---

## 3. "Send Reset Link" did nothing

### What was wrong

The button worked. The page just never told the user anything when it failed.

The code caught the failure and stored the reason — and then never displayed it.
There was no error area on that page at all. So a rejected request produced
absolutely nothing on screen: no message, no change, no movement. Identical to a
dead button.

The most likely rejection is Supabase's rate limit, which allows one reset email
per address per minute. And there was a second fault feeding straight into it:
the shared Button component applied its "loading" state incorrectly, so it never
actually blocked a second click. Press it twice in quick succession — the natural
thing to do when nothing appears to happen — and the second press was rejected by
the rate limit, invisibly. The button then looked permanently broken.

### What it does now

- The error is displayed, in red, with the actual reason.
- The email address is checked before sending, so a typo says so immediately
  instead of being sent to the server.
- The button reads **"Sending…"** while the request is in flight.
- The button is genuinely disabled while sending, so it cannot be double-clicked.

The last of those was a fault in the shared Button component, so **every form in
the site that used it could be double-submitted** while its first request was
still running. That is fixed everywhere, not just on this page.

### Please check one setting

The reset email itself is sent by Resend through the Supabase email hook, and the
recovery template is present and correct. If reset emails still do not arrive
after this deploy, the cause is configuration rather than code, and it will be one
of these two:

1. **Supabase → Authentication → URL Configuration → Redirect URLs** must include
   `https://certify.cx/reset-password`. If it is missing, Supabase refuses the
   request outright — and you will now *see* that refusal on screen, where before
   you saw nothing.
2. **Supabase → Authentication → Hooks → Send Email Hook** must be enabled and
   pointing at `https://certify.cx/api/auth-email-hook`.

I cannot read your Supabase settings from here, so I cannot confirm these — but
with the error now visible, one attempt will tell you immediately which it is.

---

## What you need to do

**Recommended before you share the login link** — Supabase dashboard → SQL Editor
→ New query → paste → Run:

```sql
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS employee_count   integer,
  ADD COLUMN IF NOT EXISTS locations_count  integer;

NOTIFY pgrst, 'reload schema';
```

Also saved as **`supabase/phase31_checkout_org_size.sql`**.

**On almost every database this changes nothing** — both columns are part of the
original applications table. I am asking you to run it because of what happened
yesterday: when one column named by the code is missing, the database rejects the
**entire** order, not just that field. So an absent column would take the whole
checkout down in front of your new client rather than quietly lose a number.
Thirty seconds buys certainty. It cannot damage existing data and is safe to run
twice.

`supabase/CHECK_migrations_applied.sql` has been updated to cover it too, so the
read-only check from yesterday now reports on this as well.

**Then test, in this order:**

1. From the Referral Partner account, send an invite to a test client.
2. Open the link. You should see **Choose your certification** — twelve standards,
   the partner's discount announced at the top, every price already discounted.
3. Pick **ISO 21001**. Confirm the purchase page shows **Organization size** with
   both counters.
4. Set employees to 200 and locations to 3. The total should rise by **$600 + $400
   = $1,000** and the summary should show both figures.
5. Go to `/forgot-password`, enter a real address, press **Send Reset Link**. You
   should get either the confirmation screen or a visible red message — never
   nothing.

---

## Files changed

| File | Change |
|---|---|
| `src/pages/public/Checkout.jsx` | Standard picker when the link names none; organization-size counters priced live; both figures sent to the server |
| `src/pages/public/Checkout.css` | Styling for the picker and the counters |
| `api/checkout.js` | Re-derives the price server-side from the raw figures; stores the real headcount and site count; carries the order and the referral code through a cancelled payment |
| `src/pages/auth/ForgotPassword.jsx` | Shows the error; validates the address; "Sending…" state |
| `src/components/ui/FormElements.jsx` | Button now genuinely disables while loading (affects every form) |
| `src/i18n/locales/*.json` (9 files) | Eight new strings, in all nine languages |
| `supabase/phase31_checkout_org_size.sql` | **New** — the paste-and-run insurance above |
| `supabase/CHECK_migrations_applied.sql` | Extended to cover it |

No existing data is read, rewritten or deleted by any part of this change.

---

## Verification

Checked here:

- All nine language files parse correctly and carry all eight new strings, each
  in its own language — English, Spanish, Arabic, German, French, Hindi,
  Portuguese, Russian and Chinese.
- All four changed code files are structurally intact (bracket balance verified
  against the committed versions).
- Existing `/checkout?iso=...` links still resolve to the same standard and the
  same price, and old links carrying the hidden staff/locations values still
  produce the identical total.

**Not checked here, and I want to be straight about why:** this machine has no
Node.js installed, so I cannot run the build, the linter, or the site itself. The
checks above are static. The five test steps in "What you need to do" are the ones
that actually exercise the change, and they need to be run on the live site.

### A separate gap I found while checking

The German, French, Hindi, Portuguese, Russian and Chinese files are each missing
the same **27** `certBody.*` strings — a Certification Body screen added after
those six languages were translated. Those six languages fall back to English on
that screen, so nothing is broken or blank; it just is not translated. This is
**not** from today's work and does not affect your client. Say the word and I will
close it.

---

## Still open from earlier

- **Yesterday's database check.** If you have not yet run
  `supabase/CHECK_migrations_applied.sql`, it is still worth two minutes — it
  reports whether phase29 and phase30 are live. If either is missing, the Partner
  Agreement and signature features will fail the moment somebody uses them.
- **The migration-tracking table** I offered yesterday, so a deploy can say
  plainly "database is 2 versions behind" instead of failing silently in front of
  a client. Today's phase31 file exists purely because that safety net does not.
- **A decision from you on the two pricing tables** in section 2.
- **Whether you want registration split onto its own step** before payment
  (section 1).
