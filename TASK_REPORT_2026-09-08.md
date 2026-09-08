# Task Report — 8 September 2026

Your message of 7 September, plus a finding that explains most of it.

---

## Read this first: the work was not live

Sharon logged in and saw an empty page. That is real, and I am not going to
explain it away — but the cause is not the code.

**The website has not been updated since before 1 September.** Three finished,
tested, pushed pieces of work have never reached a single user:

| Pushed | What it was |
|---|---|
| 1 Sep | Arabic showing English, and the menu covering the page |
| 2 Sep | The two task reports |
| 6 Sep | Edit Signature removed, First/Last name split, Referral Program Dashboard |

I checked the live site directly rather than assuming. The JavaScript being
served to Sharon still contains the "Edit Signature" button we removed, and the
stylesheet still contains the broken right-to-left rules we deleted on
1 September — including the `dashboard-layout__main` class that does not exist
anywhere in the project any more.

So when Sharon says the ready email template is not there, she is right. **It
was built on 6 September, pushed the same day, and never deployed.** She was
looking at a version of the site from before any of it existed.

### What I need you to check

The code is on GitHub. `main` is correct and current. The break is between
GitHub and the live site — Vercel is not picking up new commits.

Please look at the Vercel project and check, in this order:

1. **Is the project still connected to the GitHub repository?** (Settings → Git)
2. **Is the Production Branch set to `main`?**
3. **Are there failed deployments in the Deployments list?** If the newest
   deployment is dated 2 September, nothing has even been attempted since.
4. **Is auto-deploy paused?** Vercel has a per-project switch for this.

The build itself is not the problem — it compiles cleanly here every time. Tell
me what the Deployments list says and I will take it from there.

**Until that is fixed, nothing in this report — or the last two — is visible to
anyone.** That is the single most important thing on this page.

---

## 1. "The Referral Partner can't access the ready email template & company profile"

Two separate causes, both now dealt with.

**The ready email template** existed but was not deployed (above). It is on the
partner's dashboard and, from today, also has its own permanent entry in their
sidebar — because Sharon was looking at the sidebar, and a landing page you have
to know to navigate back to is not discoverable.

**The company profile genuinely did not exist.** It was asked for on 27 July,
and what was actually built was a single optional link that reads an
environment variable which has never been set — so the row was silently dropped
from every email ever sent. There was no file store for it, no upload screen,
and no way for a partner to attach it. That is now built (see below).

---

## 2. The Referral Program Dashboard — seven boxes

Rebuilt to your list, in your order.

| # | Box | Shows | Opens |
|---|---|---|---|
| 1 | **Training** | how many walkthroughs | tutorials |
| 2 | **Clients** | how many you added | add a client, send invites |
| 3 | **Sales Generated** | what your clients paid | the ledger |
| 4 | **Credit Earned** | your commission | the same ledger |
| 5 | **Marketing Tools** | how many documents | the tick-and-send composer |
| 6 | **Auto Proposal** | how many leads to write to | the same composer |
| 7 | **Notifications** | unread of total | the notifications list |

Training is first, as you asked.

Two pairs of boxes open one screen each, and I want to be straight about why
rather than have you find it. **Sales Generated and Credit Earned** are two
different numbers — what the client paid, and your cut of it — but one subject,
so they open one ledger that shows both. **Marketing Tools and Auto Proposal**
are, reading your message closely, one action described twice: choose a
standard, tick what goes with the letter, send it with the discount code
inside. Building two composers would mean two to keep in step, and they would
drift. If you want them genuinely separated, say so and I will split them.

---

## 3. Marketing Tools — the three items, ticked and sent

> *"For example if ISO 9001 is selected to send to client so the above 3 items
> will be available & just to be ticked & system will send directly"*

This is built and works exactly that way. The partner picks a client, picks a
standard, and sees three items:

| | Item | Behaviour |
|---|---|---|
| 1 | **Ready email template** | Always included, ticked and locked — it *is* the letter |
| 2 | **Company Profile** | Tick to attach. Greyed out until the PDF is uploaded |
| 3 | **ISO standard brochure** | Tick to attach. Follows whichever standard is chosen |

Then one button sends it. Nothing is typed, nothing is attached by hand.

**The proposal now carries the partner's discount code**, which you asked for
and which it did not do before. Only the invitation letter did. So a cold lead
who read a proposal and then bought was credited to nobody.

Below the composer is the library itself — every document, downloadable, so a
partner can read what they are about to send before they send it.

### Three things I was careful about

**The letter can never lie about its own contents.** It names an attachment
only when the file's bytes are actually in hand. If the company profile is
deleted between the partner ticking it and the letter going out, the letter
simply does not mention it — rather than telling a stranger to "see the
attached company profile" over an email with nothing attached. I wrote sixteen
assertions against the letter to prove this holds for zero, one and two
attachments; all pass.

**Two PDFs can be too big to email.** Mail servers commonly bounce anything
over 10 MB, and a bounce is invisible to the sender — they see "Sent" and hear
nothing back, ever. So the size is checked before sending and refused with a
message that says what to do, rather than failing silently a day later.

**A partner awaiting approval is now told so.** The server has always refused
sends from an unapproved partner. The screen never said. So an unapproved
partner would compose a whole letter, press send, and get "Forbidden" — which
from the outside looks exactly like "the partner can't access it".

