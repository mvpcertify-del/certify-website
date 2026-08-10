# Task Report — 9 August 2026

**Project:** Certify.cx
**Status:** All four items handled — three code fixes and one written assessment

---

## The four requests

| # | Client's words | Status |
|---|---|---|
| 1 | *"There is an Error & the user is not being saved"* (screenshot: "Forbidden: only a super admin can change region") | Fixed |
| 2 | *"1. All certificates should be displayed 2. All certificates should be interactive so that Client can select 1 or more certificates in this step 3. After selection, the payment Pop up will be displayed to do payment"* | Done |
| 3 | *"ISO 22000 Audit Automation Implementation" — is this automation plan correct? And send the source information so I can share it with ChatGPT* | Assessed + information pack prepared |
| 4 | *"When I clicked on Open Dashboard button, I received the above message"* (browser security warning) | Fixed |

---

## 1 — "Tell us about your organization" refused to save

### What was happening

A client filled in the organization form on the dashboard, pressed **Save and
continue**, and got a red bar reading **"Forbidden: only a super admin can change
region"**. Nothing was saved — not the company name, not the activity, not the
location, not the phone number.

### Why

The form was sending the customer's **region** to the server along with everything
else. Region decides which country admin owns an account, so the server only lets
a Super Admin set it, and refuses the whole request if anyone else tries. Every
client filling in this form was "anyone else", so the form could never save. It
refused loudly rather than silently dropping the field — which is the right
behaviour, and is what made the fault visible instead of mysterious.

The region did not need to be sent at all: the server works it out from the
**Location** field on its own.

### The fix

- The form no longer sends the region. It sends the company details; the server
  derives the region from the Location, exactly as it does when an account is
  first created.
- The server now resolves Location → region against your **admin-managed
  Countries list first**, and only falls back to the built-in country map if the
  country isn't in that list. Previously that admin-managed list was consulted in
  the browser and ignored on the server, so a country you had deliberately mapped
  to a region could have been overridden. Now what you configure wins.

No database change. Nothing else about who may change a region has been relaxed —
a client still cannot set their own region, they simply no longer try to.

---

## 2 — All certificates, selectable, with a payment popup

### All of them are displayed

The step used to list **six** certificates that had been typed into the page by
hand. It now lists **all twelve** in the catalogue:

ISO 9001 · ISO 14001 · ISO 45001 · ISO 22000 · ISO 21001 · ISO/IEC 27001 ·
ISO/IEC 27701 · ISO/IEC 42001 · ISO 50001 · ISO 37001 · ISO 22301 · ISO 13485

They are read from the same catalogue the public pricing pages use, so the two
lists can no longer drift apart. Add a standard there in future and it appears
here automatically. All twelve names and descriptions were already translated
into all nine languages.

### They are interactive — one or more

Each certificate is now a selectable card. Clicking selects it, clicking again
removes it, and any number can be selected. Selected cards are outlined and show
a tick. They are proper buttons, so they also work by keyboard and are announced
correctly to screen readers — this is a choice that costs money, so it should not
be mouse-only.

The button underneath stays disabled until at least one is chosen, and once more
than one is chosen it reads **"Continue with 3 certifications"** so the count is
never a surprise.

### The payment popup

Pressing it opens a popup that shows:

- every certificate chosen, with its price,
- the total,
- a note that organization-size charges and any discount code are applied on the
  next step, before paying,
- **Proceed to payment**.

Proceeding takes the client to the existing checkout page — coupons, referral
discount, employee/location steppers, and card / PayPal / bank transfer / cash —
now showing the whole basket, with a single total and **one payment for all of
them**.

### How a multi-certificate order behaves

Each certificate stays its own certification: its own audit, its own auditor and
certification body, its own certificate at the end. What is shared is the money
and the paperwork — one payment, and one company-details form afterwards that
completes all of them at once, rather than making the client type the same
details three times.

**Pricing decision worth confirming:** the headline price is per certificate
(US$999 each), and the organization-size surcharges (extra employee bands, extra
locations) are also charged **per certificate**, because each one is a separate
audit of the same organization. If you would rather charge those surcharges once
for the whole basket, say so — it is a one-line change.

