-- Phase 50: requests for the MICRO "What's your budget?" offer (ISO 9001, USD 500 to 1,500).
-- Safe to run more than once. Service role only, like the other admin tables.
CREATE TABLE IF NOT EXISTS public.micro_offer_requests (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  budget_usd    integer NOT NULL CHECK (budget_usd BETWEEN 500 AND 1500),
  standard      text NOT NULL DEFAULT 'ISO 9001',
  company_name  text NOT NULL,
  website       text,
  contact_name  text NOT NULL,
  job_title     text NOT NULL,
  phone         text NOT NULL,
  email         text NOT NULL,
  main_activity text NOT NULL,
  employees     integer NOT NULL CHECK (employees BETWEEN 1 AND 9),
  message       text,
  status        text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  decision_note text,
  decided_at    timestamptz,
  decided_by    uuid
);
CREATE INDEX IF NOT EXISTS micro_offer_requests_status_idx ON public.micro_offer_requests (status, created_at DESC);
CREATE INDEX IF NOT EXISTS micro_offer_requests_email_idx  ON public.micro_offer_requests (lower(email), created_at DESC);
ALTER TABLE public.micro_offer_requests ENABLE ROW LEVEL SECURITY;
