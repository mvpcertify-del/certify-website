-- ============================================
-- Certify.cx — Phase 18: Profile fields (picture, city, contact number)
-- ============================================
-- Run in the Supabase SQL Editor.
-- Idempotent (safe to re-run).
--
-- WHY THIS EXISTS
--
-- The client reworked the "My Profile" page: the Company field is removed and
-- the user now supplies a profile picture, a contact number (with dial code),
-- the city and the country they live in.
--
-- Of those, only `avatar_url` and `city` are new columns. `phone` already
-- exists (phase15) and `country` already exists (phase17) — both are guarded
-- with IF NOT EXISTS here so this migration is self-contained even if phase17
-- has not been run yet on a given environment.
--
-- It also provisions a PUBLIC `avatars` storage bucket (profile pictures are
-- shown across the app, so public read is intentional) with per-user write
-- policies keyed on the first path segment being the owner's uid.
-- ============================================


-- --------------------------------------------
-- 1. profiles columns
-- --------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS city       text,
  ADD COLUMN IF NOT EXISTS phone      text,   -- phase15 (guarded for safety)
  ADD COLUMN IF NOT EXISTS country    text;   -- phase17 (guarded for safety)


-- --------------------------------------------
-- 2. Public "avatars" storage bucket
-- --------------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Anyone can read avatars (they are shown throughout the app).
DROP POLICY IF EXISTS "avatars public read" ON storage.objects;
CREATE POLICY "avatars public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'avatars');

-- A user may write only inside their own folder: avatars/{uid}/...
DROP POLICY IF EXISTS "avatars owner insert" ON storage.objects;
CREATE POLICY "avatars owner insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars owner update" ON storage.objects;
CREATE POLICY "avatars owner update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "avatars owner delete" ON storage.objects;
CREATE POLICY "avatars owner delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'avatars'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );


-- --------------------------------------------
-- 3. Verification
-- --------------------------------------------
-- Expect 4 rows: avatar_url, city, country, phone.
SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'profiles'
  AND column_name IN ('avatar_url', 'city', 'country', 'phone')
ORDER BY column_name;
