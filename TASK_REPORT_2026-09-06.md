# Task Report — 6 September 2026

Five items from your message of this morning. Three were code and are done.
Two were questions about how we work together, answered at the bottom.

---

## 1. "Edit Signature to be DELETED for all types of registrations / for all users (Existing & New)"

**Done.**

The button, the editor behind it, and the server action that saved it are gone.
Partner mail now signs off with the partner's own stored name — the same name
the company already holds on their signed partner agreement.

"Existing" is the half that needed more than a deploy. Every signature typed
before today is still sitting in the database, and it would have kept going out
on partner mail even with the button removed. So there is a migration:

> **`supabase/phase34_drop_email_signature.sql` — please run this.**
> It blanks every stored signature first, then removes the column so no future
> code can bring it back. Safe to run more than once.

Until it is run, the button is gone but old signatures still ride along on
outgoing mail. That is the one thing on this page I cannot finish for you.

While in there, one thing worth saying plainly: this was the only place in the
platform where a partner could type free text that then left the certify.cx
domain under our name. Removing it is a small tightening, not just a tidy-up.

---

## 2. "Share with me today the automation that you have deployed"

Answered in full at the bottom of this report, under **What is live right now**.

---

## 3. "MODIFY & SPLIT IN ALL FORMS: First Name xxxxx  Last Name xxxxx"

**Done — in eleven forms, not one.**

Your arrow pointed at the referral partner's "Add Client" box, but "in all
forms" is the instruction, so every form in the platform that asks for a
person's name now asks for it in two boxes:

| Form | Where |
|---|---|
| Add Client | Referral partner |
| Registration — individual (referral, consultancy, investor) | Public |
| Registration — organization (contact person) | Public |
| Checkout | Public |
| My Profile | Every role |
| Create User | Admin |
| Create Application → new client | Admin |
| Edit Referral Partner | Admin |
| Edit Consultancy | Admin |
| Auditors — add and edit | Admin |
| Certification Bodies, Regional Admins — add and edit | Admin |

It is one shared component, not eleven copies. That matters more than it
sounds: the next form anyone adds gets the same two boxes for free, and there
is one place to change if you ever want the order or the labels different.

**One decision I made, and why.** The two boxes are stored as one name, the
same single name every screen, email, contract and certificate in the platform
already prints. I did not add separate first/last columns to the database.

The reason is risk, not effort. A new database column that a migration has not
created yet causes the whole record to be rejected — which means registration
stops working entirely, silently, for everyone. We have been bitten by exactly
that before. Splitting the storage would also mean touching roughly two hundred
places that read the name today, for no visible gain.

If you want the parts stored separately later — to sort partners by surname, or
to open a mail merge with "Dear John" rather than the full name — that is one
migration and a small change, not a rewrite. Say the word and it is a short
job. The forms are already collecting the two halves cleanly, which was the
prerequisite.

Small detail that took some care: the split is "everything before the last
space is the first name". So **Ana Maria Ruiz Gómez** keeps her middle names in
the first box instead of losing them, and a one-word legal name stays whole
rather than being rejected. Only the first box is required — a mononym is
normal across several of the regions we sell into.

---

## 4. "Renamed as Referral Program Dashboard … similar to the Super Admin … select from the boxes"

**Done.** A partner signing in now lands on a grid of six boxes, built on the
same card as your own Main Dashboard because "similar to the Super Admin" was
the requirement.

Each box carries a live number, so the grid is a status board rather than a
menu with pictures:

| Box | Shows | Opens |
|---|---|---|
| **Notifications** | unread count | the notifications list |
| **Clients** | how many you have added | add a client, send invites and proposals |
| **Commissions** | total earned | tiers, and the money line by line |
| **Coupons to share** | your actual code | code, referral link, how it works |
| **Marketing Material** | how many documents exist | the briefing documents, downloadable |
| **Ready Email templates** | how many letters | what each letter says and does |

Two of those screens are new capability, not a reshuffle:

**Marketing Material.** The briefing-document library has existed since 27
August, but only a Super Admin could see it. A partner could find out a
document existed only by opening the proposal composer and trying one standard
at a time. Now they see the whole shelf and can download any of it. This is the
direct answer to *"they should have in their dashboards Attachments which could
be sent attached to the email"*.

