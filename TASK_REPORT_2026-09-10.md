# Task Report — 10 September 2026

Two things you sent today, plus the dashboard change you approved on the 8th.

---

## 1. The HTML showing at the top of Marketing Tools

**Fixed — and it was wider than that one screen.**

### What Sharon actually saw

At the top of Marketing Tools, where an error message belongs, she was shown
this instead:

> `<!DOCTYPE html> <!--[if lt IE 7]> <html class="no-js ie6 oldie" lang="en-US">
> <![endif]--> ...`

That is the first 300 characters of an error page from Cloudflare, the service
that sits in front of the website. Something on the server did not answer in
time, Cloudflare returned its own page, and the platform printed that page to
her as if it were advice.

### The real fault

One line, in the code that every screen uses to talk to the server. When a
reply came back that was not the expected format, it took the first 300
characters of whatever it was and made that the user's error message.

**This was not a Marketing Tools problem.** I had the codebase searched: about
**thirty screens** display errors the same way. Any of them could have shown the
same wall of markup on a bad day. So the fix went in one place rather than
thirty:

- A reply that isn't readable now goes to the technical log, where whoever is
  debugging needs it — and never to the person using the screen.
- If the server or Cloudflare is at fault (a timeout, an overload), the message
  says the server is busy and to try again. That is the honest read: nothing
  the user typed caused it.
- Anything else gets a plain sentence with the error number, which is what a
  support conversation actually needs.
- All of it translated into all nine languages.

### One thing I checked so I wouldn't guess

I tested both endpoints on the live site directly. **Both answer correctly.**
So the function is not broken — what Sharon hit was a momentary timeout. If it
happens again she will now see a clear sentence instead of markup. If you want
the underlying cause chased down, that needs the Function Logs from Vercel.

---

## 2. The Investors module

**Built. 150 funds, ready to review.**

You sent a spreadsheet of 166 venture-capital funds and asked that each one be
available for you to review as Super Admin. Then you added: remove the Israel
companies. Both are done — 166 minus 16 leaves **150**.

### Where the data lives, and why not somewhere easier

There was a quick way to do this and I did not take it, so it is worth one
paragraph.

"Investor" already exists in the platform — but it means *a person who signs
up*, waits for approval, and logs in. Loading 166 funds that way would have put
166 strangers into your client count, your user list, and the welcome-email
queue. The other tempting home was the referrals table, which is worse: every
row there must belong to a partner and carries commission figures, so the funds
would have been credited to whoever imported them and inflated that partner's
numbers.

So it is its own register — the same shape as the Certification Body registry:
a list you curate, with no accounts attached.

### What the screen does

Sidebar → **Investors** (Super Admin only).

- All 150 funds, grouped by region then alphabetically
- **Search** across fund, location, sector, partner and notes
- **Filter by region** — six regions
- **Boxes at the top** showing the totals, each one a filter
- **View** on any fund shows every field: stage, sector, cheque size, recent
  activity, website, both LinkedIn profiles, and the full notes
- **Edit** any row to correct it
- Websites and LinkedIn profiles open as real links

### How the data got in, and how I know it is right

There is no spreadsheet importer in this platform and no library to build one
with, and you asked for *this data in the system* rather than for an upload
tool. So the 150 funds are written into the migration file itself — one file to
run, no upload step.

Because that means hand-generated data, I did not trust it by eye. The
generated file was **read back and compared field by field against your
spreadsheet — 2,100 values, every one an exact match.** The per-region totals
also match the section headings in your own sheet: North America 75, Europe 27,
Asia 13, India 13, Latin America 11, Middle East & Africa 11.

Running it twice is safe. It updates rather than duplicating, and it removes the
Israel rows even if you already ran the earlier version of the file.

---

## 3. On sending emails to the investors

You wrote that you will be sending emails to all of them. **One fact you need
before that plan goes further.**

> **The spreadsheet contains no email addresses.** I checked all twelve columns
> across all 166 rows. Zero. It has websites and LinkedIn profiles, but nothing
> to send to.

I did not build a Send button, because a Send button with nowhere to send would
be worse than none.

What I built instead makes the gap visible and closeable:

- A **Contact email** field on every fund, editable
- Shown in the table as a clickable address, in the detail view, and searchable
- A box counting **how many funds can actually be written to**, which filters
  the list down to the ones still missing an address

Today that box reads **0 of 150**. That is the honest measure of how far the
outreach is from possible — and that screen is where it gets closed.

**Two things stand between here and a first email:**

1. The addresses themselves. Nobody can invent them.
2. Email does not leave the platform at all right now — `mail.certify.cx` shows
   **failed** on Resend because three DNS records were never added. That blocks
   every email, not just this campaign.

When both are sorted, building the send is a small job, and I would suggest
doing it in batches with an unsubscribe link rather than 150 at once.

---

## 4. The box layout, everywhere (from your note of the 8th)

> *"Yes, let us apply this format as standard for all types of dashboards."*

Done. The boxes are now one shared component instead of three near-identical
copies, so a change to the card lands everywhere at once. The Super Admin,
auditor and certification-body dashboards all use it. The client's dashboard
gets a row of boxes above its purchase flow rather than having that flow
rebuilt as tiles — it is a step-by-step process, not a status board, and turning
it into tiles would have made buying harder.

---

## Files changed

**The HTML fix**

- `src/lib/apiClient.js` — the guard, plus three translated messages

**Investors**

- `supabase/phase35_investor_registry.sql` — **new, needs running**
- `src/pages/admin/AdminInvestors.jsx` — the screen
- `src/App.jsx`, `Sidebar.jsx` — route and menu

**Boxes**

- `src/components/ui/DashboardBoxes.jsx` — new, the one shared card
- `MainDashboard.jsx`, `Dashboard.jsx`, `ReferralProgramDashboard.jsx`,
  `ReferralTraining.jsx`

**Languages** — all nine, now 1,782 keys each, still key-for-key identical.

---

## Verification

**Checked, and passing:**

- The production build compiles.
- ESLint: 39 problems, the same 39 as before this work. None new.
- **2,100 investor values re-read out of the generated SQL and compared to the
  spreadsheet** — all exact, quoting and accents intact.
- 150 rows in the file, zero rows mentioning Israel, and the cleanup statement
  present for a database where the earlier file was already run.
- Every one of the 42 strings on the Investors screen resolves in all nine
  languages — checked by script, not by eye.
- All nine language files: no missing keys, no extras, no blanks.
- Both live endpoints behind the Marketing Tools error answer correctly.

**Not checked:**

I have not seen the Investors screen with data in it, because the migration has
not been run yet. The screen is written against the table the migration
creates; until it exists, the page has nothing to show.

**Please look at this after running the migration:**

1. Sidebar → Investors. It should read 150.
2. Filter by region — six regions, no Israel.
3. Search a fund name, then a sector word like "fintech".
4. Open View on any fund and check every field is there.
5. The "With an email" box should read 0 — press it and you get the full list
   to work through.

---

## What is waiting on you

1. **Run `supabase/phase35_investor_registry.sql`.** The Investors screen is
   empty until this happens.
2. **The three DNS records** for `mail.certify.cx` — no email of any kind
   leaves the platform without them.
3. **Two PDF uploads** — the Company Profile and the ISO 21001 briefing note.

---

## Still open from earlier

- The 27 August partner inbox needs its two migrations and the reply DNS record.
- `phase34_drop_email_signature.sql` has not been run.
- `phase31_checkout_org_size.sql` has not been run.
- The eight Compliance Audit prices are all still at the $1,999 placeholder.
- The two surcharge tables still disagree with each other.
- The trademark question on six third-party marks is unanswered.
