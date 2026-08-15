-- =====================================================================
-- HOTFIX 15 Aug 2026 — "Could not find the 'referred_website' column
--                       of 'referrals' in the schema cache"
-- =====================================================================
--
-- WHAT THE CLIENT SAW
--   Referral Program -> Add Client -> the form refuses to save and shows the
--   raw database error above. No client can be referred at all.
--
-- WHY
--   The Add Client form captures two extra fields the client asked for on
--   25 Jul (WhatsApp number, company website). The code that writes them
--   shipped; the migration that creates the two columns
--   (phase28_referral_client_fields.sql) was never RUN against this database.
--   So every insert names a column Postgres does not have, and PostgREST
--   rejects the whole row before it reaches the table.
--
-- HOW TO APPLY (about 30 seconds)
--   Supabase dashboard -> SQL Editor -> New query -> paste this whole file
--   -> Run. It is idempotent: running it twice, or on a database that
--   already has the columns, changes nothing and cannot fail.
--
-- This file is exactly phase28 plus an explicit PostgREST cache reload. It is
-- kept as a separate paste-ready file so nobody has to figure out which of the
-- thirty phase files is the relevant one during an outage.
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

-- The error message says "schema cache", not "column". PostgREST answers from
-- a cached copy of the schema and only refreshes on its own schedule, so an
-- ALTER TABLE alone can leave the API rejecting the column for several more
-- minutes. This makes the new columns usable the instant the query finishes.
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Verification — run this after the above; expect exactly 2 rows.
-- =====================================================================
-- SELECT column_name, data_type
--   FROM information_schema.columns
--  WHERE table_schema = 'public'
--    AND table_name   = 'referrals'
--    AND column_name IN ('referred_whatsapp', 'referred_website')
--  ORDER BY column_name;
