-- =====================================================================
-- phase44 — Contractor role: two-step payment approval workflow
-- =====================================================================
--
-- phase42 (contractor_contracts) carries the agreed compensation_rate /
-- compensation_currency; phase43 (contractor_tasks) records individual
-- completed/missed work items. This phase adds the money step: an admin
-- raises a payment request for a specific amount owed to a contractor,
-- optionally tied to one completed task and/or one contract. Per the
-- client's explicit rule: "Do not treat a task's completion as automatic
-- financial approval. Keep admin approval and Finance approval as
-- separate steps."
--
-- In this implementation an admin RAISING the request already represents
-- the admin-approval step (an admin would not raise a request for work
-- that was not approved), so a row here starts life waiting on Finance,
-- not on a separate admin-approval status. A Finance-role user then
-- approves or rejects it; only on approval does the contractor see the
-- amount as credit. task_id and contract_id are both nullable because an
-- admin may raise an ad-hoc payment (e.g. a bonus) not tied to either.
--
-- Status machine on contractor_payments.status:
--   pending_finance -> approved
--                   -> rejected
--   pending_finance: default on insert by an admin (admin step implicit).
--   approved:        set by a Finance user; decided_by/decided_at filled.
--   rejected:        set by a Finance user; decided_by/decided_at/
--                     rejection_reason filled.
--
-- Same fail-closed RLS pattern as phase41/42/43 (RLS enabled, zero
-- policies, service-role only via api/user.js) — NOT the owner-scoped
-- auditor_documents (phase24) pattern. There is no admin, Finance, or
-- contractor UI planned yet that queries Supabase directly for this
-- table. No storage bucket is needed — no file uploads are involved in
-- raising or deciding a payment request.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. contractor_payments — one row per raised payment request
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contractor_payments (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contractor_id     uuid NOT NULL REFERENCES public.profiles(id),
  -- Optional link to the contract this payment is owed under. No ON
  -- DELETE behavior specified, matching contractor_tasks.contract_id
  -- (phase43): a contract should not be deletable out from under a
  -- payment history, and none of today's code deletes
  -- contractor_contracts rows.
  contract_id       uuid REFERENCES public.contractor_contracts(id),
  -- Optional link to the single completed task this payment covers.
  task_id           uuid REFERENCES public.contractor_tasks(id),

  amount            numeric NOT NULL CHECK (amount > 0),
  currency          text NOT NULL CHECK (currency IN ('INR', 'USD')),
  -- Admin-typed, free text: what this payment is for.
  description       text,

  -- Starts at 'pending_finance' because raising the request is itself
  -- the admin-approval step (see header) — there is no separate
  -- 'pending_admin' status to model.
  status            text NOT NULL DEFAULT 'pending_finance'
                    CHECK (status IN ('pending_finance', 'approved', 'rejected')),

  created_by        uuid NOT NULL REFERENCES public.profiles(id),
  -- Filled in only once a Finance user approves or rejects the request.
  decided_by        uuid REFERENCES public.profiles(id),
  decided_at        timestamptz,
  rejection_reason  text,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS contractor_payments_contractor_idx
  ON public.contractor_payments (contractor_id);

CREATE INDEX IF NOT EXISTS contractor_payments_status_idx
  ON public.contractor_payments (status);

-- Service-role only (see header). Enabling RLS with no policy blocks
-- every browser-side (anon/authenticated) request by default — fail
-- closed, same as whop_webhook_events (phase40) and the phase41/42/43
-- contractor tables.
ALTER TABLE public.contractor_payments ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verify:
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name = 'contractor_payments' ORDER BY ordinal_position;
--
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
--  WHERE conrelid = 'public.contractor_payments'::regclass;
--
-- SELECT indexname FROM pg_indexes WHERE tablename = 'contractor_payments';
--
-- SELECT relrowsecurity FROM pg_class WHERE relname = 'contractor_payments';
--
-- SELECT policyname FROM pg_policies WHERE tablename = 'contractor_payments';
-- Expect: zero rows (no client-facing policy, service-role only).