---

## 3 — The ISO 22000 automation plan

### Short answer

**The direction is right. The technical premise is wrong, and one commercial
claim needs care before you repeat it to a customer.**

### What the plan gets right

- **"Build a standards-agnostic compliance engine, not an ISO 22000
  application."** This is the single most valuable sentence in the document and I
  agree with it completely. Certify.cx already sells twelve standards; building
  ISO 22000 as a special case would mean rebuilding the same thing eleven more
  times.
- **Evidence generated inside the platform beats uploaded documents.** Today the
  product collects PDFs. Monitoring records, deviations and CAPA created *in* the
  system are what make an audit trail worth anything — and what make an AI review
  possible at all.
- **The workflow** (monitoring → record → validation → deviation → risk → CAPA →
  verification → closed) is a fair description of how a real FSMS works.
- **The clause/requirement/evidence data model** is the correct backbone for
  "one piece of evidence satisfies several standards".

### What is wrong

**Certify.cx is not a Next.js application.** The plan says *"Since Certify.cx is
Next.js…"* and asks for an `app/` or `pages/` directory. The product is a **React
19 + Vite** single-page application with **Vercel serverless functions** in
`/api`, on **Supabase**. There is no `app/`, no `pages/`, no Next.js. Any code
produced on that assumption will not fit, and the wasted work would only be
discovered at integration time. This is corrected in the information pack below.

### What the plan does not mention, and must

1. **Row Level Security.** This is Supabase; tenant isolation lives in database
   policies. Fourteen new tables need fourteen sets of policies, designed with the
   columns, not afterwards.
2. **Roles and regional scoping.** Five roles, and every non-super-admin is
   limited to their own region. A new module that ignores this leaks data across
   countries.
3. **The 12-function limit.** The project is on Vercel's Hobby plan: `/api` holds
   exactly twelve route files and a thirteenth fails the deployment. A module
   that wants twenty endpoints has to add them as *actions* inside existing
   routes — or the plan needs to include upgrading the hosting.
4. **Collisions with what already exists.** The plan proposes creating
   `documents` and `notifications`; both already exist and are in use, as are
   applications, certificates, profiles and the certificate-issuing flow. This is
   a mapping exercise, not a greenfield one.
5. **Nine languages, one of them right-to-left.** Every screen in that thirteen-item
   dashboard tree needs its strings translated nine times and its layout checked
   in Arabic.
6. **Evidence integrity.** If the system is going to assert "CCP-01 exceeded its
   critical limit twice", the underlying records must be tamper-evident — who
   entered what, when, and what changed afterwards. That is a schema decision
   taken at the start or not at all.

### The claim that needs care

The plan's **"AI Internal Auditor"** issuing "Potential Major NC Detected" is
achievable and genuinely useful — as an **internal audit and readiness tool for
the client**. It cannot stand in for the certification audit itself: under the
accreditation rules Certify.cx operates within, certification decisions rest with
competent auditors and the certification body. Sold as "AI readiness and internal
audit", it is a strong differentiator. Sold as "AI certification", it is a problem
with your accreditation bodies. Worth settling the wording before it reaches a
customer.

### How I would sequence it

Phase 1 as written is fourteen tables at once. I would ship it in slices that each
produce something usable:

1. **Standards → clauses → requirements** (reference data) plus
   **requirement applicability** per application. Immediately powers a real
   readiness percentage instead of the current questionnaire score.
2. **Evidence linking** — connect the documents already being uploaded to the
   requirements they satisfy. This alone turns the existing document pile into an
   audit trail, and it is where the multi-standard reuse pays off.
3. **Digital records + deviations + CAPA** for ISO 22000 (CCP/OPRP/PRP
   monitoring). The first standard-specific slice, on top of a generic engine.
4. **Internal audit + AI review** reading the records from step 3.

Steps 1 and 2 are worth doing whatever happens to the rest of the plan.

### What you asked me to send

