-- Phase 49: several people per institution (outreach leads).
-- Safe to run more than once.
CREATE TABLE IF NOT EXISTS public.outreach_contacts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     uuid NOT NULL REFERENCES public.outreach_leads(id) ON DELETE CASCADE,
  name        text NOT NULL,
  job_title   text,
  email       text,
  whatsapp    text,
  active      boolean NOT NULL DEFAULT true,   -- false = no longer works there
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS outreach_contacts_lead_idx ON public.outreach_contacts (lead_id);
ALTER TABLE public.outreach_contacts ENABLE ROW LEVEL SECURITY;  -- service role only, like the other outreach tables
