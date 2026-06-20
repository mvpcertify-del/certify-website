-- Phase 12: Certification Body address + per-standard IAF codes
--
-- Client requirements (ICL / EGAC accreditation schedule):
--   1. Store the CB's full address.
--   2. Each ISO standard carries its OWN set of IAF sector codes
--      (the same code may appear under more than one standard).
--
-- Idempotent: safe to run more than once.

BEGIN;

-- 1) Full address on the certification body ------------------------------------
ALTER TABLE public.certification_bodies
  ADD COLUMN IF NOT EXISTS address text;

-- 2) Make cb_iaf_codes per-standard --------------------------------------------
-- Old shape: PRIMARY KEY (cb_id, iaf_code)  -> a code could only exist once per CB.
-- New shape: a code can repeat across standards, so we move to a surrogate id PK
-- plus a uniqueness rule on (cb_id, iso_standard, iaf_code).

ALTER TABLE public.cb_iaf_codes
  ADD COLUMN IF NOT EXISTS iso_standard text;

ALTER TABLE public.cb_iaf_codes
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

-- Backfill ids for any pre-existing rows.
UPDATE public.cb_iaf_codes SET id = gen_random_uuid() WHERE id IS NULL;
ALTER TABLE public.cb_iaf_codes ALTER COLUMN id SET NOT NULL;

-- Swap the primary key from (cb_id, iaf_code) to (id).
ALTER TABLE public.cb_iaf_codes DROP CONSTRAINT IF EXISTS cb_iaf_codes_pkey;
ALTER TABLE public.cb_iaf_codes ADD CONSTRAINT cb_iaf_codes_pkey PRIMARY KEY (id);

-- One code per (CB, standard). NULL iso_standard rows are legacy/CB-level and
-- are treated as distinct by the unique index (Postgres NULL semantics).
CREATE UNIQUE INDEX IF NOT EXISTS cb_iaf_codes_cb_std_code_uniq
  ON public.cb_iaf_codes (cb_id, iso_standard, iaf_code);

COMMIT;
