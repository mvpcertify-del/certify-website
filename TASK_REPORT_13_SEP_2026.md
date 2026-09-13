# Task report — the client's 13 September round

**Commit:** `34ff3c1` · **Branch:** `main` · **Status:** committed, not yet pushed
**Build:** passing · **Lint:** 53 problems (unchanged baseline — no new errors)
**Locales:** 9/9 in sync, 0 missing keys, 0 empty values

---

## The eleven points

| # | What the client asked | Done | Where |
|---|---|---|---|
| 1 | Add the LinkedIn profile link of the named person, since there is no email in the spreadsheet | ✅ | Investors table |
| 2 | What is the difference between Cert Bodies and CB Registry? | ✅ | Both screens renamed + explained |
| 3 | The numbers should be reflected; selecting a box should open that section | ✅ | Referral Program Dashboard |
| 4 | Add the 5 icons to the Investors module | ✅ | Investors table (6, with LinkedIn) |
| 5 | LinkedIn contact icon + person's name; website link on each fund's line | ✅ | Investors table |
| 6 | Links to view each walkthrough, opening certify.wiki | ⚠️ | Training screen — links built, content pending |
| 7 | Two options per link: video with minutes, PDF with reading time | ⚠️ | Training screen — same |
| 8 | Selecting each referral partner one by one is not practical at 500 partners | ✅ | Referral Program Dashboard |
| 9 | Are we using Custom User Fields and Custom Application Fields? | ✅ | Answered + the real gap fixed |
| 10 | Add 2 more boxes: Messages and Notifications | ✅ | Main Dashboard |
| 11 | Verify the work | ✅ | 5 review agents, 3 real bugs caught |

---

## 1, 4, 5 — Investors module

**What was wrong.** The register carries a website, the fund's LinkedIn and the
key partner's LinkedIn for **all 150 funds** — the data was already in the
database. Only the detail popup showed it, so from the table the register looked
like it had no contact route at all. The row had three icons where every other
management screen has five.

**What was done.**

- The **key partner** column now shows the person's name with their **LinkedIn
  profile** underneath.
- A new **Website** column, carrying the fund's LinkedIn beneath it.
- The row actions are now **View · Email · Activate/Deactivate · Edit · Delete**
  plus a **LinkedIn** icon — the five the client's screenshot showed, and the
  sixth the client asked for by name.
- The envelope is **greyed out, not hidden**, on a fund with no email address.
  A missing icon reads as a bug; a greyed one states a fact.
- Email and LinkedIn are real links, so they can be middle-clicked, copied, or
  opened in a new tab.

**Still true and worth repeating to the client:** *0 of 150 funds have an email
address.* The spreadsheet never contained any. LinkedIn is the only route, which
is exactly the client's own point.

---

## 2 — Cert Bodies vs CB Registry

**The confusion was ours, not the client's.** Both screens printed the identical
heading "Certification Bodies", because both read the same two translation keys.
They are different things reading different tables:

| | Cert Bodies | CB Registry |
|---|---|---|
| Holds | The **people** who sign in for a certification body | The **organisations** themselves |
| Table | `profiles` where role = certification_body | `certification_bodies` |
| Shows | Name, email, country, organisation, joined | Accreditations, countries covered, ISO standards, pricing |
| Count today | **0** — nobody has registered yet | **5** |

That is also why the Main Dashboard says "5 Certification Bodies" while the
Cert Bodies page says "0". **Both numbers were always correct.**

**What was done.** Each screen now has its own title — **Certification Body
Accounts** and **Certification Body Registry** — and one sentence under it
saying what it holds and where to find the other. The sidebar entry is now
**CB Accounts**.

---

## 3 + 8 — Referral Program Dashboard

These were one problem. A Super Admin had to pick a single partner from a
dropdown, and **until they did, all seven boxes showed a dash**. With 500
partners that is not a review.

**What was done.**

