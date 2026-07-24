-- =====================================================================
-- phase26 — Hardening for the phase25 referral-code functions
-- =====================================================================
--
-- phase25 has already been applied in production. This is the follow-up for
-- two defects found by an adversarial review of that migration, so it is a
-- separate file rather than an edit to phase25.
--
-- ---------------------------------------------------------------------
-- DEFECT 1 — the uniqueness check was RLS-blind, so it did not check.
-- ---------------------------------------------------------------------
-- generate_referral_code() was created SECURITY INVOKER (the default). Its
-- collision test is:
--
--     SELECT 1 FROM public.profiles WHERE referral_code = candidate
--
-- Run as the caller, that SELECT is filtered by row-level security. When a
-- partner registers, the caller is `authenticated` and can typically see only
-- their own profile row — so the query returns nothing no matter what code is
-- already taken, the loop exits on its first candidate, and the "uniqueness"
-- guarantee is decorative.
--
-- A genuine collision then surfaces as a raw 23505 from
-- profiles_referral_code_key with no retry, and because the trigger is BEFORE
-- INSERT on profiles, that aborts the whole statement: the partner's signup
-- fails with an opaque error and no profile row is created at all.
--
-- SECURITY DEFINER makes the check see every row, which is the only way it can
-- do its job. `SET search_path` is mandatory alongside it — without it a
-- caller could point `public` at a schema of their own and have the function
-- read their table instead of ours.
--
-- ---------------------------------------------------------------------
-- DEFECT 2 — exhaustion aborted the caller's INSERT.
-- ---------------------------------------------------------------------
-- On 50 collisions the function did RAISE EXCEPTION. Firing inside a BEFORE
-- INSERT trigger, that does not merely skip the code — it kills the profile
-- write. Astronomically unlikely once defect 1 is fixed, but the failure mode
-- was disproportionate: a cosmetic field taking down account creation.
--
-- It now falls back to a UUID-derived code, which cannot collide in practice
-- and cannot fail. Signup completes either way.
--
-- Also corrects the phase25 comment arithmetic: the alphabet is 31 characters,
-- not 28, so the space is 31^6 ≈ 887 million.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';  -- 31 chars; 0 O 1 I L removed
  candidate text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    candidate := 'REF-';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    END LOOP;

    -- Now genuinely checks every row, not just the ones the caller can see.
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE referral_code = candidate
    );

    attempts := attempts + 1;
    IF attempts > 50 THEN
      -- Fall back rather than raise. This runs inside a BEFORE INSERT trigger
      -- on profiles, so raising here would abort account creation entirely.
      RETURN 'REF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- The trigger function calls the generator, so it needs the same treatment:
-- as INVOKER it would run the assignment under the caller's rights.
CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.referral_code IS NULL
     AND (
       NEW.role IN ('referral', 'consultancy')
       OR NEW.stakeholder_type IN ('referral', 'consultancy')
     )
  THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Tighten the phase25 policy to authenticated only. It was created without a
-- TO clause, so it defaulted to PUBLIC (including anon). That leaked nothing
-- in practice — auth.uid() is NULL for anon, and `referrer_id = NULL` is NULL,
-- never TRUE — but a policy that names its audience is a policy that cannot be
-- misread later.
DROP POLICY IF EXISTS discount_coupons_partner_read ON public.discount_coupons;
CREATE POLICY discount_coupons_partner_read ON public.discount_coupons
  FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

COMMIT;

-- =====================================================================
-- Verification — run after applying
-- =====================================================================
-- SELECT proname, prosecdef, proconfig
--   FROM pg_proc
--  WHERE proname IN ('generate_referral_code', 'ensure_referral_code');
--
-- Expect: prosecdef = true and proconfig = {"search_path=public, pg_temp"}
-- for both rows.
--
-- SELECT referral_code, count(*)
--   FROM public.profiles
--  WHERE referral_code IS NOT NULL
--  GROUP BY referral_code HAVING count(*) > 1;
--
-- Expect: 0 rows. Any row here is a collision that slipped through while the
-- generator was RLS-blind, and must be reissued by hand.
