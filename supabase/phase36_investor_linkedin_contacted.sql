-- =====================================================================
-- phase36 - Investor LinkedIn outreach tracking
-- =====================================================================
--
-- The investors registry (phase35) already has is_active for whether a fund
-- is kept in the list at all. This is a different, narrower question: has
-- the Super Admin personally reached out to that fund's key partner / CEO on
-- LinkedIn yet? A fund can be active and never contacted, or contacted and
-- still active - the two flags are independent, so this is a new column
-- rather than repurposing is_active.
--
-- linkedin_contacted_at records when it was marked. Set/clear is handled in
-- application code when the admin toggles the flag, not by a trigger, so a
-- historical re-import or bulk fix can set both columns explicitly without a
-- trigger fighting it.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS linkedin_contacted    boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS linkedin_contacted_at timestamptz;

COMMENT ON COLUMN public.investors.linkedin_contacted IS
  'Whether the Super Admin has personally reached out to this fund''s key '
  'partner/CEO on LinkedIn. Independent of is_active: a fund can be active '
  'and uncontacted, or contacted and later deactivated. Added in phase36.';
COMMENT ON COLUMN public.investors.linkedin_contacted_at IS
  'When linkedin_contacted was last set to true. Set and cleared by the '
  'application when the admin toggles the flag, not by a trigger, so both '
  'columns can be set explicitly on import or bulk correction.';

-- No RLS changes: investors_read_admin and investors_super_admin_write
-- (phase35) already cover every column on this table, including these two.

COMMIT;

-- Verify:
-- SELECT column_name, data_type, is_nullable, column_default
--   FROM information_schema.columns
--  WHERE table_name = 'investors'
--    AND column_name IN ('linkedin_contacted', 'linkedin_contacted_at');
--
-- SELECT linkedin_contacted, count(*)
--   FROM public.investors
--  GROUP BY linkedin_contacted;
