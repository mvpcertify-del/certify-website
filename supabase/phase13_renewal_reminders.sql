-- Phase 13 — Certificate renewal reminders
--
-- Adds a timestamp that records when the daily renewal-reminder cron last
-- emailed the client about an expiring certificate. NULL = not yet reminded.
-- The cron (GET /api/notify-event, see api/notify-event.js → handleRenewalCron)
-- selects active certificates expiring within 30 days where this is NULL, emails
-- the client, then stamps this column so the reminder is sent only once.
--
-- Idempotent: safe to run multiple times.

ALTER TABLE public.certificates
  ADD COLUMN IF NOT EXISTS renewal_reminded_at timestamptz;

-- Speeds up the daily cron scan (expiring + not-yet-reminded).
CREATE INDEX IF NOT EXISTS idx_certificates_renewal_scan
  ON public.certificates (expires_at)
  WHERE renewal_reminded_at IS NULL;
