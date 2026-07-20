-- =====================================================================
-- phase22 — Consultancy becomes its own role (supersedes phase19)
-- =====================================================================
--
-- Client instruction, 21 Jul: "Do not classify as referral, since the
-- consultancies will get 25% on each Client whom they onboard & register
-- in certify.cx platform & need to follow up with client to complete
-- payment."
--
-- Phase 19 read the 19 Jul instruction ("Consultancy can have the same
-- process features as Referral/Affiliate") as "make it the referral role".
-- That was the wrong lever: it gave consultancies the right SCREENS but
-- made them indistinguishable from affiliates in every count, filter and
-- commission rule. Two visible consequences:
--
--   * the Main Dashboard "Consultancies" box read 0, because it counts
--     role='client' AND stakeholder_type='consultancy' and no such row can
--     exist after phase 19;
--   * the "Referrals" box absorbed them, so that figure was inflated.
--
-- This migration gives consultancy its own role. The screens stay shared
-- (ROLE_PERMISSIONS grants it the same VIEW_REFERRALS); what it gains is
-- the ability to be counted, filtered and priced separately.
--
-- `stakeholder_type` stays 'consultancy' throughout and remains the stable
-- identifier — it survived both role moves.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Before / after — run this first and keep the output
-- ---------------------------------------------------------------------
-- SELECT role, stakeholder_type, count(*)
--   FROM public.profiles
--  GROUP BY 1,2
--  ORDER BY 1,2;
--
-- Expect to see a `referral / consultancy` group. That group is what
-- section 2 moves. If you also see a LARGE `referral / client` group,
-- STOP — that would mean phase19 ran without its stakeholder_type filter
-- and converted ordinary clients. Tell us before continuing.

-- ---------------------------------------------------------------------
-- 1. Widen the two CHECK constraints that enumerate roles
-- ---------------------------------------------------------------------
-- profiles.role itself has NO check constraint (see phase14 §1), but these
-- two do, and both would reject 'consultancy':
--   * custom_permissions.role — the Roles & Permissions toggles write here,
--     so without this the new Consultancy column cannot be saved.
--   * documents.uploader_role — consultancy document uploads would fail.

DO $$
BEGIN
  ALTER TABLE public.custom_permissions
    DROP CONSTRAINT IF EXISTS custom_permissions_role_check;
  ALTER TABLE public.custom_permissions
    ADD CONSTRAINT custom_permissions_role_check
    CHECK (role IN ('super_admin','regional_admin','auditor',
                    'certification_body','client','referral','consultancy'));
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'custom_permissions does not exist yet - skipping';
END $$;

DO $$
BEGIN
  ALTER TABLE public.documents
    DROP CONSTRAINT IF EXISTS documents_uploader_role_check;
  ALTER TABLE public.documents
    ADD CONSTRAINT documents_uploader_role_check
    CHECK (uploader_role IS NULL OR uploader_role IN
           ('super_admin','regional_admin','auditor',
            'certification_body','client','referral','consultancy'));
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'documents does not exist yet - skipping';
END $$;

-- ---------------------------------------------------------------------
-- 2. Move existing consultancies onto the new role
-- ---------------------------------------------------------------------
-- Covers BOTH prior states: rows phase19 moved to 'referral', and any row
-- that never went through phase19 and is still on 'client'.
--
-- The stakeholder_type filter is what keeps this surgical — without it
-- this statement would convert every referral and every client in the
-- system. Do not remove it.

UPDATE public.profiles
   SET role = 'consultancy'
 WHERE stakeholder_type = 'consultancy'
   AND role IN ('referral', 'client');

-- ---------------------------------------------------------------------
-- 3. Consultancy commission rate
-- ---------------------------------------------------------------------
-- 25% of the net sale, per the client. commission_percent_override was
-- added in phase20 and is read by getReferrerTier in api/checkout.js,
-- which returns it ahead of the tier ladder.
--
-- Seeded for every consultancy. If the 25% was negotiated with WCA GLOBAL
-- specifically rather than being the standard consultancy rate, set the
-- others individually instead — this is an open question with the client.

UPDATE public.profiles
   SET commission_percent_override = 25
 WHERE stakeholder_type = 'consultancy'
   AND commission_percent_override IS DISTINCT FROM 25;

-- ---------------------------------------------------------------------
-- 4. Verify
-- ---------------------------------------------------------------------
-- SELECT role, stakeholder_type, count(*), min(commission_percent_override)
--   FROM public.profiles
--  GROUP BY 1,2
--  ORDER BY 1,2;
--
-- Expect: a `consultancy / consultancy` group with override 25, and NO
-- remaining `referral / consultancy` group.