---

## 4. Training

A new first box. Six walkthroughs covering what a partner actually does:
getting started, adding a client, sending the invitation, sending a proposal
with attachments, the discount code and referral link, and commissions and
payouts. Each one expands to numbered steps and ends with a button that opens
the screen it just described.

**These are written guides, not videos**, and that is a deliberate choice I
should flag. There is no video store in this platform — no table, no bucket, no
upload screen. Building one would have meant a database migration, and this
report already explains what happens to work that waits on those. Written into
the product, the training is translated into all nine languages, works the day
it deploys, and a correction is a copy edit rather than a re-recording. If you
want video as well, tell me and I will build the store for it.

---

## 5. "All users' dashboards should be interactive"

You marked four boxes on your own Main Dashboard. I checked all six: every one
of them navigates correctly, the routes exist, and a Super Admin passes every
permission gate. They are not broken.

What I did find, looking wider at what "all users" means:

**The auditor and certification-body dashboards were dead text.** Their tiles
had no click target at all — they were the only role dashboards in the platform
where nothing responded. Now every tile opens that role's work queue.

**The Consultancies count was wrong.** It counted one way while the screen it
opens counted another, so consultancy accounts created before a June change
appeared on the page but were missing from the number. Fixed to match. If that
box now reads higher than it did, that is the correction, not an error.

One thing I could not fix honestly: the auditor's three tiles all open the same
queue, because there is no way to deep-link to a filtered view of it. They are
interactive and they go somewhere useful, but "In Review" does not yet open a
filtered list. That is a real piece of work; say the word.

---

## What you must do for any of this to work

Three things, and I cannot do any of them for you.

1. **Fix the Vercel deployment.** Nothing below matters until this is done.
2. **Upload the Company Profile PDF.** Briefing Documents → the Company Profile
   slot is now the first card on that screen. Until a file is there, the
   company-profile tick stays greyed out for every partner.
3. **Upload the ISO 21001 PDF.** Same screen. Outstanding since 27 August —
   this is the file from your own school/university example, and without it
   that exact scenario sends with no brochure.

None needs a migration. All three are uploads or settings.

---

## Files changed

**Marketing Tools and the company profile**

- `src/pages/referrals/ReferralMarketing.jsx` + `.css` — new, the composer
- `api/_assetSlugs.js` — new, the reserved company-profile key
- `api/outreach-assets.js` — the company profile as a storable document
- `api/referrals.js` — up to two attachments, and the discount code
- `api/_emailTemplates.js` — the proposal letter's attachment copy and code box
- `src/pages/admin/AdminOutreachDocs.jsx` — Company Profile upload slot

**The dashboard**

- `src/pages/referrals/ReferralProgramDashboard.jsx` — seven boxes
- `src/pages/referrals/ReferralCommissions.jsx` — sales alongside credit
- `src/pages/referrals/ReferralTraining.jsx`, `trainingTopics.js` — new
- `src/App.jsx`, `Sidebar.jsx` — routes and menu

**Interactivity**

- `src/pages/dashboard/Dashboard.jsx` — auditor and CB tiles
- `src/pages/dashboard/MainDashboard.jsx` — the Consultancies count

**Languages** — all nine, now 1,743 keys each, still key-for-key identical.

---

## Verification

**Checked, and passing:**

- The production build compiles.
- ESLint: 39 problems, the same 39 as before this work. None new.
- **Sixteen assertions against the proposal letter itself** — zero, one and two
  attachments, the discount code present and absent, HTML escaping, and the
  subject line. All pass. The letter cannot claim an attachment it is not
  carrying.
- **94 new or changed strings resolved in all nine languages** by script, with
  every `{{placeholder}}` intact and no English left in the Arabic.
- All nine language files: no missing keys, no extras, no blanks, no drafts.
- The new partner endpoints reject any role that is not a partner or an admin.
- No route was widened — the new screens sit behind the permission the referral
  pages already used.
- The new stylesheet contains no physical `left`/`right`, so Arabic cannot
  break the way it did in September.

**Not checked, and I want to be straight about it:**

I have not clicked through this in a browser. The local-server problem from
1 September is unchanged. More to the point, **there is no deployed version to
click through** — which is the finding at the top of this report.

**Please look at this after the deployment is fixed:**

1. Sign in as a referral partner — seven boxes, Training first.
2. Open Marketing Tools, pick a client and ISO 9001, and check the three items.
3. Upload the Company Profile, reload, and check its tick is no longer greyed.
4. Send one to yourself and confirm both PDFs arrive and the code is in the body.
5. Open Training and expand a walkthrough.
6. Switch to Arabic and check the seven boxes read right-to-left.
7. As an auditor, click a dashboard tile and confirm it now goes somewhere.

---

## Still open from earlier

- The 27 August partner inbox needs its two migrations, the DNS record and two
  settings.
- `phase34_drop_email_signature.sql` has not been run — old signatures still
  ride along on partner mail.
- `phase31_checkout_org_size.sql` has not been run.
- The eight Compliance Audit prices are all still at the $1,999 placeholder.
- The two surcharge tables still disagree with each other.
- The trademark question on six third-party marks is unanswered.
