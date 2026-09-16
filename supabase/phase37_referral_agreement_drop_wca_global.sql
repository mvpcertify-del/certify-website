-- =====================================================================
-- phase37 - Referral partner agreement: drop "WCA GLOBAL" branding
-- =====================================================================
--
-- Client, 15 Sep: "Remove completely WCA GLOBAL from the Agreement since it
-- might confuse the Partners. We will just focus on certify.cx(TM). The Logo
-- & Certify.cx(TM) can be displayed." This was tested against the REFERRAL
-- partner agreement specifically (the one shown in the client's screenshot),
-- seeded originally by phase29_partner_agreements_all_roles.sql.
--
-- "WCA GLOBAL" appears twice in that seed: once in the title column
-- ("WCA GLOBAL Referral Partner Agreement") and twice in the body column
-- (the opening line "WCA GLOBAL REFERRAL PARTNER AGREEMENT" and the parties
-- clause 'Parties: WCA GLOBAL (the "Company")'). Everywhere else the body
-- already says "the Company" generically, so nothing else needs to change.
--
-- NOTE - deliberately NOT touched: the country_admin, auditor, and
-- consultancy contract_templates rows (also seeded by phase29) carry the
-- exact same "WCA GLOBAL" wording in their title/body. The client's request
-- was scoped to the referral agreement only. Those three are left alone
-- pending a separate decision on whether to rebrand them too.
--
-- This is a content correction to the existing active version, not a new
-- version: version and is_active are untouched, only title/body text changes.
--
-- Idempotent: replace() is a no-op once the body no longer contains
-- "WCA GLOBAL", so this is safe to run more than once.
-- =====================================================================

BEGIN;

UPDATE public.contract_templates
SET
  title = 'Certify.cx Referral Partner Agreement',
  body = replace(
           replace(
             body,
             'WCA GLOBAL REFERRAL PARTNER AGREEMENT',
             'CERTIFY.CX REFERRAL PARTNER AGREEMENT'
           ),
           'Parties: WCA GLOBAL (the "Company")',
           'Parties: Certify.cx (the "Company")'
         )
WHERE partner_type = 'referral'
  AND is_active = true;

COMMIT;

-- Verify:
-- SELECT title, body FROM public.contract_templates
--  WHERE partner_type = 'referral' AND is_active = true;
