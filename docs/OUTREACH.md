# Cold outreach to schools and universities

Requested by the client (boss), 13 Nov 2026 ("Certify.cx Marketing Emails"): three emails per institution, from a
**separate domain** (`midhat@certify.wiki`) so `certify.cx` keeps its reputation for login codes, password resets and invoices.

| Email | When | Unsubscribe link |
|---|---|---|
| 1. Introduction | Day 1 | No (the client's brief) |
| 2. Follow-up | Day 4 | Yes |
| 3. Final follow-up | Day 9 | Yes |

Counting the first email as day 1: sent on a Monday, the follow-up goes on the Thursday and the last one on the
Tuesday of the week after. Every email goes in the **recipient's own business hours** (09:30 to 15:30 local) and never
on that country's rest days (Egypt and the Gulf rest Friday and Saturday, the UAE Saturday and Sunday).
Each email carries the Calendly link as a link, not as the full address. Replies stop the sequence.

## How it works

1. **Leads** are imported from a CSV on the Super Admin **Outreach** page (menu: Outreach). The country gives the time zone
   and the weekend; a lead whose time zone cannot be worked out is held as "Needs time zone", never guessed.
2. **An hourly job** (GitHub Actions, `.github/workflows/outreach.yml`, because Vercel's own cron is once a day on this plan)
   calls `outreach-send` and `outreach-replies` in `api/notify-event.js`.
3. `outreach-send` (api/_outreachEngine.js) sends what is due: follow-ups first, then new leads, inside business hours, within the
   daily and hourly limits. Before sending it **claims** the lead (moves it to the next step), so two overlapping runs can never
   send the same email twice; if sending fails the lead is put back and tried again.
4. `outreach-replies` reads the mailbox (IMAP): a reply ends the sequence, a bounce marks the address bad and suppresses it,
   "unsubscribe" in the subject unsubscribes, an out-of-office reply does nothing.
5. **Unsubscribe**: the link opens a page with a button (opening the link alone changes nothing, because mail scanners open links);
   the button adds the address to the do-not-email list for good. Every email also carries the standard one-click
   `List-Unsubscribe` header.

## Safety built in

- The switch starts **Off**. **Dry run** works out who would be emailed and sends nothing. **Live** needs a **test email** to have been sent
  and a Super Admin to press **Approve and go live** (recorded with who and when). Pause returns to dry run at any time.
- A new mailbox is **warmed up**: 10 emails a day for the first week, 20 the second, then the configured limit (default 40).
- Nobody on the do-not-email list is ever emailed; our own addresses cannot be imported.
- A mail login or connection failure stops the run instead of retrying against the server.
- Cold email is sent from the outreach mailbox, **not** through Resend (its policy forbids unsolicited mail).

## Set up (once)

1. **Supabase SQL editor:** run `supabase/phase48_outreach.sql`.
2. **Vercel environment variables (Production).** Already added: `OUTREACH_SMTP_HOST` (`business117.web-hosting.com`), `OUTREACH_SMTP_PORT` (`465`),
   `OUTREACH_SMTP_USER` (`midhat@certify.wiki`), `OUTREACH_FROM_NAME`, `OUTREACH_CRON_SECRET`.
   **You add the mailbox password yourself**, never in chat: in a terminal run `vercel env add OUTREACH_SMTP_PASS production` and type it when asked
   (or add it in the Vercel dashboard), then redeploy.
3. **GitHub:** repository Settings, Secrets and variables, Actions, New repository secret named `OUTREACH_CRON_SECRET`, with the same value as in Vercel.
4. **Email records for certify.wiki** (already in place: SPF, DKIM, DMARC `p=none`). Recommended: `_dmarc.certify.wiki` TXT
   `v=DMARC1; p=none; rua=mailto:midhat@certify.wiki`.
5. Open **Outreach** in the Super Admin menu: set the Calendly link and a test address, **Send test email**, check the inbox and the spam folder
   (and score it on mail-tester.com), then import leads and **Approve and go live**.

## The CSV

Columns (the first row holds the names): `institution_name`, `contact_name` (optional), `email`, `country` (or `timezone`), `institution_type` (optional).
Download a template on the page. Up to 2000 rows at a time; duplicates, invalid addresses, our own addresses and anyone on the do-not-email list are skipped and counted.

## Changing the wording

The emails are `marketing-emails/*.html`. After editing them run `node scripts/build-outreach-templates.mjs`, which rewrites `api/_outreachTemplates.js`
(a serverless function cannot rely on reading the HTML files at run time).

## Files

`supabase/phase48_outreach.sql`, `api/_outreachSchedule.js` (days, time zones, weekends, warm-up), `api/_outreachEngine.js` (send, replies, import, unsubscribe),
`api/_outreachMail.js` (SMTP and IMAP), `api/_outreachAdmin.js` (Super Admin actions), `api/_outreachTemplates.js` (generated), `api/notify-event.js` (the jobs),
`src/pages/admin/AdminOutreach.jsx`, `src/pages/public/Unsubscribe.jsx`, `.github/workflows/outreach.yml`, `tests/outreach` (`npm run test:outreach`, 26 tests).

## Not built

Reading a Calendly booking automatically (mark a lead as replied by hand for now), LinkedIn or other channels, and A/B subjects.
