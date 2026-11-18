-- ============================================================================
-- phase48 - Cold outreach to schools and universities (3-email sequence)
-- ============================================================================
-- Client (boss) request, 13 Nov 2026: an introductory email, a follow-up 4 days later and a final follow-up 9 days
-- after the first, each sent in the recipient's local business hours, with the Calendly link and (emails 2 and 3)
-- an unsubscribe link. Sent from midhat@certify.wiki (a separate domain, so certify.cx keeps its reputation).
--
-- outreach_settings      one row: the switch (off / dry / test / live), caps, Calendly link, who approved going live
-- outreach_leads         one row per institution contact and where it is in the sequence
-- outreach_events        everything that happened (scheduled, sent, reply, bounce, unsubscribe, ...)
-- outreach_suppressions  addresses that must never be emailed again
--
-- Idempotent: safe to run more than once. Run it in the Supabase SQL editor.
-- Nothing is sent until a Super Admin sends a test and then approves going live on the Outreach page.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.outreach_settings (
  id                   integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  -- off: nothing runs. dry: works out who would be emailed, sends nothing. test: sends only the test button.
  -- live: sends the real sequence (needs a test and an explicit approval).
  mode                 text NOT NULL DEFAULT 'off' CHECK (mode IN ('off', 'dry', 'test', 'live')),
  daily_cap            integer NOT NULL DEFAULT 40 CHECK (daily_cap BETWEEN 1 AND 500),
  hourly_cap           integer NOT NULL DEFAULT 6 CHECK (hourly_cap BETWEEN 1 AND 60),
  warmup_started_at    timestamptz,
  calendly_url         text,
  test_recipient       text,
  test_sent_at         timestamptz,
  live_approved_by     uuid,
  live_approved_at     timestamptz,
  last_reply_check_at  timestamptz,
  updated_at           timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.outreach_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.outreach_leads (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL,
  institution_name text NOT NULL,
  contact_name     text,
  institution_type text,
  country          text,
  timezone         text,
  source           text,
  -- new: not started. in_sequence: at least one email sent, more due. completed: all three sent.
  -- replied / unsubscribed / bounced / stopped: sequence ended. needs_timezone: could not work out the time zone.
  status           text NOT NULL DEFAULT 'new'
                   CHECK (status IN ('new', 'in_sequence', 'completed', 'replied', 'unsubscribed', 'bounced', 'stopped', 'needs_timezone')),
  step             integer NOT NULL DEFAULT 0 CHECK (step BETWEEN 0 AND 3),
  next_send_at     timestamptz,
  first_sent_at    timestamptz,
  last_sent_at     timestamptz,
  message_ids      text[] NOT NULL DEFAULT '{}',
  unsubscribe_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS outreach_leads_email_uq ON public.outreach_leads (lower(email));
CREATE UNIQUE INDEX IF NOT EXISTS outreach_leads_token_uq ON public.outreach_leads (unsubscribe_token);
CREATE INDEX IF NOT EXISTS outreach_leads_status_idx ON public.outreach_leads (status, next_send_at);

CREATE TABLE IF NOT EXISTS public.outreach_events (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id    uuid REFERENCES public.outreach_leads(id) ON DELETE CASCADE,
  type       text NOT NULL,
  step       integer,
  detail     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_events_lead_idx ON public.outreach_events (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS outreach_events_type_idx ON public.outreach_events (type, created_at DESC);

CREATE TABLE IF NOT EXISTS public.outreach_suppressions (
  email      text PRIMARY KEY,
  reason     text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Only the server (service role) touches these tables; no policies on purpose.
ALTER TABLE public.outreach_settings     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_leads        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_events       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outreach_suppressions ENABLE ROW LEVEL SECURITY;
