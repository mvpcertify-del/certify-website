# Notification & engagement engine (Phases 1 and 2)

Requested by the client (boss), 15 Nov 2026: "activate notifications for all stakeholders and all important
transactions" (document "Certify.cx Notification functionality 15.11.26"). Built natively in the platform
(option A in that document), using only the existing stack: Supabase, Vercel, Resend.

## What runs

Once a day (the existing 09:00 UTC cron in `api/notify-event.js`) the engine in `api/_notifyEngine.js` runs every
enabled rule. Each rule finds who needs a message from the real tables, counts the days from that person's own
dates, writes one row to `notification_log` (unique event id, so a reminder can never go out twice) and delivers
it by in-app inbox and email. WhatsApp is wired in but does nothing until a WhatsApp provider is configured.

| Rule key | Who | When | Source of the date |
|---|---|---|---|
| `contractor_trial_ending` | Contractor | 7, 3 and 1 days before the 30-day free period ends | `profiles.approved_at` + 30 days |
| `client_onboarding_incomplete` | Client | 24 h after registering with no application started (registered in the last 7 days only) | `profiles.created_at`, `applications` |
| `invoice_unpaid` | Client | Due date, and 3 days later (due in the last 14 days only) | `invoices.due_date`, status `issued` |
| `documents_missing` | Client | Every 3 days, up to 4 times, while no document is uploaded (package chosen) | `applications`, `documents` |
| `certificate_expiry` | Client | 90, 60 and 30 days before expiry | `certificates.expires_at` |

Already working before this, unchanged: a new contractor task (email + in-app), referral events, payment,
application, audit and certificate-issued messages.

Once the engine has run, it also owns certificate expiry, so the old single 30-day sweep stands down (no double email).

## Safety rules built in

- **No duplicates:** the event id (`rule:entity:bucket`) is UNIQUE; the row is the lock.
- **No obsolete reminders:** paid, finished, cancelled, expired items are simply not returned by the queries.
- **No flood on day one:** "after" rules look back only a few days (the `lookback_days` setting), and one run sends at
  most 25 messages. The rest are not logged, so tomorrow's run picks them up.
- **One missed day never means two messages:** the nearest reminder goes once.
- **Fails quietly:** an engine error never stops the renewal and contractor sweeps.

## Switch it on (once)

1. **Supabase SQL editor:** run `supabase/phase47_notification_engine.sql` (creates `notification_rules`,
   `notification_log`, and adds `link` and `event_id` to `notifications`). Until then the engine reports
   `not_migrated` and sends nothing.
2. **Check before it sends:** open `https://certify.cx/api/notify-event?job=notify-engine&dry=1` with the header
   `Authorization: Bearer <CRON_SECRET>`. It lists, per rule, how many people would be messaged, and logs/sends nothing.
   Add `&rule=contractor_trial_ending` for one rule.
3. The next daily cron run (or the same URL without `dry=1`) delivers for real.

To switch one notification off, or change its days, edit its row in `notification_rules` (`enabled`, `offsets`,
`channels`, `config`). A screen for that is Phase 3.

## Not in this phase

- Quotation, Stage 1/2 audit, corrective-action and surveillance reminders: the platform does not store those dates yet.
- Admin "Notifications & Automation" page, user preferences, Arabic/French/Spanish wording, delivery statistics (Phase 3).
- WhatsApp (needs a Meta WhatsApp Business account, number, approved templates and user opt-in), push (needs a mobile app).
- Sara AI follow-ups and escalation (Phase 5).

## Tests

`npm run test:notify` (19 tests): timing, wording, de-duplication, the per-run cap, the pre-migration behaviour and each rule.
