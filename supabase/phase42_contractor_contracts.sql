-- =====================================================================
-- phase42 — Contractor role: structured tri-party contracts
-- =====================================================================
--
-- Replaces the generic-checkbox "I accept the contract" design from
-- phase41 (contractor_contract_acceptances) with a proper structured
-- contract authored per-contractor by an admin: job scope, compensation,
-- KPIs, dates. Per explicit client correction, a contractor does not
-- blindly sign a one-size-fits-all agreement at registration; instead an
-- admin drafts a SPECIFIC contract for a SPECIFIC approved contractor and
-- the two of them (plus the fixed WCA GLOBAL company) sign it.
--
-- contractor_contract_acceptances (phase41) is now DEPRECATED and unused
-- — the registration-time code that wrote to it has been removed — but
-- it is left in place untouched; this migration contains no destructive
-- statements and does not reference that table.
--
-- Three signing parties, all recorded in contractor_contract_signatures:
--   * wca_global  — a FIXED company, not a dynamic user account. Its
--     signature is auto-recorded by the admin (acting on its behalf)
--     the moment the contract is sent.
--   * contractor  — the individual contractor, signs from their own
--     dashboard after reviewing the sent contract.
--   * platform    — Certify.cx, represented by an admin; recorded at
--     finalize time, which also generates the PDF and flips the
--     contract to 'signed'.
--
-- Workflow / status machine on contractor_contracts.status:
--   draft -> pending_signatures -> signed
--                                -> terminated (from signed, or earlier)
--   draft:               admin is still authoring the contract.
--   pending_signatures:  admin has sent it; wca_global signature is
--                         auto-recorded at this transition; waiting on
--                         the contractor to sign from their dashboard.
--   signed:              admin finalized — platform signature recorded,
--                         pdf_storage_path populated, PDF generated.
--   terminated:          contract ended early (not modeled further here).
--
-- Both new tables and the new `contractor-contract-pdfs` bucket are
-- written/read exclusively via the service role from api/user.js — there
-- is no admin or contractor UI planned yet that queries Supabase directly
-- for these two tables. Same fail-closed pattern as whop_webhook_events
-- (phase40) and contractor_documents / contractor_contract_acceptances
-- (phase41): RLS enabled, zero policies — NOT the owner-scoped
-- auditor_documents (phase24) pattern.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. contractor_contracts — one row per authored contract
-- ---------------------------------------------------------------------
-- reference is generated in application code (e.g. 'WCA-<timestamp>-
-- <random>'), not by the DB, but is unique/not-null here so the API can
-- rely on a 23505 unique-violation signaling a collision to retry on.
CREATE TABLE IF NOT EXISTS public.contractor_contracts (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reference             text NOT NULL UNIQUE,
  contractor_id         uuid NOT NULL REFERENCES public.profiles(id),
  status                text NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_signatures', 'signed', 'terminated')),

  job_title             text,
  job_description       text,
  key_responsibilities  text,

  -- Free text, admin-typed (e.g. 'per_task', 'hourly', 'fixed_monthly') —
  -- deliberately no CHECK constraint so admins aren't blocked by an
  -- incomplete enum.
  compensation_type     text,
  compensation_rate     numeric,
  compensation_currency text DEFAULT 'USD'
                        CHECK (compensation_currency IN ('INR', 'USD')),
  payment_schedule      text,

  -- Array of {description, target, measurement, consequence} objects.
  kpi_definitions       jsonb NOT NULL DEFAULT '[]'::jsonb,

  jurisdiction          text,
  notice_period_days    integer,
  start_date            date,
  end_date              date,

  -- Populated only once the contract is finalized (status = 'signed').
  pdf_storage_path      text,

  created_by            uuid REFERENCES public.profiles(id),
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_contracts_contractor_idx
  ON public.contractor_contracts (contractor_id);

CREATE INDEX IF NOT EXISTS contractor_contracts_status_idx
  ON public.contractor_contracts (status);

-- Service-role only (see header). Enabling RLS with no policy blocks
-- every browser-side (anon/authenticated) request by default.
ALTER TABLE public.contractor_contracts ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 2. contractor_contract_signatures — one signature per party per contract
-- ---------------------------------------------------------------------
-- signed_by is NOT NULL here, unlike the phase41 registration-bootstrap
-- tables: every signer in this flow already has a session — the admin
-- for wca_global/platform, the contractor themselves for contractor —
-- so there is no unauthenticated-write case to accommodate.
CREATE TABLE IF NOT EXISTS public.contractor_contract_signatures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id   uuid NOT NULL REFERENCES public.contractor_contracts(id) ON DELETE CASCADE,
  party_role    text NOT NULL CHECK (party_role IN ('wca_global', 'contractor', 'platform')),
  signed_name   text NOT NULL,
  signed_by     uuid NOT NULL REFERENCES public.profiles(id),
  accepted_ip   text,
  signed_at     timestamptz DEFAULT now(),
  UNIQUE (contract_id, party_role)
);

-- Service-role only, same fail-closed pattern as contractor_contracts above.
ALTER TABLE public.contractor_contract_signatures ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------
-- 3. The private `contractor-contract-pdfs` bucket
-- ---------------------------------------------------------------------
-- Private: the finalized, three-party-signed legal PDF, served only
-- through short-lived signed URLs generated by the service role — kept
-- in its own bucket, separate from `contractor-documents` (phase41,
-- which holds ID/CV/photo), same reasoning as the dedicated `contracts`
-- bucket (phase23) used for consultancy/referral/auditor agreements.
-- Deliberately no storage.objects policy: the finalize action in
-- api/user.js is the only writer and uses the service role exclusively,
-- which bypasses RLS/storage policies automatically.
INSERT INTO storage.buckets (id, name, public)
SELECT 'contractor-contract-pdfs', 'contractor-contract-pdfs', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'contractor-contract-pdfs');

COMMIT;

-- Verify:
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name = 'contractor_contracts' ORDER BY ordinal_position;
--
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name = 'contractor_contract_signatures' ORDER BY ordinal_position;
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.contractor_contracts'::regclass;
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.contractor_contract_signatures'::regclass;
--
-- SELECT relrowsecurity FROM pg_class
--  WHERE relname IN ('contractor_contracts', 'contractor_contract_signatures');
--
-- SELECT policyname FROM pg_policies
--  WHERE tablename IN ('contractor_contracts', 'contractor_contract_signatures');
-- Expect: zero rows (no client-facing policy, service-role only).
--
-- SELECT id, public FROM storage.buckets WHERE id = 'contractor-contract-pdfs';
-- Expect exactly 1 row, public = false.
