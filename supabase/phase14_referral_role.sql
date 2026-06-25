-- ============================================================================
-- Phase 14 — Promote "Referral" from a client stakeholder_type to a real role
-- ============================================================================
-- Until now a referral partner was a `client` row carrying
-- stakeholder_type = 'referral'. The client wants Referral to be its own role
-- (6th role, shown next to Client). This migration makes the DB ready for that:
--
--   1. Widen the role CHECK constraints that hard-code the old 5-role list so
--      'referral' is a legal value (otherwise the Roles & Permissions matrix
--      can't save a referral override, and referral document uploads would
--      fail the uploader_role check).
--   2. Backfill existing referral partners: client + stakeholder_type='referral'
--      -> role='referral' (stakeholder_type is left intact for traceability).
--   3. Allow a logged-in referral to read AND create their own referral rows
--      (the "upload the clients I refer" feature) via additive RLS policies
--      scoped to referrer_id = auth.uid(). Service-role API paths are unaffected.
--
-- profiles.role itself has NO check constraint, so no change is needed there.
-- Fully idempotent — safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Widen role CHECK constraints to include 'referral'
-- ----------------------------------------------------------------------------
ALTER TABLE public.custom_permissions
  DROP CONSTRAINT IF EXISTS custom_permissions_role_check;
ALTER TABLE public.custom_permissions
  ADD CONSTRAINT custom_permissions_role_check
  CHECK (role = ANY (ARRAY[
    'super_admin'::text, 'regional_admin'::text, 'auditor'::text,
    'certification_body'::text, 'client'::text, 'referral'::text
  ]));

ALTER TABLE public.documents
  DROP CONSTRAINT IF EXISTS documents_uploader_role_check;
ALTER TABLE public.documents
  ADD CONSTRAINT documents_uploader_role_check
  CHECK (uploader_role IS NULL OR uploader_role = ANY (ARRAY[
    'client'::text, 'super_admin'::text, 'regional_admin'::text,
    'auditor'::text, 'certification_body'::text, 'referral'::text
  ]));

-- ----------------------------------------------------------------------------
-- 2. Backfill existing referral partners to the new role
-- ----------------------------------------------------------------------------
UPDATE public.profiles
   SET role = 'referral'
 WHERE role = 'client'
   AND stakeholder_type = 'referral';

-- ----------------------------------------------------------------------------
-- 3. Capture the referred client's details the partner types in
--    ("upload the information of the clients they refer"). referred_email
--    already exists; add name + company. Both nullable / idempotent.
-- ----------------------------------------------------------------------------
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referred_name text;
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referred_company text;

-- ----------------------------------------------------------------------------
-- 4. RLS: a referral may read & create their own referral rows
--    (additive; service-role API paths bypass RLS and are unaffected)
-- ----------------------------------------------------------------------------
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "referrals_owner_select" ON public.referrals;
CREATE POLICY "referrals_owner_select"
  ON public.referrals
  FOR SELECT
  USING (referrer_id = auth.uid());

DROP POLICY IF EXISTS "referrals_owner_insert" ON public.referrals;
CREATE POLICY "referrals_owner_insert"
  ON public.referrals
  FOR INSERT
  WITH CHECK (referrer_id = auth.uid());

-- Super admins retain full visibility of every referral row.
DROP POLICY IF EXISTS "referrals_super_admin_all" ON public.referrals;
CREATE POLICY "referrals_super_admin_all"
  ON public.referrals
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ));
