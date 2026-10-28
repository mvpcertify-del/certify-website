-- =====================================================================
-- phase41 — Contractor role: self-registration docs + contract acceptance
-- =====================================================================
--
-- New stakeholder: self-registering "contractor" accounts (ID copy, CV,
-- photo upload + a placeholder contract acceptance), gated on admin
-- approval exactly like the existing auditor self-registration flow.
--
-- A contractor account is created 'pending' (AuthContext.signup) and is
-- never signed in during registration, so — same reasoning as the auditor
-- bootstrap window in phase24 — api/user.js's addContractorDocument and
-- acceptContractorContract accept token-less writes for a short window
-- right after account creation, bounded by created_at and a per-contractor
-- document cap (resolveContractorWriteAccess). Both functions write with
-- the service role exclusively; there is no admin screen that lists
-- contractor documents yet and no browser-side storage upload, so — unlike
-- auditor-documents (phase24), which does grant the auditor an owner-scoped
-- storage policy for direct upload — neither the two tables below nor the
-- `contractor-documents` bucket get any client-facing RLS/storage policy.
-- Both tables are enabled-RLS-with-no-policy, the same fail-closed pattern
-- used for whop_webhook_events (phase40).
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Widen the role CHECK constraints that enumerate roles
-- ---------------------------------------------------------------------
-- profiles.role itself has NO check constraint (see phase14 §1, phase19,
-- phase22 — confirmed still true). These two do, and both would reject
-- 'contractor':
--   * custom_permissions.role — the Roles & Permissions toggles write here,
--     so without this a Contractor column cannot be saved.
--   * documents.uploader_role — a contractor document upload through the
--     shared `documents` table would fail the check (contractor_documents
--     itself, added below, has no such constraint to widen).

DO $$
BEGIN
  ALTER TABLE public.custom_permissions
    DROP CONSTRAINT IF EXISTS custom_permissions_role_check;
  ALTER TABLE public.custom_permissions
    ADD CONSTRAINT custom_permissions_role_check
    CHECK (role IN ('super_admin','regional_admin','auditor',
                    'certification_body','client','referral','consultancy',
                    'contractor'));
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
            'certification_body','client','referral','consultancy',
            'contractor'));
EXCEPTION
  WHEN undefined_table THEN
    RAISE NOTICE 'documents does not exist yet - skipping';
END $$;

-- ---------------------------------------------------------------------
-- 2. contractor_documents — the ID copy / CV / photo register
-- ---------------------------------------------------------------------
-- Mirrors auditor_documents (phase24) column-for-column. uploaded_by is
-- nullable: NULL means the row was written during the unauthenticated
-- registration bootstrap window (resolveContractorWriteAccess, api/user.js),
-- same meaning it has on auditor_documents.
CREATE TABLE IF NOT EXISTS public.contractor_documents (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type       text NOT NULL CHECK (doc_type IN ('id_copy', 'cv', 'photo', 'other')),
  file_name      text NOT NULL,
  storage_path   text NOT NULL,
  mime_type      text,
  size_bytes     bigint,
  uploaded_by    uuid REFERENCES public.profiles(id),
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_documents_contractor_idx
  ON public.contractor_documents (contractor_id);

-- Service-role only (see header). Enabling RLS with no policy blocks every
-- browser-side (anon/authenticated) request by default — fail closed,
-- same as whop_webhook_events (phase40) — rather than relying on
-- application code alone to never query it directly.
ALTER TABLE public.contractor_documents ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. contractor_contract_acceptances — one signed-acceptance row per contractor
-- ---------------------------------------------------------------------
-- UNIQUE on contractor_id: acceptContractorContract (api/user.js) relies on
-- this, treating a 23505 unique-violation on retry as "already signed", not
-- an error.
CREATE TABLE IF NOT EXISTS public.contractor_contract_acceptances (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id  uuid NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Hardcoded placeholder until the client supplies the real signed
  -- agreement; see CONTRACTOR_CONTRACT_VERSION in api/user.js.
  version        text NOT NULL DEFAULT 'placeholder-v1',
  signed_name    text,
  accepted_ip    text,
  accepted_at    timestamptz NOT NULL DEFAULT now()
);

-- Service-role only, same fail-closed pattern as contractor_documents above.
ALTER TABLE public.contractor_contract_acceptances ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 4. The private `contractor-documents` bucket
-- ---------------------------------------------------------------------
-- Private: ID copies, CVs and photos are personal data, served only through
-- short-lived signed URLs generated by the service role — same pattern as
-- `auditor-documents` (phase24), `certificates` (phase9) and `contracts`
-- (phase23). Deliberately no storage.objects policy: addContractorDocument
-- (api/user.js) is the only writer and uses the service role exclusively,
-- which bypasses RLS/storage policies automatically; there is no browser
-- upload path and no admin screen that reads these objects directly yet.
INSERT INTO storage.buckets (id, name, public)
SELECT 'contractor-documents', 'contractor-documents', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'contractor-documents');

COMMIT;

-- Verify:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conname IN ('custom_permissions_role_check', 'documents_uploader_role_check');
--
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name = 'contractor_documents' ORDER BY ordinal_position;
--
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name = 'contractor_contract_acceptances' ORDER BY ordinal_position;
--
-- SELECT relrowsecurity FROM pg_class
--  WHERE relname IN ('contractor_documents', 'contractor_contract_acceptances');
--
-- SELECT policyname FROM pg_policies
--  WHERE tablename IN ('contractor_documents', 'contractor_contract_acceptances');
-- Expect: zero rows (no client-facing policy, service-role only).
--
-- SELECT id, public FROM storage.buckets WHERE id = 'contractor-documents';
-- Expect exactly 1 row, public = false.
