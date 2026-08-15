-- =====================================================================
-- phase28 — Extra fields on a referred client
-- =====================================================================
--
-- Client request (25 Jul), on the referral partner's "Add Client" form:
--   "Add WhatsApp field to enable them put the WhatsApp number of the
--    referred client. Add client company website field box."
--
-- Both are optional free text on the existing referrals row. They are captured
-- by the partner when adding a lead so the partner (and later an admin) can
-- reach the client by WhatsApp and see their site — neither drives any logic,
-- so plain nullable text is the whole story.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS referred_whatsapp text,
  ADD COLUMN IF NOT EXISTS referred_website  text;

COMMENT ON COLUMN public.referrals.referred_whatsapp IS
  'WhatsApp number of the referred client, entered by the referral partner. '
  'Optional, free text (includes country code as typed).';

COMMENT ON COLUMN public.referrals.referred_website IS
  'The referred client company website, entered by the referral partner. '
  'Optional, free text.';

-- PostgREST serves the API from a cached copy of the schema and refreshes it
-- on its own schedule, so an ALTER TABLE alone can leave inserts failing with
-- "Could not find the '...' column ... in the schema cache" for minutes after
-- the migration succeeded. Ask for the reload explicitly.
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Verification
-- =====================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'referrals'
--    AND column_name IN ('referred_whatsapp','referred_website');   -- 2 rows
