-- ============================================================================
-- Phase 19 — Give Consultancy the same feature set as Referral / Affiliate
-- ============================================================================
-- Client instruction, 19 Jul: "Consultancy can have the same process features
-- as Referral/Affiliate."
--
-- Until now a consultancy was a `client` row carrying
-- stakeholder_type = 'consultancy'. That gave it the WRONG menu — New
-- Application, My Certificates and the "Take your free Gap Analysis" prompt,
-- all of which belong to a company seeking its own certificate — and gave it NO
-- way to add or track the clients it introduces, and no commission view. This
-- is exactly the situation Phase 14 fixed for referral partners, so this
-- migration applies the same treatment.
--
-- stakeholder_type is deliberately left as 'consultancy' so the display label
-- stays "Consultancy" (see STAKEHOLDER_DISPLAY_LABELS in src/utils/roles.js)
-- and so the origin of each row remains traceable.
--
-- No CHECK constraints need widening — Phase 14 already added 'referral' to
-- custom_permissions_role_check and documents_uploader_role_check, and
-- profiles.role has no CHECK constraint at all.
--
-- The RLS policies on public.referrals from Phase 14 (referrals_owner_select /
-- referrals_owner_insert, scoped to referrer_id = auth.uid()) are role-agnostic,
-- so migrated consultancies pick them up automatically.
--
-- PREREQUISITE: phase14_referral_role.sql must have been run first.
-- Fully idempotent — safe to run more than once.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Backfill existing consultancy partners to the referral role
-- ----------------------------------------------------------------------------
UPDATE public.profiles
   SET role = 'referral'
 WHERE role = 'client'
   AND stakeholder_type = 'consultancy';

-- ----------------------------------------------------------------------------
-- Verification — expect every consultancy row to report role = 'referral'
-- ----------------------------------------------------------------------------
-- SELECT email, role, stakeholder_type
--   FROM public.profiles
--  WHERE stakeholder_type = 'consultancy';
