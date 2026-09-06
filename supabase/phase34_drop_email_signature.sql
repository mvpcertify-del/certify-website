-- =====================================================================
-- phase34 — Remove the partner-editable email signature
-- =====================================================================
--
-- Client instruction (6 Sep):
--   "Edit Signature to be DELETED for all types of registrations / for all
--    users to be deleted (Existing & New)"
--
-- The "Edit Signature" button on the Referral Program screen let a partner
-- type free text that was then appended to mail leaving the certify.cx domain.
-- The button, its modal, and the `save-signature` API action are gone in the
-- same change; this file removes the stored text, which is the "Existing" half
-- of the instruction. Without it, every signature typed before today would keep
-- going out on partner mail even though nobody can edit or see it any more.
--
-- Partner mail now signs off with profiles.full_name — the name the company
-- already holds on the signed partner agreement.
--
-- Two steps, deliberately in this order:
--   1. Blank the column, so the data is gone even if step 2 is refused.
--   2. Drop the column, so no future code path can re-introduce it.
--
-- Idempotent: safe to run more than once. Both statements are no-ops on a
-- database where the column has already been dropped.
-- =====================================================================

-- 1. Clear every stored signature (existing users).
UPDATE public.profiles
   SET email_signature = NULL
 WHERE email_signature IS NOT NULL;

-- 2. Remove the column itself (new users can never acquire one).
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS email_signature;

-- PostgREST caches the schema; ask for the reload rather than waiting it out.
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Verification
-- =====================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name = 'email_signature';  -- 0 rows
