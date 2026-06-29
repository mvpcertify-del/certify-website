-- Phase 15 — Notification readiness: phone number + per-user on/off toggle.
--
-- Adds two columns to profiles:
--   * phone                 — the user's contact number, persisted so WhatsApp
--                             notifications can reach them (previously the
--                             contact number lived only in auth.users metadata).
--   * notifications_enabled — Super Admin / system switch. Defaults to TRUE so
--                             notifications are "activated for every new AND
--                             existing user" (the DEFAULT covers new rows; the
--                             backfill UPDATE covers anything already present).
--
-- Idempotent: safe to run more than once.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notifications_enabled boolean NOT NULL DEFAULT true;

-- Belt-and-suspenders: ensure every existing row is activated.
UPDATE public.profiles
  SET notifications_enabled = true
  WHERE notifications_enabled IS NULL;
