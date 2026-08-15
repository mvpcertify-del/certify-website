# Task Report — 15 August 2026

**Project:** Certify.cx
**Status:** Fixed in code. **One 30-second database step is still required — see "What you need to do" below.**

---

## The request

> *"Salam, Check the above Error which is always occurring. Need to resolve this
> issue immediately. Update me back once done."*

Screenshot: the **Referral Program → Add Client** window, showing

> ⓘ Could not find the `'referred_website'` column of `'referrals'` in the schema cache

The form was fully filled in (JOHN YELLOW, RRP2@WCA-GLOBAL.COM, UNIVERSITY,
WhatsApp number, website) and refused to save.

---

## What was actually wrong

Nothing was wrong with the form, the partner's account, or the data they typed.

On 25 July you asked for two extra boxes on the Add Client form — **WhatsApp
number** and **company website**. That work has two halves:

1. the screen that collects the two values, and
2. the database change that creates the two places to store them.

Half 1 was deployed. **Half 2 was never run against the live database.**

So every time a partner pressed *Add Client*, the site tried to file the record
under two headings the database does not have, and the database rejected **the
entire record** — not just the two new values. That is why no client could be
added at all, and why it happened every single time rather than occasionally.

The database change itself has existed in the project since July
(`supabase/phase28_referral_client_fields.sql`). It simply was never applied.

---

## What I have done

### 1. A ready-to-run database file

New file: **`supabase/HOTFIX_2026-08-15_referral_columns.sql`**

It creates the two missing columns and is safe to run more than once — running
it twice, or on a database that already has them, does nothing and cannot fail.
It is deliberately a separate, self-contained file so nobody has to work out
which of the thirty migration files is the right one while the site is broken.

### 2. Fixed the "schema cache" half of the problem

Notice the error says *schema cache*, not *column*. Even after the columns are
created, the layer that serves the site works from a cached picture of the
database and refreshes on its own schedule — so the same error can persist for
several minutes after the fix has been applied, which looks exactly like the fix
not working.

Both the hotfix file and the original migration now tell that layer to refresh
immediately, so the form works the second the query finishes.

### 3. Made the site survive this class of problem on its own

This is the important part. **The Add Client form now works even before the
database step is done.**

If the two optional boxes cannot be stored, the site no longer throws away the
whole referral. It saves the client with the core details — name, email,
company, status — and shows a clear amber message:

> The client was added, but the WhatsApp number and website could not be stored
> yet. Please ask your administrator to apply the pending database update.

The reasoning: WhatsApp number and website are useful contact details, but
losing an entire referral over them is far worse than saving it without them.
The message is deliberately visible rather than silent, so the gap is never
hidden — and once the database step is done, that message can never appear
again.

The message is translated into all nine site languages (English, Spanish,
Arabic, German, French, Hindi, Portuguese, Russian, Chinese).

---

## What you need to do

**In the Supabase dashboard → SQL Editor → New query → paste → Run:**

```sql
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referred_whatsapp text,
  ADD COLUMN IF NOT EXISTS referred_website  text;

NOTIFY pgrst, 'reload schema';
```

That is the whole fix. It takes about thirty seconds, it cannot damage existing
data, and it is safe to run twice.

To confirm it worked, run this — it should return exactly two rows:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'referrals'
   AND column_name IN ('referred_whatsapp', 'referred_website');
```

Then open **Referral Program → Add Client**, fill in a test client including the
WhatsApp and website boxes, and save. It should save cleanly with no amber
message.

---

## Why this happened, and how to stop it recurring

Database changes in this project are applied **by hand**, and nothing records
which ones have already been run. A feature can therefore be fully built,
reviewed and deployed, and still be broken in production because one manual step
in a different system was missed — with no warning anywhere until a user hits it.

I checked the whole codebase for the same class of problem: every database
column the application writes does have a migration file written for it, so
nothing else is missing from the *project*. But that check can only prove the
file exists — not that it was ever run, which is exactly what caught us here.
The only way to know that is to ask the database.

### A file that asks it

New file: **`supabase/CHECK_migrations_applied.sql`**

Paste it into the SQL Editor and it lists every recent migration with `APPLIED`
or `MISSING` beside it. It is completely read-only — it creates, changes and
deletes nothing, and is safe to run on the live site at any time.

Run it whenever the site behaves strangely after a deploy. It turns "something
is broken and nobody knows why" into a one-line answer.

### Two migrations still to confirm

| File | What it adds | Status |
|---|---|---|
| `phase28_referral_client_fields.sql` | WhatsApp + website on a referral | **Applied 15 Aug — today's fix** |
| `phase29_partner_agreements_all_roles.sql` | Agreements for referral / country admin / auditor | Run the check above |
| `phase30_core_legal_signatures.sql` | The legal signature ledger in the specified shape | Run the check above |

Both are safe to run: phase29's three inserts are each guarded so they cannot
duplicate an agreement that already exists, and phase30 was verified against the
application code before recommending it — it requires every signature to carry
an IP address, and the code already guarantees one. If either has not been
applied, the Partner Agreement and signature features will fail the same way the
moment somebody uses them, so it is worth confirming now rather than from a
partner's screenshot.

Longer term, this is worth a small permanent fix: a table that records which
migrations have run, so a deploy can say plainly "database is 2 versions behind"
instead of failing silently in front of a user. Happy to add it on your word.

---

## Files changed

| File | Change |
|---|---|
| `supabase/HOTFIX_2026-08-15_referral_columns.sql` | **New** — paste-and-run fix |
| `supabase/phase28_referral_client_fields.sql` | Added the immediate cache reload |
| `src/pages/referrals/Referrals.jsx` | Save the referral even if the two optional columns are missing; report what was dropped |
| `src/pages/referrals/Referrals.css` | Amber partial-save banner |
| `src/i18n/locales/*.json` (9 files) | The new message, in all nine languages |

No existing data is read, rewritten or deleted by any part of this change.

---

## Verification

Checked here:

- All nine language files parse correctly and carry the new message, with
  identical structure to each other.
- The changed page is structurally intact (bracket balance verified against the
  previous version).
- The fallback path only triggers on this exact database error and on no other
  failure — a genuine problem (duplicate email, permission error, network) still
  reports honestly and does not silently save a partial record.

Still to confirm on the live site, after the SQL above is run:

- Add Client saves with WhatsApp and website filled in, with no amber message.
- The saved values appear on the referral.
