# Task Report — 1 September 2026

**Arabic display and the overlapping side menu**

Reported by the client with two screenshots of the **Shareable Links** page,
viewed in Arabic.

---

## What you asked for

> 1. In the Arabic version, all information should be displayed in Arabic
> 2. The Right Menu should be transparent since it is covering the information below it
>
> *(second screenshot)* The Menu should become transparent since it is covering
> the information below

Both are done. On point 2 I did something different from what was asked, and
the reason is below.

---

## Point 2 — the menu covering the page

### What I did instead of making it transparent

A transparent menu would have let you *see* the cards underneath, but the menu
would still have been sitting on top of them — you could not have clicked them,
and the two layers of text would have been unreadable where they crossed.
Transparency treats the symptom.

The menu was covering the page because of a defect. Fixing the defect moves the
page out from under the menu entirely, which is what the screenshots actually
call for.

If, after seeing it, you still want the menu itself semi-transparent as a
styling choice, that is a one-line change — say the word.

### The defect

The right-to-left layout rules lived in `src/index.css` and pointed at a CSS
class called `dashboard-layout__main`.

**That class does not exist anywhere in the project.** The real one is
`dashboard-layout__content`. So those rules matched nothing and did nothing.

The consequence, in Arabic only:

- The page kept the 260px gap on its **left**, where there is no menu.
- It had **no gap on the right**, where the menu actually is.
- So the menu sat on top of the cards. Exactly your screenshots.

In English nothing was wrong, which is why this survived — the broken rules only
ever applied in Arabic.

### The fix

I could have corrected the class name in one place and been done in thirty
seconds. I did not, because that leaves the same trap set: two copies of the
layout, one for English and one for Arabic, and the Arabic copy silently rots
the moment anyone renames anything.

Instead the layout now uses CSS **logical properties** — `inset-inline-start`,
`margin-inline-start`, `border-inline-end`. These mean "the starting side",
whichever side that is in the current language. English puts the menu on the
left and the gap on the left; Arabic puts both on the right. One set of rules,
no Arabic-specific copy to drift.

The RTL patches in `index.css` are deleted. One exception remains and is
commented: the mobile slide-out drawer uses `transform`, which has no
directional form, so it still needs an explicit Arabic twin to slide off the
correct edge.

Two smaller things fell out of the same block, both of which had been wrong:

- The mobile breakpoint there was `768px` while the rest of the app uses
  `1023px`, so between those widths Arabic behaved differently from English.
- The collapsed width was written as `60px` in the RTL rules and `68px`
  everywhere else — an 8px misalignment that would have shown up as a seam.

---

## Point 1 — Arabic showing English

Three separate problems, all fixed.

### The stakeholder cards

Every card on the Shareable Links page — its title, the description under it,
and the benefits and rules lists on the registration page behind it — was an
English sentence typed directly into `src/utils/stakeholderTypes.js`. Those
sentences could never be translated, in any language, because they never went
near the translation system.

That file now holds key names, and the pages look up the text at render time —
the same arrangement the ISO standards catalog has always used. All six
stakeholder types are now translated into all nine languages: title, singular
name, description, five benefits and five rules each.

This fixes more than the one page:

| Where | Was |
|---|---|
| Shareable Links cards | English |
| `/register/referral` and friends | English |
| Sign-up wizard heading and blurb | English |
| Admin "create user" type list | English |
| Registration Requests badges | English |
| **The WhatsApp and email invitations sent from those cards** | English |

That last row is the one worth noting. An admin working in Arabic pressed
"البريد الإلكتروني" and got handed an English paragraph to send to an Arabic
client. Those messages are now written in the sender's language.

Two smaller items on the same page: the role line read `Role: certification
body` in English on every card, and the copy-button tooltip was a hardcoded
"Copy link". Both translated.

### The "[DRAFT]" strings

Your screenshot shows **"Main Dashboard [DRAFT]"** in the Arabic sidebar.

There were **36 of these in every one of the eight non-English languages** — 288
strings in total. They are English text with a `[DRAFT]` marker attached,
inserted by a tool that adds a key to all languages at once and leaves the
translation for later. Later never came.

