-- Atomic one-time welcome email claim.
-- Run in Supabase SQL Editor.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS welcome_sending_at TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION public.claim_welcome_email(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claimed_id UUID;
BEGIN
  UPDATE public.profiles
  SET welcome_sending_at = NOW()
  WHERE id = p_user_id
    AND welcome_sent_at IS NULL
    AND approval_status IS DISTINCT FROM 'pending'
    AND (
      welcome_sending_at IS NULL
      OR welcome_sending_at < NOW() - INTERVAL '15 minutes'
    )
  RETURNING id INTO claimed_id;

  RETURN claimed_id IS NOT NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.release_welcome_email(p_user_id UUID)
RETURNS VOID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.profiles
  SET welcome_sending_at = NULL
  WHERE id = p_user_id
    AND welcome_sent_at IS NULL;
$$;

REVOKE ALL ON FUNCTION public.claim_welcome_email(UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_welcome_email(UUID) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.claim_welcome_email(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_welcome_email(UUID) TO service_role;
