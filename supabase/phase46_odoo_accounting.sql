-- =====================================================================
-- phase46 - Odoo Accounting mirror (MVP)
-- =====================================================================
--
-- Mirrors verified Whop card payments for certification orders into Odoo
-- Accounting: a customer (res.partner), a customer invoice (account.move) and
-- the registered payment. Certify.cx keeps issuing its own customer-facing
-- invoices; Odoo holds the mirrored accounting record.
--
-- DESIGN
--   * Nothing in the existing payment path is changed. A trigger on
--     whop_webhook_events (the verified-event log written by the Whop webhook)
--     enqueues a job when a payment.succeeded event is marked processed.
--   * OFF BY DEFAULT. The trigger enqueues only while odoo_sync_settings.enabled
--     is true, and only for events created after enabled_at - so switching the
--     integration on later never back-fills history into Odoo.
--   * The trigger can never break payment processing: any error inside it is
--     swallowed with a WARNING.
--   * DRY-RUN (the default): jobs end as 'dry_run' with the operations that WOULD
--     have been sent to Odoo stored in `plan`; nothing is sent or saved as created.
--   * One job per Whop payment id (UNIQUE idempotency_key), which is what makes a
--     duplicate invoice or payment impossible at the database level.
--   * MICRO monthly plans (metadata.type = 'micro_plan') are out of scope for the
--     MVP and are never enqueued.
--
-- APPLY ONLY TO THE STAGING / PREVIEW SUPABASE PROJECT FIRST. Do not run this on
-- production until the integration has been reviewed and approved.
--
-- Idempotent: safe to run more than once.
--
-- ROLLBACK (staging):
--   DROP TRIGGER IF EXISTS trg_odoo_enqueue_payment_event ON public.whop_webhook_events;
--   DROP FUNCTION IF EXISTS public.odoo_enqueue_payment_event();
--   DROP TABLE IF EXISTS public.odoo_records, public.odoo_sync_jobs, public.odoo_sync_settings;
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. Master switch (single row). Default: disabled.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.odoo_sync_settings (
  id          boolean PRIMARY KEY DEFAULT true,
  enabled     boolean NOT NULL DEFAULT false,
  enabled_at  timestamptz,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT odoo_sync_settings_singleton CHECK (id)
);

INSERT INTO public.odoo_sync_settings (id, enabled)
VALUES (true, false)
ON CONFLICT (id) DO NOTHING;

COMMENT ON TABLE public.odoo_sync_settings IS
  'phase46: single-row switch for the Odoo accounting mirror. enabled=false (default) means the trigger enqueues nothing. Turn on deliberately with: UPDATE odoo_sync_settings SET enabled = true, enabled_at = now(), updated_at = now();';

-- ---------------------------------------------------------------------
-- 2. Job queue: one row per verified Whop payment
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.odoo_sync_jobs (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key  text NOT NULL UNIQUE,
  job_type         text NOT NULL DEFAULT 'whop_payment',
  whop_payment_id  text NOT NULL,
  source_event_id  uuid REFERENCES public.whop_webhook_events(id) ON DELETE SET NULL,
  status           text NOT NULL DEFAULT 'pending',
  step             text NOT NULL DEFAULT 'queued',
  -- Dry-run output: the operations that would have been sent to Odoo.
  plan             jsonb,
  attempts         integer NOT NULL DEFAULT 0,
  next_retry_at    timestamptz,
  locked_at        timestamptz,
  last_error       text,
  error_kind       text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  completed_at     timestamptz,
  CONSTRAINT odoo_sync_jobs_status_check
    CHECK (status IN ('pending', 'running', 'done', 'dry_run', 'failed', 'needs_review', 'skipped', 'dead')),
  CONSTRAINT odoo_sync_jobs_step_check
    CHECK (step IN ('queued', 'customer', 'invoice', 'payment', 'done'))
);

CREATE INDEX IF NOT EXISTS odoo_sync_jobs_queue_idx
  ON public.odoo_sync_jobs (status, next_retry_at);

