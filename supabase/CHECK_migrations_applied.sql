-- =====================================================================
-- Which migrations have actually been applied to THIS database?
-- =====================================================================
--
-- Migrations in this project are run by hand, and nothing records which ones
-- have been run. That is how the 15 Aug 2026 outage happened: phase28 shipped
-- in the repo in July, was never run here, and the Referral "Add Client" form
-- was broken for weeks with no warning anywhere.
--
-- This file answers the question directly. It is READ-ONLY: it creates, alters
-- and deletes nothing, and is safe to run on production at any time.
--
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
--
-- Read the `status` column. Every row should say APPLIED. Any row saying
-- MISSING names a migration still to be run; `detail` says what is absent.
--
-- Every check below reads only the system catalogue, so it reports MISSING
-- rather than erroring when a whole table is absent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- QUERY 1 of 2 — schema structure (phases 23-30)
-- ---------------------------------------------------------------------
WITH col(phase, detail, tbl, cname) AS (
  SELECT * FROM (VALUES
    ('phase24', 'profiles.auditor_standards',        'profiles',             'auditor_standards'),
    ('phase25', 'profiles.referral_code',            'profiles',             'referral_code'),
    ('phase25', 'applications.referral_code',        'applications',         'referral_code'),
    ('phase25', 'referrals.source',                  'referrals',            'source'),
    -- phase27's profiles.email_signature is deliberately NOT listed: phase34
    -- drops it again (client instruction, 6 Sep), so its ABSENCE is the
    -- healthy state and checking for it here would report a false failure.
    ('phase28', 'referrals.referred_whatsapp',       'referrals',            'referred_whatsapp'),
    ('phase28', 'referrals.referred_website',        'referrals',            'referred_website'),
    ('phase30', 'contract_acceptances.is_accepted',  'contract_acceptances', 'is_accepted'),
    ('phase30', 'contract_acceptances.contract_version_label',
                                                     'contract_acceptances', 'contract_version_label'),
    ('phase31', 'applications.employee_count',       'applications',         'employee_count'),
    ('phase31', 'applications.locations_count',      'applications',         'locations_count')
  ) AS v(phase, detail, tbl, cname)
),
rel(phase, detail, objname) AS (
  SELECT * FROM (VALUES
    ('phase23', 'contract_templates table',    'public.contract_templates'),
    ('phase23', 'contract_acceptances table',  'public.contract_acceptances'),
    ('phase23', 'consultancy_kpi view',        'public.consultancy_kpi'),
    ('phase24', 'auditor_documents table',     'public.auditor_documents'),
    ('phase27', 'referral_invites table',      'public.referral_invites'),
    ('phase30', 'core_legal_signatures view',  'public.core_legal_signatures')
  ) AS v(phase, detail, objname)
),
fn(phase, detail, procname) AS (
  SELECT * FROM (VALUES
    ('phase26', 'generate_referral_code() function', 'generate_referral_code'),
    ('phase26', 'ensure_referral_code() function',   'ensure_referral_code')
  ) AS v(phase, detail, procname)
),
results(phase, detail, present) AS (
  SELECT c.phase, c.detail,
         EXISTS (SELECT 1 FROM information_schema.columns i
                  WHERE i.table_schema = 'public'
                    AND i.table_name   = c.tbl
                    AND i.column_name  = c.cname)
    FROM col c
  UNION ALL
  SELECT r.phase, r.detail, to_regclass(r.objname) IS NOT NULL
    FROM rel r
  UNION ALL
  SELECT f.phase, f.detail,
         EXISTS (SELECT 1 FROM pg_proc p
                   JOIN pg_namespace n ON n.oid = p.pronamespace
                  WHERE n.nspname = 'public' AND p.proname = f.procname)
    FROM fn f
)
SELECT phase,
       CASE WHEN present THEN 'APPLIED' ELSE 'MISSING  <-- run this one' END AS status,
       detail
  FROM results
 ORDER BY phase, detail;


-- ---------------------------------------------------------------------
-- QUERY 2 of 2 — phase29 seed data (the three partner agreements)
--
-- Separate because it reads contract_templates, which phase23 creates. If
-- query 1 reports phase23 MISSING, skip this one: run phase23 first.
-- ---------------------------------------------------------------------
WITH want(phase, partner_type) AS (
  SELECT * FROM (VALUES
    ('phase23', 'consultancy'),    -- seeded by phase23, not phase29
    ('phase29', 'referral'),
    ('phase29', 'country_admin'),
    ('phase29', 'auditor')
  ) AS v(phase, partner_type)
)
SELECT w.phase,
       CASE WHEN EXISTS (SELECT 1 FROM public.contract_templates ct
                          WHERE ct.partner_type = w.partner_type)
            THEN 'APPLIED' ELSE 'MISSING  <-- run this one' END AS status,
       w.partner_type || ' agreement seeded' AS detail
  FROM want w
 ORDER BY w.phase, w.partner_type;
