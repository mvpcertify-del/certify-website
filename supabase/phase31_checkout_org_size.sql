-- =====================================================================
-- phase31 — Store the organization size the buyer actually entered
-- =====================================================================
--
-- The public checkout now asks the buyer for their real headcount and number
-- of sites (16 Aug), instead of silently pricing every order as a 50-employee
-- single-site organization. api/checkout.js writes those two figures to
-- applications.employee_count / applications.locations_count alongside the
-- pricing bands it already wrote.
--
-- Both columns are part of the original applications table, so on almost every
-- database this file changes NOTHING. It exists because of the 15 Aug outage:
-- phase28 had shipped in the repo since July and had never been run here, and
-- PostgREST rejects the ENTIRE insert when one named column is missing — so an
-- absent column would take the whole checkout down, not just lose a number.
-- Thirty seconds of certainty is cheaper than finding out from a buyer.
--
-- Idempotent and non-destructive: ADD COLUMN IF NOT EXISTS never touches an
-- existing column or its data. Safe to run on production, and safe to re-run.
--
-- Supabase dashboard -> SQL Editor -> New query -> paste -> Run.
-- =====================================================================

ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS employee_count   integer,
  ADD COLUMN IF NOT EXISTS locations_count  integer;

COMMENT ON COLUMN public.applications.employee_count IS
  'Total headcount as entered by the buyer at checkout. The audit scope figure; '
  'additional_employee_bands is the billing approximation derived from it.';

COMMENT ON COLUMN public.applications.locations_count IS
  'Total number of sites as entered by the buyer at checkout. The audit scope '
  'figure; additional_locations is the billing approximation derived from it.';

-- PostgREST serves the API from a cached copy of the schema and refreshes it on
-- its own schedule, so an ALTER TABLE alone can leave inserts failing with
-- "Could not find the '...' column ... in the schema cache" for minutes after
-- the migration succeeded. Ask for the reload explicitly.
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Verification — should return exactly two rows
-- =====================================================================
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'applications'
--    AND column_name IN ('employee_count', 'locations_count');
