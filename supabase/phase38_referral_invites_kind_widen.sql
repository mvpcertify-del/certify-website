-- =====================================================================
-- phase38 - Widen referral_invites.kind for the stakeholder Invite feature
-- =====================================================================
--
-- Bug found live, 17 Sep: the "Invite <stakeholder>" button on Shareable
-- Links failed for every type with "Could not send the invite. Please try
-- again." api/referrals.js's invitePartner() writes
-- kind = 'invite_<stakeholderType>' (e.g. 'invite_certification-body') so the
-- audit trail can tell which stakeholder type a row was for - but phase32's
-- referral_invites_kind_check CHECK constraint only allows kind IN ('invite',
-- 'outreach'), so every one of those inserts violated the constraint and got
-- rejected before Resend was ever called.
--
-- Fix: widen the constraint to also accept the 'invite_<type>' family,
-- instead of dropping the per-type detail back to the generic 'invite' -
-- being able to see WHICH stakeholder type an invite row was for is worth
-- keeping. Uses a LIKE pattern rather than an explicit list of the six
-- current slugs, so a stakeholder type added later doesn't need another
-- migration here.
--
-- Idempotent: drops and recreates the constraint, so safe to run more than
-- once.
-- =====================================================================

BEGIN;

ALTER TABLE public.referral_invites
  DROP CONSTRAINT IF EXISTS referral_invites_kind_check;

ALTER TABLE public.referral_invites
  ADD CONSTRAINT referral_invites_kind_check
  CHECK (kind IN ('invite', 'outreach') OR kind LIKE 'invite\_%' ESCAPE '\');

COMMENT ON COLUMN public.referral_invites.kind IS
  'Which letter this row logs: ''invite'' (phase27 registration invite, or a '
  'legacy row), ''outreach'' (phase32 standard proposal), or '
  '''invite_<stakeholderType>'' (phase38 - the Shareable Links "Invite '
  '<stakeholder>" button, e.g. ''invite_auditor'', ''invite_certification-body''). '
  'All three share the same partner send caps.';

COMMIT;

-- Verify:
-- SELECT conname, pg_get_constraintdef(oid)
--   FROM pg_constraint
--  WHERE conname = 'referral_invites_kind_check';
--
-- SELECT kind, count(*) FROM public.referral_invites GROUP BY kind;