I have written **`CERTIFY_STACK_BRIEF.md`** (in the project root). It is the
answer to the document's "What I need from the programmer" list — the real stack,
`package.json`, the directory layout, the authentication setup, all twelve API
routes and their actions, the database tables and migration list, the client
dashboard components, and the environment-variable **names**. It opens by
correcting the Next.js assumption, so the first thing ChatGPT reads is what it is
actually writing code for.

Send that file. **Do not send the `.env` file, the Supabase service-role key, or
the Stripe secret key to anyone, including an AI assistant.** The brief contains
no values, only names — which is all that is needed to write code against them.

If you would rather hand over the source: the repository itself is safe, because
`.env` is git-ignored and never leaves the machine. If a ZIP is made by hand from
the project folder, delete `.env` from it first.

---

## 4 — "Open dashboard" led to a security warning

### What was happening

Tapping **Open dashboard** in the registration alert email opened
`https://app.certify.cx/dashboard` and the browser refused it:
*"Your connection is not private — NET::ERR_CERT_AUTHORITY_INVALID"*.

That host does not serve the app and has no valid certificate. The live app is at
`https://certify.cx`. The address was coming from a setting (`APP_PUBLIC_URL`) in
the hosting environment which had been set to the wrong host.

### The fix

Last week I flagged this as a one-minute change you needed to make in Vercel. It
is now fixed **in the code instead**, so nothing is required from you:
transactional email links no longer read that setting at all. They use the live
site, and can only be pointed elsewhere by a variable that has to be set
deliberately for that purpose.

The same wrong setting was breaking more than the one button. All of these are
fixed by the same change:

| Where | What was broken |
|---|---|
| Admin alert emails | "Open dashboard" → security warning |
| Welcome email | dashboard link → security warning |
| Certificate-issued email | dashboard link → security warning |
| Renewal reminders and lifecycle emails | dashboard link → security warning |
| Referral partner invitations | the partner's own sign-up link → security warning |
| **Email verification** | after clicking "verify", the new user was redirected to the dead host |

That last row is the one I would have worried about most: the link worked, the
account was confirmed, and then the person was dumped on a browser security
warning instead of the site.

---

## Files changed

| File | Change |
|---|---|
| `src/components/ProfileCompletionModal.jsx` | stops sending `region`, which was causing the refusal |
| `api/user.js` | derives region from the admin-managed Countries list first |
| `src/pages/dashboard/Dashboard.jsx` | all twelve certificates, multi-select, payment popup |
| `src/pages/dashboard/Dashboard.css` | picker and popup styles |
| `src/utils/pricing.js` | prices an order of several certifications |
| `src/pages/client/PaymentPlaceholder.jsx` | checkout shows and charges the whole basket |
| `src/pages/client/ApplicationForm.jsx` | one registration completes every certification paid for |
| `api/checkout.js` | multi-certification order: server-side price, ownership check, one Stripe charge |
| `api/_appUrl.js` *(new)* | one verified source for links inside email |
| `api/_notifyAdmins.js`, `api/create-user.js`, `api/send-welcome.js`, `api/notify-event.js`, `api/issue-certificate.js`, `api/referrals.js`, `api/_sendVerificationEmail.js` | all now use it |
| `src/i18n/locales/*.json` (9 files) | nine new strings, translated into all nine languages |
| `.env.example` | documents the change |
| `CERTIFY_STACK_BRIEF.md` *(new)* | the information pack for item 3 |

**No database migration is required.**

---

## Verification note

Reviewed statically: all nine language files parse and carry the nine new keys;
every text label used on the changed screens resolves; every edited file balances.

Node.js is still not installed on the machine this work was done on, so
`npm run dev` / `npm run build` could not be run here.

Two things are worth checking on a preview deployment before this reaches
customers, because I could not exercise them here:

1. **A test payment for two or more certificates**, in Stripe test mode — confirm
   the total on the checkout page matches what Stripe charges, and that after
   paying, both applications appear in the dashboard as registered and paid.
   Single-certificate purchases follow exactly the same code path they did
   before and are unaffected.
2. **The organization form** — save it once as a client and confirm the details
   persist and the account lands in the right region.

Worth a glance in Arabic too, since the certificate picker is new.
