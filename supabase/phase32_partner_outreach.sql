-- =====================================================================
-- phase32 — Referral partner outreach email ("send the proposal")
-- =====================================================================
--
-- Client request (27 Aug), with a sample email and a briefing PDF attached:
--   "1. In Certify.cx platform, configure & enable for all Referral Partners
--    to send Emails from their own dashboard using support@certify.cx being
--    the communication introductory email with Clients (New & Existing)
--    ...
--    3. RP will just send the email template + Attach file to the Leads whom
--    he/she has updated in certify.cx platform"
--
-- phase27 already gave a partner the ability to email a lead they added (the
-- "invite" — registration link + discount code). This is a SECOND, different
-- letter: a WCA GLOBAL-branded proposal that pitches ONE named standard and
-- carries that standard's briefing document as a real file attachment.
--
-- Two things this migration adds:
--
--  1. outreach_assets — the briefing document library, one row per standard.
--     The client supplied exactly ONE PDF (ISO 21001). A template that hard-
--     codes it would attach an ISO 21001 briefing to an ISO 45001 proposal, so
--     the attachment is looked up BY STANDARD and simply omitted when that
--     standard has no document yet. Super Admin uploads the rest over time
--     without a code change.
--
--     The row is metadata only; the bytes live in the private `outreach-assets`
--     storage bucket, fetched server-side at send time. Nothing about this
--     bucket is public — a briefing document is sales collateral, but the
--     bucket is also the thing an outbound mailer reads from, and a public
--     bucket would let anyone enumerate and hotlink it.
--
--  2. referral_invites.kind / .standard_slug — this table is BOTH the audit
--     trail and the rate-limit source for partner mail (see phase27). The
--     outreach letter has to be counted by the same caps, or a partner gets a
--     second, uncapped way to send mail over the shared domain. Rather than a
--     parallel table with a parallel cap to keep in step, outreach sends are
--     logged here and the existing counts pick them up for free.
--
--     `kind` defaults to 'invite' so every pre-existing row keeps its true
--     meaning without a backfill.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Briefing document library (one document per standard)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.outreach_assets (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  standard_slug text NOT NULL,
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  byte_size     bigint,
  content_type  text NOT NULL DEFAULT 'application/pdf',
  uploaded_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- One current document per standard. The upload path UPSERTs on this, so
-- re-uploading for a standard replaces rather than accumulates.
CREATE UNIQUE INDEX IF NOT EXISTS outreach_assets_standard_uniq
  ON public.outreach_assets (standard_slug);

COMMENT ON TABLE public.outreach_assets IS
  'Briefing document attached to a referral partner''s outreach email, one per '
  'standard. Bytes live in the private outreach-assets storage bucket.';

COMMENT ON COLUMN public.outreach_assets.standard_slug IS
  'ISO catalogue slug (e.g. iso-21001). Validated against src/utils/isoCatalog.js '
  'server-side before insert — not a foreign key, because the catalogue is code.';

ALTER TABLE public.outreach_assets ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may READ the library. It carries no secret — it answers
-- "does this standard have a briefing document?", which is exactly what the
-- partner's send form needs in order to tell them what will be attached.
DROP POLICY IF EXISTS "outreach_assets_read" ON public.outreach_assets;
CREATE POLICY "outreach_assets_read"
  ON public.outreach_assets FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy is defined on purpose: with RLS enabled and
-- no write policy, every write from a browser session is denied. Uploads go
-- through api/outreach-assets.js, which verifies Super Admin and uses the
-- service role (which bypasses RLS). Do not "fix" this by adding a write
-- policy — the API is the only intended writer.

-- ---------------------------------------------------------------------
-- 2. Private bucket for the documents
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
SELECT 'outreach-assets', 'outreach-assets', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'outreach-assets');

-- Deliberately NO storage.objects policies for this bucket. Both the upload
-- and the read-at-send-time run under the service role in api/, so no
-- browser session ever needs direct object access.

-- ---------------------------------------------------------------------
-- 3. Tell referral_invites which letter was sent
-- ---------------------------------------------------------------------
ALTER TABLE public.referral_invites
  ADD COLUMN IF NOT EXISTS kind          text NOT NULL DEFAULT 'invite',
  ADD COLUMN IF NOT EXISTS standard_slug text;

-- Added separately from the column so a re-run against a table that already
-- has the column still installs the constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referral_invites_kind_check'
  ) THEN
    ALTER TABLE public.referral_invites
      ADD CONSTRAINT referral_invites_kind_check
      CHECK (kind IN ('invite', 'outreach'));
  END IF;
END $$;

COMMENT ON COLUMN public.referral_invites.kind IS
  'Which letter this row logs: ''invite'' (phase27 registration invite) or '
  '''outreach'' (phase32 standard proposal). Both share the partner send caps.';

COMMENT ON COLUMN public.referral_invites.standard_slug IS
  'For kind=''outreach'', the ISO catalogue slug the proposal pitched.';

COMMIT;

-- PostgREST serves from a cached schema copy; without this an insert can fail
-- with "Could not find the 'kind' column ... in the schema cache" for minutes
-- after the migration succeeded.
NOTIFY pgrst, 'reload schema';

-- =====================================================================
-- Verification
-- =====================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'referral_invites'
--    AND column_name IN ('kind','standard_slug');            -- 2 rows
-- SELECT id, public FROM storage.buckets WHERE id = 'outreach-assets';
--                                                            -- 1 row, public=false
-- SELECT to_regclass('public.outreach_assets');              -- not null
