-- Phase 16: Certification Body edit/save + document-upload fixes
--
-- Why this exists (client report on ICL):
--   Editing a CB (name, website, prices) and uploading Accreditation Schedule
--   documents did not save. Two root causes were DB-side:
--     1. The per-standard pricing table / address column / per-standard IAF
--        column may be missing if phase1 + phase12 were never applied on this
--        project. Re-asserted here (idempotent) so the edit form can load/save.
--     2. The `cb-documents` storage bucket + its RLS policies were only ever
--        described as a MANUAL step in phase1 (commented out), so uploads failed
--        with a storage/permission error. This file creates them for real.
--
-- The matching code change makes pricing OPTIONAL (so name/website edits are no
-- longer blocked) and adds auto-save; that ships in the app, not here.
--
-- Idempotent: safe to run more than once.

BEGIN;

-- 1) Certification body: full address ----------------------------------------
ALTER TABLE public.certification_bodies
  ADD COLUMN IF NOT EXISTS address text;

-- 2) Per-standard pricing table ----------------------------------------------
CREATE TABLE IF NOT EXISTS public.cb_standard_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cb_id UUID NOT NULL REFERENCES public.certification_bodies(id) ON DELETE CASCADE,
  iso_standard TEXT NOT NULL,
  initial_price NUMERIC,
  surveillance_price NUMERIC,
  recertification_price NUMERIC,   -- stores the "Surveillance 2" tier in the UI
  currency TEXT DEFAULT 'USD',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  CONSTRAINT cb_standard_pricing_unique UNIQUE (cb_id, iso_standard)
);
CREATE INDEX IF NOT EXISTS idx_cb_pricing_cb_id ON public.cb_standard_pricing(cb_id);

-- 3) Per-standard IAF codes ---------------------------------------------------
ALTER TABLE public.cb_iaf_codes
  ADD COLUMN IF NOT EXISTS iso_standard text;

-- 4) CB Accreditation Schedule documents (table) -----------------------------
CREATE TABLE IF NOT EXISTS public.cb_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cb_id UUID NOT NULL REFERENCES public.certification_bodies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_size TEXT,
  document_type TEXT DEFAULT 'accreditation_schedule'
    CHECK (document_type IN ('accreditation_schedule','certificate','other')),
  uploaded_by UUID REFERENCES public.profiles(id),
  uploaded_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cb_documents_cb_id ON public.cb_documents(cb_id);

-- 5) Storage bucket for CB documents -----------------------------------------
-- Files are stored at path {cb_id}/{doc_id} in a PRIVATE bucket.
INSERT INTO storage.buckets (id, name, public)
VALUES ('cb-documents', 'cb-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Admins (super/regional) may upload/read/update/delete CB documents.
DROP POLICY IF EXISTS "cb_docs_admin_all" ON storage.objects;
CREATE POLICY "cb_docs_admin_all" ON storage.objects
  FOR ALL
  TO authenticated
  USING (
    bucket_id = 'cb-documents' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin','regional_admin')
    )
  )
  WITH CHECK (
    bucket_id = 'cb-documents' AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('super_admin','regional_admin')
    )
  );

COMMIT;
