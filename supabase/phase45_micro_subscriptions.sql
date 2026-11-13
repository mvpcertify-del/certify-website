-- =====================================================================
-- phase45 - MICRO plan subscriptions (Whop)
-- =====================================================================
--
-- The /micro page sells two monthly plans through Whop (stage 2 at $9/month,
-- stage 3 at $49/month). api/checkout.js records each confirmed payment here
-- (action 'micro-checkout' creates the checkout; the Whop payment.succeeded
-- webhook calls fulfillMicroPlanPayment). One row per client + stage; every
-- monthly renewal refreshes last_payment_at.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.micro_subscriptions (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  stage            smallint NOT NULL CHECK (stage IN (2, 3)),
  price            numeric(10,2) NOT NULL,
  status           text NOT NULL DEFAULT 'active',
  last_payment_id  text,
  last_payment_at  timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, stage)
);

ALTER TABLE public.micro_subscriptions ENABLE ROW LEVEL SECURITY;

-- A client can read their own subscriptions. Writes happen only from the
-- webhook with the service role, which bypasses RLS.
DROP POLICY IF EXISTS "micro_subscriptions_select_own" ON public.micro_subscriptions;
CREATE POLICY "micro_subscriptions_select_own"
  ON public.micro_subscriptions FOR SELECT
  USING (client_id = auth.uid());

COMMIT;
