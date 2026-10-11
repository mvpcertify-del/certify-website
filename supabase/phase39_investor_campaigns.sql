-- =====================================================================
-- phase39 - Investor email campaigns: templates, sends, tracking
-- =====================================================================
--
-- Client, 10-11 Oct: bulk-email the investors register with rotating content
-- ("first email automated to all investors, another email with new content
-- to the whole list, and so on"), with per-recipient analytics (opened,
-- clicked, bounced/complained, replied) restricted to the Super Admin, and a
-- weekly AI-drafted email every Monday 1am Gulf Standard Time that the Super
-- Admin reviews and approves before it sends (confirmed explicitly — not a
-- fully autonomous send, to keep an unreviewed AI draft from reaching 150
-- real funds unattended).
--
-- NOT built, and not buildable by anyone: "did this land in spam/junk" for a
-- specific recipient. No sender-side API from any provider can see inside a
-- recipient's own mailbox. What IS real and tracked here is delivery health
-- (bounces, spam COMPLAINTS the recipient's provider reports back) - a proxy
-- for reputation, not a per-email spam-folder verdict.
--
-- Two tables:
--   investor_campaigns           one row per piece of content ("campaign").
--                                 draft until sent_at is set; sent_at is also
--                                 what makes it immutable (see trigger below).
--   investor_campaign_recipients one row per (campaign, investor) - the send
--                                 log AND the tracking state. status moves
--                                 forward only: queued -> sent -> delivered ->
--                                 opened -> clicked, with bounced/complained/
--                                 failed as terminal branches. replied_at is
--                                 independent of status (a reply can arrive
--                                 after any of the above).
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 0. Unsubscribe (not asked for, added anyway - see note)
-- ---------------------------------------------------------------------
-- A recurring marketing email to an external list legally requires a working
-- opt-out (CAN-SPAM in the US, PECR/GDPR in the UK/EU, and most other
-- regimes investors' own funds are based in). Added proactively rather than
-- building a weekly-send feature that is non-compliant on day one.
ALTER TABLE public.investors
  ADD COLUMN IF NOT EXISTS unsubscribed_at timestamptz;

COMMENT ON COLUMN public.investors.unsubscribed_at IS
  'Set when this fund''s contact clicks Unsubscribe on an investor campaign '
  'email (phase39). Excluded from every future campaign send; never cleared '
  'automatically.';

-- ---------------------------------------------------------------------
-- 1. Campaigns (the content)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investor_campaigns (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject      text NOT NULL,
  -- Admin-composed body. Plain paragraphs (one per blank line), same
  -- contract as contract_templates.body (phase29) and ContractBody's
  -- renderer in src/pages/partner/PartnerContract.jsx - never raw HTML, so
  -- nothing typed here can inject markup into the rendered email.
  body         text NOT NULL,
  -- NULL = draft, never sent, still freely editable. Once set, the campaign
  -- is immutable (see the trigger below) - the recipient log below already
  -- references exactly what was sent and must not be able to drift from it.
  sent_at      timestamptz,
  -- true for a row CronCreate's weekly job drafted and the Super Admin has
  -- not yet reviewed. Distinguishes "AI wrote this, needs a human look"
  -- from an admin-authored draft in the same list.
  ai_generated boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS investor_campaigns_sent_at_idx
  ON public.investor_campaigns (sent_at DESC NULLS FIRST);

COMMENT ON TABLE public.investor_campaigns IS
  'One row per investor-outreach email (client, 10-11 Oct). Draft while '
  'sent_at is NULL; immutable once sent (trigger below).';
COMMENT ON COLUMN public.investor_campaigns.ai_generated IS
  'Drafted by the Monday weekly-content job, pending Super Admin review - '
  'never auto-sent. See api/notify-event.js.';

-- A sent campaign cannot be edited: investor_campaign_recipients rows below
-- already record what went out, so changing the content after the fact would
-- make the audit trail describe an email that was never actually sent.
CREATE OR REPLACE FUNCTION public.investor_campaign_lock_after_send()
RETURNS trigger AS $$
BEGIN
  IF OLD.sent_at IS NOT NULL AND (NEW.subject IS DISTINCT FROM OLD.subject OR NEW.body IS DISTINCT FROM OLD.body) THEN
    RAISE EXCEPTION 'investor_campaigns: cannot edit subject/body of a campaign that has already been sent (id=%)', OLD.id;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS investor_campaign_lock_after_send_trg ON public.investor_campaigns;
CREATE TRIGGER investor_campaign_lock_after_send_trg
  BEFORE UPDATE ON public.investor_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.investor_campaign_lock_after_send();

-- ---------------------------------------------------------------------
-- 2. Recipients (the send log + tracking state)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.investor_campaign_recipients (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id      uuid NOT NULL REFERENCES public.investor_campaigns(id) ON DELETE CASCADE,
  investor_id      uuid REFERENCES public.investors(id) ON DELETE SET NULL,
  -- Captured at send time, not read live from investors.contact_email, so a
  -- later edit to the fund's contact (or the fund row being deleted) never
  -- rewrites history about who this email actually went to.
  email            text NOT NULL,
  fund_name        text,
  resend_message_id text,
  status           text NOT NULL DEFAULT 'queued',
  sent_at          timestamptz,
  delivered_at     timestamptz,
  opened_at        timestamptz,
  first_clicked_at timestamptz,
  bounced_at       timestamptz,
  bounce_reason    text,
  complained_at    timestamptz,
  -- Set by the inbound-reply receiver (api/inbound-email.js) - independent of
  -- `status` above, since a reply can land before or after the tracking
  -- pixel/link ever fires.
  replied_at       timestamptz,
  -- Reuses the phase33 reply-token mechanism (api/_replyAddress.js) that
  -- partner_conversations already relies on, rather than guessing from the
  -- sender's address: this campaign's send sets Reply-To to
  -- p.<reply_token>@reply.certify.cx (when INBOUND_REPLY_DOMAIN/ADDRESS is
  -- configured), and the webhook reads the token back out to find this exact
  -- row with no ambiguity. NULL when inbound isn't configured yet - the send
  -- still goes out, it just can't be matched if a reply arrives.
  reply_token      text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS investor_campaign_recipients_reply_token_idx
  ON public.investor_campaign_recipients (reply_token) WHERE reply_token IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'investor_campaign_recipients_status_check'
  ) THEN
    ALTER TABLE public.investor_campaign_recipients
      ADD CONSTRAINT investor_campaign_recipients_status_check
      CHECK (status IN ('queued', 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'complained', 'failed'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS investor_campaign_recipients_campaign_idx
  ON public.investor_campaign_recipients (campaign_id);
CREATE INDEX IF NOT EXISTS investor_campaign_recipients_message_idx
  ON public.investor_campaign_recipients (resend_message_id);
-- The webhook receiver looks up "which open recipients does this address
-- match" to post a reply - scoped to recent rows so a common fund inbox
-- (e.g. a shared partner address reused across many of our outreach letters)
-- can't match an arbitrarily old campaign.
CREATE INDEX IF NOT EXISTS investor_campaign_recipients_email_idx
  ON public.investor_campaign_recipients (lower(email), sent_at DESC);

COMMENT ON TABLE public.investor_campaign_recipients IS
  'One row per (campaign, investor): the send log and delivery/open/click/'
  'bounce/complaint/reply tracking state. There is no "landed in spam" '
  'signal here or anywhere - no sender-side API can see inside a recipient''s '
  'own mailbox; bounced/complained are the closest real proxy for reputation.';

-- ---------------------------------------------------------------------
-- 3. RLS - Super Admin only, matching the client's access decision (11 Oct)
-- ---------------------------------------------------------------------
ALTER TABLE public.investor_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.investor_campaign_recipients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "investor_campaigns_super_admin_all" ON public.investor_campaigns;
CREATE POLICY "investor_campaigns_super_admin_all"
  ON public.investor_campaigns FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

DROP POLICY IF EXISTS "investor_campaign_recipients_super_admin_all" ON public.investor_campaign_recipients;
CREATE POLICY "investor_campaign_recipients_super_admin_all"
  ON public.investor_campaign_recipients FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'));

-- Writes in practice all go through the service role from api/ (same pattern
-- as every other admin table in this schema) - these policies are the
-- fail-safe for any future direct-from-browser read, not the primary gate.

-- ---------------------------------------------------------------------
-- 4. Client, 11 Oct: "Add me as an investor in the investors database" -
--    a test fund row carrying his own email, so sends can be verified end
--    to end against a real inbox before any real fund receives anything.
--    Clearly marked as test data in fund_name/notes so it reads as exactly
--    that in the admin list, not a real fund.
-- ---------------------------------------------------------------------
INSERT INTO public.investors
  (fund_name, region, country, contact_email, key_partner, is_active, source, notes)
SELECT
  'Midhat Abu Ghazaleh (Internal test)', 'Middle East & Africa', 'United Arab Emirates',
  'midhatabughazaleh@gmail.com', 'Midhat Abu Ghazaleh', true, 'internal-test',
  'Test row (11 Oct) - receives every investor campaign so sends can be verified against a real inbox before the real fund list does. Not a real fund.'
WHERE NOT EXISTS (
  SELECT 1 FROM public.investors WHERE lower(fund_name) = lower('Midhat Abu Ghazaleh (Internal test)')
);

COMMIT;

-- Verify:
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name IN ('investor_campaigns','investor_campaign_recipients')
--  ORDER BY table_name, ordinal_position;
--
-- SELECT fund_name, contact_email, is_active FROM public.investors
--  WHERE source = 'internal-test';  -- 1 row: Midhat Abu Ghazaleh (Internal test)
