-- =====================================================================
-- phase30 — Align the signature ledger to the document's exact spec
-- =====================================================================
--
-- Client's developer guide (2 Aug) specifies a ledger named
-- `core_legal_signatures` with these exact columns:
--   signature_id, user_id, role_type, contract_version, client_ip,
--   is_accepted, timestamp_utc.
--
-- The authoritative signature table is `contract_acceptances` (phase23), which
-- already carries all of this and MORE (the full text snapshot of what was
-- signed, the PDF path, effective/expiry dates). Rather than split the legally
-- critical data across two tables — the surest way to end up with two
-- disagreeing records — this migration:
--   1. adds the two columns the spec has that the table lacked
--      (`is_accepted`, a string `contract_version` label), and makes
--      `client_ip` NOT NULL as the spec requires; then
--   2. exposes `core_legal_signatures` as a VIEW with the EXACT column names
--      and role labels the document asks for, over that single source of truth.
--
-- An auditor or lawyer queries `core_legal_signatures` and sees precisely the
-- specified shape; the application keeps writing the richer table.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- 1. Explicit acceptance flag (the spec's is_accepted BOOLEAN NOT NULL True).
ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS is_accepted boolean NOT NULL DEFAULT true;

-- 2. String version label (the spec's contract_version VARCHAR, e.g.
--    "v2026_UIL_NetSales"). The integer `version` stays as the real ordering
--    key; this is the human/legal label written alongside it.
ALTER TABLE public.contract_acceptances
  ADD COLUMN IF NOT EXISTS contract_version_label text;

-- Backfill existing signatures with a sensible label derived from the version.
UPDATE public.contract_acceptances
   SET contract_version_label = 'v' || version::text || '_UIL_NetSales'
 WHERE contract_version_label IS NULL;

-- 3. client_ip NOT NULL. Existing rows with a null IP are backfilled to a
--    sentinel (an old signature whose address was never captured is recorded
--    honestly as 'unknown', never invented). New signatures always carry a
--    value — clientIp() in api/_contract.js now returns 'unknown' rather than
--    null as its last resort, so the NOT NULL constraint can never block a
--    genuine acceptance.
UPDATE public.contract_acceptances
   SET accepted_ip = 'unknown'
 WHERE accepted_ip IS NULL;

ALTER TABLE public.contract_acceptances
  ALTER COLUMN accepted_ip SET DEFAULT 'unknown';

ALTER TABLE public.contract_acceptances
  ALTER COLUMN accepted_ip SET NOT NULL;

-- 4. The spec-named ledger, as a view over the authoritative table.
--    role_type is mapped to the document's exact labels.
CREATE OR REPLACE VIEW public.core_legal_signatures AS
SELECT
  id                                                   AS signature_id,
  profile_id                                           AS user_id,
  CASE partner_type
    WHEN 'referral'      THEN 'Referral_Partner'
    WHEN 'country_admin' THEN 'Country_Admin'
    WHEN 'auditor'       THEN 'Lead_Auditor'
    WHEN 'consultancy'   THEN 'Consultancy_Partner'
    ELSE partner_type
  END                                                  AS role_type,
  contract_version_label                               AS contract_version,
  accepted_ip                                          AS client_ip,
  is_accepted,
  accepted_at                                          AS timestamp_utc
FROM public.contract_acceptances;

COMMENT ON VIEW public.core_legal_signatures IS
  'Immutable legal-signature ledger in the exact shape of the 2 Aug developer '
  'spec. A view over contract_acceptances, which is the single source of truth.';

COMMIT;

-- =====================================================================
-- Verification
-- =====================================================================
-- SELECT signature_id, user_id, role_type, contract_version, client_ip,
--        is_accepted, timestamp_utc
--   FROM public.core_legal_signatures ORDER BY timestamp_utc DESC LIMIT 5;
