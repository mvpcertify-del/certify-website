-- ============================================
-- Certify.cx — Phase 17: Checkout repair + profiles.country
-- ============================================
-- Run in the Supabase SQL Editor.
-- Idempotent (safe to re-run).
--
-- WHY THIS EXISTS — READ FIRST
--
-- Checkout is 100% broken in production. Every buyer, on every payment method,
-- gets "Could not record your order. Please try again."
--
-- Root cause: phase8 and phase11 were never applied to the live database. The
-- live `applications` table is missing all five of these columns, which
-- api/checkout.js writes on every order:
--     additional_employee_bands, additional_locations, total_amount,
--     payment_method, payment_status
-- so the INSERT at api/checkout.js:271 fails with PGRST204 and the handler
-- returns the generic error above. (Verified against the live schema on
-- 2026-07-14 by probing PostgREST: those five return 42703 "column does not
-- exist", while every other column the insert writes resolves fine. phase15's
-- profiles.phone IS present, so the phases were applied out of order.)
--
-- This migration folds in the missing phase7/8/11 changes AND fixes two CHECK
-- constraints that phase11 would otherwise have created wrong — see section 3.
--
-- It also adds profiles.country, which the "replace Region with Country"
-- work needs and which has never existed (country was only ever written to
-- auth.users.raw_user_meta_data).
-- ============================================


-- --------------------------------------------
-- 1. phase7 — relax NOT NULL on the heavy registration fields
-- --------------------------------------------
-- The pay-first flow inserts a stub application BEFORE these are known; they
-- are filled in after payment via ApplicationForm. DROP NOT NULL is a no-op if
-- already dropped.
ALTER TABLE public.applications ALTER COLUMN company_name DROP NOT NULL;
ALTER TABLE public.applications ALTER COLUMN industry     DROP NOT NULL;
ALTER TABLE public.applications ALTER COLUMN scope        DROP NOT NULL;


-- --------------------------------------------
-- 2. phase8 — pricing surcharge columns
-- --------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS additional_employee_bands integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS additional_locations      integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_amount              numeric(10,2);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_additional_employee_bands_nonneg') THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_additional_employee_bands_nonneg
      CHECK (additional_employee_bands >= 0);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'applications_additional_locations_nonneg') THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_additional_locations_nonneg
      CHECK (additional_locations >= 0);
  END IF;
END $$;


-- --------------------------------------------
-- 3. phase11 — payment method / status columns (with CORRECTED constraints)
-- --------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text;

-- Two corrections against phase11 as written. Had phase11 been applied as-is,
-- checkout would still have failed with 23514 CHECK violations:
--
--   payment_method: phase11 allowed ('card','paypal','moneygram','bank_transfer')
--     but src/config/paymentMethods.js now ships 'cash' and dropped paypal /
--     moneygram. 'cash' must be allowed or every cash order dies. paypal and
--     moneygram stay permitted so historical rows remain valid.
--
--   payment_status: phase11 allowed ('pending','awaiting_verification',
--     'verified','unpaid') but api/checkout.js:367 and
--     src/pages/client/ApplicationForm.jsx:194 both write 'paid' after a
--     successful Stripe payment. 'paid' must be allowed.
DO $$
BEGIN
  ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_payment_method_check;
  ALTER TABLE public.applications
    ADD CONSTRAINT applications_payment_method_check
    CHECK (payment_method IS NULL OR payment_method IN
      ('card', 'cash', 'bank_transfer', 'paypal', 'moneygram'));

  ALTER TABLE public.applications DROP CONSTRAINT IF EXISTS applications_payment_status_check;
  ALTER TABLE public.applications
    ADD CONSTRAINT applications_payment_status_check
    CHECK (payment_status IS NULL OR payment_status IN
      ('pending', 'awaiting_verification', 'verified', 'paid', 'unpaid'));
END $$;

-- Admins filter the queue of offline payments that still need a manual check.
CREATE INDEX IF NOT EXISTS idx_applications_payment_status
  ON public.applications (payment_status)
  WHERE payment_status = 'awaiting_verification';


-- --------------------------------------------
-- 4. profiles.country
-- --------------------------------------------
-- The client asked for Region to be replaced by Country across every user type.
-- `country` has never been a profiles column: signup captured it and wrote it
-- only to auth.users.raw_user_meta_data (api/create-user.js:68, api/user.js:76),
-- while profiles stored the derived `region` instead.
--
-- `region` is deliberately LEFT IN PLACE by this migration. Dropping it would
-- break every admin list view, api/_verifyAdmin.js scoping and the RLS policies
-- that reference it, all in one shot. Country is populated first; region is
-- retired in a later phase once the UI no longer reads it.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS country text;

-- Backfill from the only place the value was ever persisted.
UPDATE public.profiles p
SET country = NULLIF(TRIM(u.raw_user_meta_data ->> 'country'), '')
FROM auth.users u
WHERE u.id = p.id
  AND p.country IS NULL
  AND NULLIF(TRIM(u.raw_user_meta_data ->> 'country'), '') IS NOT NULL;

-- Admin list views filter and sort by country.
CREATE INDEX IF NOT EXISTS idx_profiles_country ON public.profiles (country);


-- --------------------------------------------
-- 5. Verification
-- --------------------------------------------
-- Expect 6 rows; anything missing means this migration did not fully apply.
--   applications: additional_employee_bands, additional_locations,
--                 total_amount, payment_method, payment_status
--   profiles:     country
SELECT table_name, column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
    (table_name = 'applications' AND column_name IN
      ('additional_employee_bands','additional_locations','total_amount','payment_method','payment_status'))
    OR (table_name = 'profiles' AND column_name = 'country')
  )
ORDER BY table_name, column_name;

-- How many profiles still have no country after the backfill (these are the
-- admin-created users and consultation signups that never captured one):
--   SELECT count(*) FROM public.profiles WHERE country IS NULL;