- With nobody picked, the boxes **total the whole programme** — every partner's
  clients, sales, credit, proposals and notifications added up.
- A **searchable table** of every partner replaced the dropdown, showing each
  one's clients, converted, sales, commission, unpaid credit and notifications.
  Search matches name, company, email or referral code.
- Clicking a row narrows the boxes to that partner; **Back to all partners**
  returns to the totals.
- **Each box now opens the admin's own section** — Referral Partners, Sales,
  Payouts — instead of sending the admin to the signed-in partner's own empty
  screen, which is what made the feature look switched off on 12 September.
- If the partner list cannot be loaded, the boxes show a **dash, not zero**.
  Zero is a real answer and must not be faked.

---

## 6 + 7 — Training: video and PDF links

Each of the six walkthroughs now offers two ways to take it, each labelled with
how long it takes — for example **"Watch the video — 4 min"** and **"Read the
PDF — 3 min"** — opening on certify.wiki. The base address is configurable, so
a staging site can point at a staging wiki without a code change.

> ### ⚠️ This one is not finished, and it is not finished on the client's side
>
> **certify.wiki does not exist.** There is no page, no recording and no PDF
> behind any of these twelve links. The minute counts are estimates, not
> measurements.
>
> **Before this reaches real partners the client must supply the recordings and
> the hand-outs, or the links must come down.** A partner clicking one today
> lands on a dead page, and that will look like our defect rather than missing
> content.

---

## 9 — Custom User Fields and Custom Application Fields

**Yes, both are in use.** Fields defined on those two screens appear:

- **Custom User Fields** → on the signup form for the chosen roles, and on the
  user's own profile page.
- **Custom Application Fields** → in the approve/reject dialogue, according to
  which decision they are set to fire on.

Both are saved correctly. Nothing is currently defined, which is why the
screens read as unused.

**The real gap, now fixed.** The answers were **written and never read back** —
they went into the database and off the screen. Nobody could see what an
applicant had answered. Now:

- Signup answers appear in the row's detail popup on every management screen.
- Decision answers appear on the application itself.
- **Admins and the deciding certification body only.** Not auditors: these are
  free-text answers to questions an admin wrote, and "internal rationale" is a
  perfectly ordinary thing to label a field.

---

## 10 — Two more boxes on the Main Dashboard

**Messages** (conversations in the partner inbox) and **Notifications** (the
admin's own unread updates). Both open their screen on click, like the others.

---

## 11 — Verification

Five review agents read the finished work. Three genuine bugs came back that had
been missed:

1. **Approval answers could never appear.** The database column defaults to an
   empty object, which JavaScript treats as true, so the code always chose the
   rejection answers. An approved application showed nothing.
2. **Auditors could see the approval and rejection notes** — content they had
   never been able to see. Now restricted.
3. **"$0.00 across 0 partners" before the list had loaded.** Now a dash until
   the figures are actually known.

## Two older bugs fixed along the way

- **Paid orders showed raw text.** The payment badge built its label by pasting
  the status into a key name, so the three card/cash/bank statuses produced a
  key that does not exist and the admin saw the literal string `paid:card` — in
  all nine languages.
- **The translation check was blind to six languages.** The audit that runs
  before every commit compared English, Spanish and Arabic only. German, French,
  Hindi, Portuguese, Russian and Chinese could have drifted out of sync without
  anything noticing. It now reads every locale in the folder.

---

## What is blocked on the client

| | Needed from the client |
|---|---|
| **certify.wiki** | The videos and PDFs, their real addresses, and their true durations |
| **Investor emails** | The spreadsheet has none for any of the 150 funds — LinkedIn is the only route today |
| **Payouts** | Shows $0 because no referral has yet converted into a paid sale. Nothing to fix |

## Ready when you say so

The work is committed on `main` as `34ff3c1`. **It has not been pushed**, so it
is not yet live on the deployed site. Say the word and it goes up.
