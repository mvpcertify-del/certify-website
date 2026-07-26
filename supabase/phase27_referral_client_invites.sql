-- =====================================================================
-- phase27 — Referral partner "invite your client" email
-- =====================================================================
--
-- Client request (24 Jul):
--   "Activate email sending to the Referral Clients directly from the
--    dashboard of the Referral Partner to their added Clients — a pre-set
--    email message with the Registration Link + Discount code the client can
--    use + Company profile PDF/Video link + email signature of the Referral
--    Partner. Sender default for all users: mail.certify.cx."
--
-- Two things this migration adds:
--
--  1. profiles.email_signature — the partner's own sign-off, appended to the
--     invite. Stored on the profile, not typed per-send, so it is written once
--     and reused. Plain text; it is HTML-escaped at send time.
--
--  2. referral_invites — one row per email sent. This is BOTH the audit trail
--     (who emailed whom, when) AND the rate-limit source. Sending on a
--     partner's behalf through the shared mail.certify.cx domain means one
--     partner spamming can get the WHOLE platform's mail flagged — including
--     account-verification email. The send path counts recent rows here and
--     refuses past a daily cap. Without a table there is nothing to count.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Partner email signature
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email_signature text;

COMMENT ON COLUMN public.profiles.email_signature IS
  'A referral/consultancy partner''s email sign-off, appended to the client '
  'invite email. Plain text, HTML-escaped at send time.';

-- ---------------------------------------------------------------------
-- 2. Invite log (audit + rate limit)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.referral_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_id   uuid REFERENCES public.referrals(id) ON DELETE SET NULL,
  referred_email text NOT NULL,
  sent_at       timestamptz NOT NULL DEFAULT now()
);

-- Two rate-limit queries hit this table: a per-partner daily count, and a
-- per-recipient lifetime count. This composite index serves both — the daily
-- query uses the leading two columns, the per-recipient query uses all three.
CREATE INDEX IF NOT EXISTS referral_invites_referrer_sent_idx
  ON public.referral_invites (referrer_id, sent_at DESC);

CREATE INDEX IF NOT EXISTS referral_invites_referrer_email_idx
  ON public.referral_invites (referrer_id, referred_email);

COMMENT ON TABLE public.referral_invites IS
  'One row per client-invite email a referral partner sends from their '
  'dashboard. Feeds the per-partner daily send cap and is the audit trail.';

-- RLS: a partner may read their OWN invite history (so the dashboard can show
-- "already invited"), and nothing else. All writes go through the service role
-- in api/referrals.js, which enforces ownership and the rate limit — the
-- browser never inserts here directly, so there is no INSERT policy.
ALTER TABLE public.referral_invites ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS referral_invites_owner_read ON public.referral_invites;
CREATE POLICY referral_invites_owner_read ON public.referral_invites
  FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

COMMIT;

-- =====================================================================
-- Verification — run after applying
-- =====================================================================
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'profiles' AND column_name = 'email_signature';   -- 1 row
--
-- SELECT tablename FROM pg_tables WHERE tablename = 'referral_invites';  -- 1 row
