-- =====================================================================
-- phase40 - Whop payment provider (replacing Stripe for card checkout)
-- =====================================================================
--
-- api/checkout.js is moving card checkout from Stripe to Whop. Whop's
-- variant-create API does not accept arbitrary metadata on the variant/plan
-- it creates, so there is no way to stamp our application id onto it at
-- creation time the way stripe_session_id (phase2/phase7) could carry one.
-- Instead we store the variant/plan id Whop hands back on the application
-- row itself (applications.whop_variant_id) and correlate the other
-- direction: when a webhook arrives, look up the application by that id.
--
-- Because the exact field names on Whop's inbound Payment/webhook object
-- are not yet confirmed from their docs, every raw webhook is logged to
-- whop_webhook_events (full payload, matched application if any, processed
-- flag, error) rather than trusting the handler to parse it correctly on
-- the first try - this is the reconciliation/debugging trail.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. applications.whop_variant_id - correlation key for inbound webhooks
-- ---------------------------------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS whop_variant_id text;

COMMENT ON COLUMN public.applications.whop_variant_id IS
  'Whop variant/plan id created at checkout time (api/checkout.js, phase40). '
  'Whop''s variant-create API has no metadata field to carry our application '
  'id, so correlation with an incoming Whop webhook happens by looking up '
  'this id instead, mirroring what stripe_session_id (phase2/phase7) did '
  'for Stripe.';

CREATE INDEX IF NOT EXISTS applications_whop_variant_id_idx
  ON public.applications (whop_variant_id);

-- ---------------------------------------------------------------------
-- 2. whop_webhook_events - raw inbound webhook log for debugging/reconciliation
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.whop_webhook_events (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Whop's `webhook-id` request header, used for dedup. Nullable because a
  -- malformed/headerless event should still be logged for debugging, just
  -- without participating in the unique dedup check below.
  webhook_id             text,
  event_type             text,
  -- Full parsed event body, kept as-received since the exact Payment object
  -- field names from Whop aren't fully confirmed yet.
  payload                jsonb,
  matched_application_id uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  processed              boolean NOT NULL DEFAULT false,
  error                  text,
  created_at             timestamptz NOT NULL DEFAULT now()
);

-- Dedup lookup: only enforced when webhook_id is present, so malformed
-- events with no header never collide with each other on NULL = NULL.
CREATE UNIQUE INDEX IF NOT EXISTS whop_webhook_events_webhook_id_idx
  ON public.whop_webhook_events (webhook_id) WHERE webhook_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS whop_webhook_events_matched_application_idx
  ON public.whop_webhook_events (matched_application_id);

COMMENT ON TABLE public.whop_webhook_events IS
  'Raw log of every incoming Whop webhook (phase40), for debugging/'
  'reconciliation while the exact Payment object shape from Whop is '
  'confirmed. Written only by the webhook receiver under the service role; '
  'not exposed to any client role.';

-- ---------------------------------------------------------------------
-- 3. RLS - service-role only, no client-facing policy
-- ---------------------------------------------------------------------
-- This table has no owner column (it isn't tied to a single user/client) and
-- is written/read only by the webhook receiver under the service role, which
-- bypasses RLS automatically. Enabling RLS with no policy is the same
-- fail-safe pattern used elsewhere in this schema for internal/admin-only
-- tables (e.g. notifications, coupon_redemptions): it blocks every
-- browser-side (anon/authenticated) request by default instead of relying
-- on application code alone to never query it directly.
ALTER TABLE public.whop_webhook_events ENABLE ROW LEVEL SECURITY;

COMMIT;

-- Verify:
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'applications' AND column_name = 'whop_variant_id';
--
-- SELECT column_name, data_type FROM information_schema.columns
--  WHERE table_name = 'whop_webhook_events' ORDER BY ordinal_position;
--
-- SELECT indexname FROM pg_indexes WHERE tablename IN ('applications', 'whop_webhook_events')
--  AND indexname LIKE '%whop%';