The documents stay in a private store. The download is a link that is minted
per click and expires in five minutes, so the library never becomes a public
directory anyone can hotlink or crawl.

**Ready Email templates.** Shows the two letters a partner can send, what each
one carries, and which standards currently have a document to attach. It
deliberately does **not** give them an editable body — that is point 5 below.

Commissions and Coupons are made of parts that used to sit halfway down the old
Referral page. They were **moved**, not copied. One discount code shown on two
screens is one screen too many to keep correct.

Old links still work: `/referrals` is still a real page — it is now the Clients
screen, titled to match the box that opens it.

---

## 5. Referral Partner email identity, central proposals, and attachments

You wrote at length about this. Some of it is already built, some of it is a
decision only you can make, and one part of it I would push back on. Taking it
in order.

### What you already have

> *"Proposals should be centrally generated and controlled. The Referral
> Partner should not create proposals manually in Word or PDF."*

**This is exactly how it already works, and has since 27 August.** The partner
picks a lead, picks one ISO standard, and optionally names a certification the
organisation already holds. That is all they choose. The letter itself is
written into the platform and goes out identically for every partner in every
country. There is no free-text body, on purpose.

> *"ISO 21001 Email content + PDF attachment to be sent to the client
> automatically once registered in the system."*

Also built. The letter attaches that standard's briefing document
automatically. If a standard has no document, the letter still goes — it simply
does not mention an attachment, rather than sending someone else's document.

**But:** the ISO 21001 PDF has never been uploaded. Until someone loads it
under Briefing Documents, a school proposal goes out with no attachment. That
has been outstanding since 27 August and is a two-minute job.

### The email identity question — my honest recommendation

You proposed `rp-104@certify.cx` or `john.smith@partners.certify.cx`, ideally a
real mailbox per partner rather than an alias.

**I would not do that, and here is the specific reason.**

Every mailbox that sends on behalf of certify.cx shares the domain's sending
reputation. One partner who mails a bought list, once, damages deliverability
for every partner and for our own transactional mail — the verification emails,
the certificates, the invoices. With a hundred partner mailboxes you have a
hundred independent ways to lose the domain, and no way to see it coming.

What is live today already gives you the attribution and accountability you
asked for, without that exposure:

- Every letter is sent by the platform from the company's own verified
  address, so it is SPF/DKIM aligned and does not land in spam.
- Every send is logged against the partner who triggered it, with the
  recipient, the standard and the timestamp. That is attribution, and it is
  stronger than a From: line — a From: line can be forged, a database row of
  what we actually sent cannot.
- There are send caps per partner and per recipient, so no one can turn the
  company domain into a bulk mailer.
- **Replies come back into the platform,** into the partner's own inbox screen,
  visible to you as well. The partner never handles the mailbox at all.

So the partner has an identity, you have accountability, and the domain has one
throat to choke instead of a hundred.

**If you still want per-partner addresses**, the middle path is a subdomain —
`partners.certify.cx` — with its own DKIM key. A partner incident then burns
the subdomain's reputation and leaves `certify.cx` itself, and everything
transactional that runs on it, untouched. That is a DNS change plus a
configuration change; roughly a day. It is a real option and I will build it if
you want it. I would not put partner sending on the bare domain.

**What I need from you to go further:** a decision between (a) leave it as it
is, (b) subdomain with per-partner reply identities, (c) genuine per-partner
mailboxes. I would recommend (a) today and (b) when partner numbers justify it.

---

## What is live right now

You asked to see what has actually been deployed. Here it is, honestly split
into what works today and what is waiting on you.

### Working, no action needed

| Automation | What it does |
|---|---|
| Registration → welcome email | Every new account, all nine languages |
| Checkout → order, invoice, admin alert | Payment creates the record and notifies the region's admin |
| Referral code and link | Credits the sale to the partner, discounts the buyer |
| Commission tiers | Rate rises with conversions in a rolling 12 months |
| Client invitation letter | Partner sends it from the Clients screen, code included |
| Admin alerts | New registration, new lead, payment received |
| Certificate issue and download | Generated by the platform |
| Partner agreements | Signed electronically, PDF stored |
| Nine languages | Fully in step, Arabic right-to-left |