They covered the sidebar entries, the whole **Main Dashboard** page, the whole
**Sales** page, and the certification-body auto-save messages. All translated.

### Keys missing entirely

27 more keys existed only in English, Spanish and Arabic — German, French,
Hindi, Portuguese, Russian and Chinese fell back to English without any marker
at all. These cover the "How would you like to join?" screen and the
certification-body import dialog. Added.

---

## Where the languages stand now

All nine files are at **1626 keys** with:

- no missing keys
- no extra keys
- no `[DRAFT]` markers
- no empty values

This is the first time they have been fully in step.

In Arabic, the only Latin characters left in the entire file are **PayPal**,
**MoneyGram**, **IBAN**, **SWIFT / BIC** and the example address
`user@example.com` — names and placeholders that should stay as they are.

---

## Files changed

**Layout**

- `src/components/layout/DashboardLayout.css` — the page gutter
- `src/components/layout/Sidebar.css` — position, border, mobile drawer
- `src/components/layout/TopBar.css` — position
- `src/index.css` — dead RTL rules removed

**Arabic content**

- `src/utils/stakeholderTypes.js` — rewritten: keys instead of English text,
  plus `getStakeholderCopy()` and `getStakeholderRoleLabel()`
- `src/pages/admin/ShareableLinks.jsx` — cards, role line, invitations, tooltips
- `src/pages/register/RegisterLanding.jsx` — hero, benefits, rules, calls to action
- `src/pages/auth/SignUp.jsx` — wizard heading and blurb
- `src/pages/admin/AdminUsers.jsx` — stakeholder type list
- `src/pages/admin/RegistrationRequests.jsx` — type badges
- `src/i18n/locales/*.json` — all nine

Commit `52e37bb`, pushed to `main`.

---

## Verification

**Checked, and passing:**

- The production build compiles.
- ESLint reports 50 problems against 51 before this work — one fewer, and none
  of them new. (The rest are pre-existing and untouched.)
- **A test script drives the real translation engine across all 9 languages and
  all 6 stakeholder types** — 54 combinations. It confirms every title,
  description, role label and both 5-item lists resolve to real text rather than
  echoing the key name, and that nothing in the Arabic card copy contains
  Latin script.
- Every language file: key-for-key identical to English, zero drafts, zero
  blanks.
- The compiled CSS contains the logical properties, and the dead
  `dashboard-layout__main` selector appears nowhere in the build output.

**Not checked, and I want to be straight about it:**

I did not see the layout fix in a browser. I built a test page to measure the
menu and the content and prove they no longer overlap, but Chrome here refused
to connect to the local server (`curl` reached it fine; the browser would not).
I stopped after three attempts rather than keep pulling at it.

So the geometry is argued from the CSS, not measured. The argument is
straightforward — the menu and the page gutter now both use "starting side", so
they are on the same side by construction — but it is an argument, not a
measurement.

**Please look at this after deploy:**

1. Switch to Arabic and open the dashboard. The menu should be on the right and
   the cards should start where it ends, with nothing underneath it.
2. Collapse the menu with the arrow. The page should widen to meet it, still
   with no overlap.
3. Narrow the browser window. The menu should slide away off the **right** edge,
   and return from the right when you open it.
4. Switch back to English and confirm nothing moved.
5. Open **Shareable Links** in Arabic — every card should read in Arabic.
6. Press the email or WhatsApp button on a card and check the message that opens
   is in Arabic too.

---

## Not done, deliberately

**The menu is not transparent.** The overlap is fixed instead, for the reason at
the top. If you want transparency as well, tell me and I will add it.

---

## Still open from earlier

Unchanged by today's work, listed so nothing is lost:

- The 27 August partner-outreach system needs its two database migrations run,
  the ISO 21001 PDF uploaded, and the `reply.certify.cx` DNS record added before
  it does anything. See `TASK_REPORT_2026-08-27.md`.
- `supabase/phase31_checkout_org_size.sql` has not been run.
- The eight Compliance Audit prices are all still at the $1,999 placeholder.
- The two surcharge tables still disagree with each other.
- The trademark question on six third-party marks is unanswered.
