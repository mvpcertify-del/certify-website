-- ============================================================================
-- phase47 - Notification & engagement engine (Phases 1 and 2)
-- ============================================================================
-- Client (boss) request, 15 Nov 2026: notify every stakeholder about every
-- important deadline and transaction.
--
-- notification_rules   one row per notification: on/off, how many days before or
--                      after, which channels, the wording. The engine adds the
--                      default rows itself the first time it runs (api/_notifyEngine.js),
--                      so this file only creates the tables.
-- notification_log     one row per message the engine decided to send. event_id is
--                      UNIQUE, so the same reminder can never go out twice, and a
--                      row records who, when, which channels and what happened.
-- notifications        the existing in-app inbox, gaining a link and the event id.
--
-- Idempotent: safe to run more than once. Run it in the Supabase SQL editor.
-- Until it is run, the engine reports "not migrated" and sends nothing.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.notification_rules (
  key            text PRIMARY KEY,
  title          text NOT NULL,
  description    text,
  enabled        boolean NOT NULL DEFAULT true,
  -- Days. For "before a deadline" rules: days before. For "overdue" rules: days after.
  offsets        integer[] NOT NULL DEFAULT '{}',
  channels       text[] NOT NULL DEFAULT '{in_app,email}',
  recipient_role text,
  -- Rule-specific settings, e.g. {"trial_days":30,"lookback_days":7}
  config         jsonb NOT NULL DEFAULT '{}'::jsonb,
  -- {"en": {"default": {"title":"..","message":".."}, "byOffset": {"7": {...}}, "cta":"..", "path":".."}}
  templates      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.notification_log (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- rule:entity:bucket, e.g. contractor_trial_ending:<contractor id>:7
  event_id      text NOT NULL UNIQUE,
  rule_key      text NOT NULL,
  user_id       uuid,
  entity_type   text,
  entity_id     text,
  bucket        text,
  scheduled_for timestamptz NOT NULL DEFAULT now(),
  sent_at       timestamptz,
  -- {"in_app":"sent","email":"sent","whatsapp":"skipped: not configured"}
  channels      jsonb NOT NULL DEFAULT '{}'::jsonb,
  error         text,
  read_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notification_log_rule_idx ON public.notification_log (rule_key, created_at DESC);
CREATE INDEX IF NOT EXISTS notification_log_user_idx ON public.notification_log (user_id, created_at DESC);

-- Only the server (service role) reads or writes these two tables; no policies on purpose.
ALTER TABLE public.notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification_log   ENABLE ROW LEVEL SECURITY;

-- The in-app inbox: where the message points, and which engine event produced it.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS link     text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS event_id text;