### Built, but waiting on something from you

| Automation | Blocked on |
|---|---|
| Proposal letter with PDF attachment | The ISO 21001 PDF has not been uploaded |
| Client replies into the partner's inbox | Two migrations, one DNS record, two settings — see the 27 Aug report |
| Signature removal for existing users | `phase34` migration, above |
| Organization-size pricing at checkout | `phase31` migration |

I want to be straight about the pattern here. Four features are written, tested
and deployed but do nothing at all until a database migration is run by hand.
There is a script — `supabase/CHECK_migrations_applied.sql` — that answers
"which of these have been applied?" in one query. **Running that, and telling me
the answer, is the single highest-value thing you can do for this project this
week.** Everything in that second table starts working the day it comes back
clean.

### On daily coordination

> *"DAILY COORDINATION & SHARING OF LIVE COMPLETED WORK IS ESSENTIAL."*

Agreed, and taken. From here you get, per working day: what was deployed, what
it changes from your side, and what is blocked on you — in the same short form
as the table above. If something is going to take more than a day, you get the
shape of it before I build it, not after.

The place this has actually gone wrong so far is not frequency. It is that
finished work has sat dark for weeks waiting on a migration nobody ran, so
"deployed" and "working" have not meant the same thing. The tables above split
those two words apart deliberately, and they will stay split in every report.

---

## Files changed

**Signature removal**

- `src/pages/referrals/Referrals.jsx`, `Referrals.css` — button and editor
- `api/referrals.js` — the `save-signature` action
- `api/partner-messages.js`, `api/_emailTemplates.js` — three letter templates
- `supabase/phase34_drop_email_signature.sql` — **new, needs running**

**First / Last name**

- `src/components/ui/NameFields.jsx` — new, the shared pair
- `src/components/admin/ProfileManagementTable.jsx` — a `name` field type
- `SignUp.jsx`, `Checkout.jsx`, `Settings.jsx`, `AdminUsers.jsx`,
  `AdminApplications.jsx`, `AdminReferralPartners.jsx`, `AdminConsultancies.jsx`,
  `AdminAuditors.jsx`, `AdminCertBodies.jsx`, `AdminRegionalAdmins.jsx`,
  `Referrals.jsx`

**Referral Program Dashboard**

- `ReferralProgramDashboard.jsx` — the box grid
- `ReferralCommissions.jsx`, `ReferralCoupons.jsx`, `ReferralMaterials.jsx`,
  `ReferralTemplates.jsx`, `readyTemplates.js` — new screens
- `api/outreach-assets.js` — partner-facing list and signed download
- `src/App.jsx`, `Sidebar.jsx`, `AuthContext.jsx` — routes, menu, landing page

**Languages** — all nine, now at 1,663 keys each, still key-for-key identical.

---

## Verification

**Checked, and passing:**

- The production build compiles.
- ESLint: 39 problems, the same 39 as before this work. None new. (They are
  pre-existing and untouched.)
- All nine language files: no missing keys, no extras, no blanks, no drafts.
- Every one of the 45 new or changed strings resolves to real text in all nine
  languages — checked by script, not by eye — and the Arabic contains no
  accidental English.
- The new partner endpoints reject any role that is not a partner or an admin.
- No route was widened: the six new screens sit behind the same permission the
  old referral page already used.

**Not checked, and I want to be straight about it:**

I have not clicked through this in a browser. The same local-server problem
from 1 September is still there. So the screens are argued from the code, not
seen working.

**Please look at this after deploy:**

1. Sign in as a referral partner — you should land on the six-box dashboard.
2. Open each box; each should show a real number and open its own screen.
3. Marketing Material — press Download on a document and check it opens.
4. Add Client — two name boxes, and the saved name should read correctly in the
   table.
5. Check the Edit Signature button is gone.
6. Switch to Arabic and check the six boxes read right-to-left.

---

## Still open from earlier

- The 27 August partner inbox needs its two migrations, the DNS record and two
  settings.
- `phase31_checkout_org_size.sql` has not been run.
- The ISO 21001 PDF has not been uploaded.
- The eight Compliance Audit prices are all still at the $1,999 placeholder.
- The two surcharge tables still disagree with each other.
- The trademark question on six third-party marks is unanswered.