COMMENT ON TABLE public.odoo_sync_jobs IS
  'phase46: one job per verified Whop payment. pending/failed jobs are retried with backoff; needs_review jobs wait for a person (amount mismatch, validation error, misconfiguration); dead = retries exhausted.';

-- ---------------------------------------------------------------------
-- 3. Certify <-> Odoo record map
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.odoo_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type    text NOT NULL,
  -- partner: the Certify profile id. invoice / payment: the Whop payment id.
  certify_id     text NOT NULL,
  job_id         uuid REFERENCES public.odoo_sync_jobs(id) ON DELETE SET NULL,
  odoo_model     text NOT NULL,
  odoo_id        integer NOT NULL,
  odoo_number    text,
  odoo_state     text,
  payment_state  text,
  amount         numeric(12,2),
  currency       text,
  last_synced_at timestamptz NOT NULL DEFAULT now(),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT odoo_records_entity_check
    CHECK (entity_type IN ('partner', 'invoice', 'payment')),
  CONSTRAINT odoo_records_unique UNIQUE (entity_type, certify_id)
);

CREATE INDEX IF NOT EXISTS odoo_records_job_idx ON public.odoo_records (job_id);

COMMENT ON TABLE public.odoo_records IS
  'phase46: maps Certify entities to the Odoo record created for them, so a retry resumes instead of creating a second invoice or payment.';

-- ---------------------------------------------------------------------
-- 4. Enqueue trigger (never allowed to break the payment path)
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.odoo_enqueue_payment_event()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  s   record;
  pid text;
BEGIN
  SELECT enabled, enabled_at INTO s FROM public.odoo_sync_settings WHERE id;
  IF NOT FOUND OR NOT s.enabled THEN
    RETURN NEW;
  END IF;
  -- Never back-fill: only events that arrived after the switch was turned on.
  IF s.enabled_at IS NOT NULL AND NEW.created_at < s.enabled_at THEN
    RETURN NEW;
  END IF;
  -- MVP scope: certification orders only, not MICRO monthly plans.
  IF COALESCE(NEW.payload -> 'data' -> 'metadata' ->> 'type', '') = 'micro_plan' THEN
    RETURN NEW;
  END IF;

  pid := NEW.payload -> 'data' ->> 'id';
  IF pid IS NULL OR pid = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.odoo_sync_jobs (idempotency_key, whop_payment_id, source_event_id)
  VALUES ('whop_payment:' || pid, pid, NEW.id)
  ON CONFLICT (idempotency_key) DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- The Odoo mirror must never be able to fail a customer's payment.
  RAISE WARNING 'odoo_enqueue_payment_event failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_odoo_enqueue_payment_event ON public.whop_webhook_events;
CREATE TRIGGER trg_odoo_enqueue_payment_event
  AFTER INSERT OR UPDATE OF processed ON public.whop_webhook_events
  FOR EACH ROW
  WHEN (NEW.processed IS TRUE AND NEW.event_type = 'payment.succeeded')
  EXECUTE FUNCTION public.odoo_enqueue_payment_event();

-- ---------------------------------------------------------------------
-- 5. RLS: accounting data is for Super Admin and Finance only.
--    Writes happen only from the server with the service role (bypasses RLS).
-- ---------------------------------------------------------------------
ALTER TABLE public.odoo_sync_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odoo_sync_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.odoo_records       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "odoo_sync_settings_read" ON public.odoo_sync_settings;
CREATE POLICY "odoo_sync_settings_read" ON public.odoo_sync_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'finance'))
  );

DROP POLICY IF EXISTS "odoo_sync_jobs_read" ON public.odoo_sync_jobs;
CREATE POLICY "odoo_sync_jobs_read" ON public.odoo_sync_jobs
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'finance'))
  );

DROP POLICY IF EXISTS "odoo_records_read" ON public.odoo_records;
CREATE POLICY "odoo_records_read" ON public.odoo_records
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles p
            WHERE p.id = auth.uid() AND p.role IN ('super_admin', 'finance'))
  );

COMMIT;
