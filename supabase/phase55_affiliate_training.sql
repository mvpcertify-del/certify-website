-- Phase 55: Affiliate training on Certify.wiki(TM) + meeting log on the Clients screen (client, 28 Nov 2026).
-- Safe to run more than once. Run it in the Supabase SQL editor, then run: node scripts/seed-affiliate-training.mjs
--
-- What this does
--   1. training_modules   the affiliate training text. It lives HERE, not in the Certify.wiki(TM) JavaScript bundle,
--                         because anything in a bundle can be read without logging in. Row-level security lets only a
--                         signed-in affiliate (role referral or consultancy) or a super admin read it.
--   2. training_progress  one row per affiliate per module: which lessons are done, the quiz score, completion time.
--   3. referral_meetings  the meeting log on each client (lead): stage, date, notes. The Clients screen in
--                         Certify.cx(TM) reads and writes it; only the affiliate who owns the client (and super admins) can.
--   4. affiliate_settings one row, holds the company Calendly link shown on the Clients screen.
-- Pending-approval affiliates CAN read the training: onboarding training is part of becoming an approved affiliate.

-- ---------------------------------------------------------------- helper
CREATE OR REPLACE FUNCTION public.can_view_affiliate_training()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.role IN ('referral', 'consultancy', 'super_admin')
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_affiliate_training() FROM public;
GRANT EXECUTE ON FUNCTION public.can_view_affiliate_training() TO authenticated;

-- ---------------------------------------------------------------- 1. modules
CREATE TABLE IF NOT EXISTS public.training_modules (
  slug        text PRIMARY KEY,
  position    integer NOT NULL DEFAULT 0,
  title       text NOT NULL,
  summary     text NOT NULL DEFAULT '',
  minutes     integer NOT NULL DEFAULT 10,
  lessons     jsonb NOT NULL DEFAULT '[]'::jsonb,
  quiz        jsonb NOT NULL DEFAULT '[]'::jsonb,
  published   boolean NOT NULL DEFAULT true,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.training_modules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_modules_read" ON public.training_modules;
CREATE POLICY "training_modules_read" ON public.training_modules
  FOR SELECT TO authenticated
  USING (public.can_view_affiliate_training() AND published);

-- Writes go through the service role (the seed script) or the SQL editor; no browser write policy on purpose.

-- ---------------------------------------------------------------- 2. progress
CREATE TABLE IF NOT EXISTS public.training_progress (
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_slug       text NOT NULL REFERENCES public.training_modules(slug) ON DELETE CASCADE,
  completed_lessons integer[] NOT NULL DEFAULT '{}',
  quiz_score        integer,
  completed_at      timestamptz,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, module_slug)
);
ALTER TABLE public.training_progress ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "training_progress_own" ON public.training_progress;
CREATE POLICY "training_progress_own" ON public.training_progress
  FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.can_view_affiliate_training())
  WITH CHECK (user_id = auth.uid() AND public.can_view_affiliate_training());

DROP POLICY IF EXISTS "training_progress_super_admin_read" ON public.training_progress;
CREATE POLICY "training_progress_super_admin_read" ON public.training_progress
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- ---------------------------------------------------------------- 3. meeting log
CREATE TABLE IF NOT EXISTS public.referral_meetings (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_id  uuid NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
  referrer_id  uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage        text NOT NULL CHECK (stage IN
                 ('contacted', 'meeting_booked', 'meeting_held', 'no_show', 'proposal_sent', 'won', 'lost')),
  meeting_at   timestamptz,
  notes        text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS referral_meetings_referral_idx ON public.referral_meetings (referral_id, created_at DESC);
ALTER TABLE public.referral_meetings ENABLE ROW LEVEL SECURITY;

-- The owner is whoever owns the referral row, so a partner cannot log a meeting on someone else's client.
DROP POLICY IF EXISTS "referral_meetings_owner" ON public.referral_meetings;
CREATE POLICY "referral_meetings_owner" ON public.referral_meetings
  FOR ALL TO authenticated
  USING (referrer_id = auth.uid())
  WITH CHECK (
    referrer_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.referrals r WHERE r.id = referral_id AND r.referrer_id = auth.uid())
  );

DROP POLICY IF EXISTS "referral_meetings_super_admin_all" ON public.referral_meetings;
CREATE POLICY "referral_meetings_super_admin_all" ON public.referral_meetings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- ---------------------------------------------------------------- 4. settings (company Calendly link)
CREATE TABLE IF NOT EXISTS public.affiliate_settings (
  id           integer PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  calendly_url text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.affiliate_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.affiliate_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "affiliate_settings_read" ON public.affiliate_settings;
CREATE POLICY "affiliate_settings_read" ON public.affiliate_settings
  FOR SELECT TO authenticated USING (public.can_view_affiliate_training());

DROP POLICY IF EXISTS "affiliate_settings_super_admin_write" ON public.affiliate_settings;
CREATE POLICY "affiliate_settings_super_admin_write" ON public.affiliate_settings
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'super_admin'));

-- To set the booking link later (replace the URL):
--   UPDATE public.affiliate_settings SET calendly_url = 'https://calendly.com/your-link', updated_at = now() WHERE id = 1;
