-- ============================================
-- Certify.cx — Phase 10 Migration: Profile Active Status
-- ============================================
-- Run in the Supabase SQL Editor.
-- Idempotent (safe to re-run).
--
-- Background:
--   Admin management modules (Auditors, Certification Bodies, Regional
--   Admins, Companies and the master Users list) gained Super-Admin row
--   actions: Activate / Deactivate, Edit and Delete — modelled on the
--   existing Discount Coupons screen.
--
--   "Deactivate" needs a flag to flip. The `profiles` table previously had
--   no such column (only `approval_status`, which is part of the signup
--   approval flow and should not be overloaded). This migration adds a
--   dedicated `is_active` boolean.
--
-- Behaviour:
--   - is_active defaults TRUE so every existing user stays enabled.
--   - api/user.js (action: 'set-active') flips this flag AND bans/unbans the
--     Supabase auth user (ban_duration) so a deactivated user cannot log in.
--   - Writes happen through the service-role API only; no RLS change is
--     required for the feature to work (service role bypasses RLS).
-- ============================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Backfill any pre-existing NULLs defensively (no-op on a fresh add).
UPDATE public.profiles
  SET is_active = true
  WHERE is_active IS NULL;

COMMENT ON COLUMN public.profiles.is_active IS
  'Super-admin toggle. FALSE = account deactivated (login blocked via auth ban). Managed by api/user.js set-active.';

-- --------------------------------------------
-- Reference tables get the same Activate/Deactivate flag so every admin
-- management listing exposes the full [Deactivate] [Edit] [Delete] action set.
-- These are soft flags (default TRUE); they mark a record inactive for admins.
-- --------------------------------------------
ALTER TABLE public.countries
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

ALTER TABLE public.accreditation_bodies
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
