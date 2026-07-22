-- =====================================================================
-- phase24 — Auditor professional profile + auditor documents
-- =====================================================================
--
-- Client instruction (Add Auditor modal + auditor self-registration):
--   "Country telephone code should be displayed & auditor will put his/her
--    mobile number. Standards drop down list ... can select more than one
--    standard. Level of certificate should be Drop down list — Internal
--    Auditor, Lead Auditor, Trainer, Lead Implementer — also multiple.
--    Fields to upload 1. Certificates 2. Audit Log 3. Sectors that Auditor
--    is specialized in — from drop down (IAF Codes 39), multiple."
--
-- Three decisions worth recording:
--
--  1. The three new profile attributes are text[] on `profiles`, not a join
--     table. They are flat tag lists with no attributes of their own, they
--     are always read together with the profile, and every consumer (admin
--     list, admin modal, signup wizard) wants them in the same round trip.
--     A join table would buy nothing and cost three extra queries per page.
--
--  2. Sectors store the IAF *code* ('01' … '39'), never the display name.
--     The names are wording that will be re-translated; the codes are the
--     stable identifier and the thing a CB actually matches against.
--
--  3. ⚠️ The `auditor-documents` storage bucket has been referenced by
--     src/pages/auth/SignUp.jsx since the auditor wizard shipped but was
--     never created by ANY migration — `grep -r auditor-documents` matched
--     exactly one file. Every auditor certificate and CV uploaded at
--     self-registration has been failing, silently, because the upload sat
--     inside a try/catch that only console.error'd. This migration creates
--     the bucket. The application side now surfaces the failure instead of
--     swallowing it.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Auditor qualification columns on profiles
-- ---------------------------------------------------------------------
-- Default '{}' rather than NULL so every read site can treat the value as
-- an array without a coalesce, and so a plain `ADD COLUMN` backfill leaves
-- existing auditors in a well-formed (empty) state rather than a NULL one.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auditor_standards text[] NOT NULL DEFAULT '{}';

-- Machine values from src/utils/auditorOptions.js:
--   internal_auditor | lead_auditor | trainer | lead_implementer
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auditor_levels text[] NOT NULL DEFAULT '{}';

-- IAF sector codes as 2-character strings ('01' … '39'). See decision 2.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS auditor_sectors text[] NOT NULL DEFAULT '{}';

-- Finding an auditor by what they are qualified for is the whole point of
-- storing this, and that query is `WHERE auditor_standards && ARRAY[...]`.
-- GIN is the only index type that serves array containment.
CREATE INDEX IF NOT EXISTS profiles_auditor_standards_idx
  ON public.profiles USING GIN (auditor_standards);

CREATE INDEX IF NOT EXISTS profiles_auditor_sectors_idx
  ON public.profiles USING GIN (auditor_sectors);


-- ---------------------------------------------------------------------
-- 2. auditor_documents — the certificate / audit log / CV register
-- ---------------------------------------------------------------------
-- One row per uploaded file. The bytes live in the private
-- `auditor-documents` bucket; this table is the index that says which file
-- is what, who it belongs to and who attached it. Without it an uploaded
-- object is an opaque blob nobody can enumerate or classify.
CREATE TABLE IF NOT EXISTS public.auditor_documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- 'certificate' = an ISO qualification certificate, 'audit_log' = the
  -- auditor's logged audit history, 'cv' = résumé. 'other' is the escape
  -- hatch so a new document kind does not need a migration to be storable.
  doc_type      text NOT NULL CHECK (doc_type IN ('certificate', 'audit_log', 'cv', 'other')),
  file_name     text NOT NULL,
  storage_path  text NOT NULL,
  mime_type     text,
  size_bytes    bigint,
  uploaded_by   uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auditor_documents_auditor_idx
  ON public.auditor_documents (auditor_id);

ALTER TABLE public.auditor_documents ENABLE ROW LEVEL SECURITY;

-- The auditor sees and attaches their own paperwork.
DROP POLICY IF EXISTS "auditor_documents_own_select" ON public.auditor_documents;
CREATE POLICY "auditor_documents_own_select"
  ON public.auditor_documents FOR SELECT
  TO authenticated
  USING (auditor_id = auth.uid());

DROP POLICY IF EXISTS "auditor_documents_own_insert" ON public.auditor_documents;
CREATE POLICY "auditor_documents_own_insert"
  ON public.auditor_documents FOR INSERT
  TO authenticated
  WITH CHECK (auditor_id = auth.uid());

-- Super admin: full control. Regional admin: read + attach, but only for
-- auditors inside their own region — the same scoping every other admin
-- list view enforces. Deliberately no DELETE for a regional admin: removing
-- a qualification record is a super-admin action.
DROP POLICY IF EXISTS "auditor_documents_super_all" ON public.auditor_documents;
CREATE POLICY "auditor_documents_super_all"
  ON public.auditor_documents FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles me
                  WHERE me.id = auth.uid() AND me.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me
                       WHERE me.id = auth.uid() AND me.role = 'super_admin'));

DROP POLICY IF EXISTS "auditor_documents_regional_select" ON public.auditor_documents;
CREATE POLICY "auditor_documents_regional_select"
  ON public.auditor_documents FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.profiles me
      JOIN public.profiles subject ON subject.id = public.auditor_documents.auditor_id
     WHERE me.id = auth.uid()
       AND me.role = 'regional_admin'
       AND me.region IS NOT NULL
       AND me.region = subject.region
  ));

DROP POLICY IF EXISTS "auditor_documents_regional_insert" ON public.auditor_documents;
CREATE POLICY "auditor_documents_regional_insert"
  ON public.auditor_documents FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.profiles me
      JOIN public.profiles subject ON subject.id = public.auditor_documents.auditor_id
     WHERE me.id = auth.uid()
       AND me.role = 'regional_admin'
       AND me.region IS NOT NULL
       AND me.region = subject.region
  ));


-- ---------------------------------------------------------------------
-- 3. The private `auditor-documents` bucket (see decision 3)
-- ---------------------------------------------------------------------
-- Private: certificates and CVs are personal data, served only through
-- short-lived signed URLs, exactly like `certificates` (phase9) and
-- `contracts` (phase23).
INSERT INTO storage.buckets (id, name, public)
SELECT 'auditor-documents', 'auditor-documents', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'auditor-documents');

-- Objects are stored at {auditor_id}/{doc_type}-{timestamp}-{filename}, so
-- the first path segment is the ownership check.
DROP POLICY IF EXISTS "auditor_documents_owner_read" ON storage.objects;
CREATE POLICY "auditor_documents_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'auditor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "auditor_documents_owner_insert" ON storage.objects;
CREATE POLICY "auditor_documents_owner_insert"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'auditor-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Admins read, they do not write from the browser. Uploads on behalf of
-- somebody else go through the service role in api/user.js, which is where
-- the "may this caller touch this auditor" decision is made once. Note the
-- deliberate absence of 'certification_body' here: phase20 granted a CB
-- read access to every client's billing PDFs, which was wider than intended.
-- An auditor's certificates and CV are personal data and a CB has no claim
-- on them.
DROP POLICY IF EXISTS "auditor_documents_staff_read" ON storage.objects;
CREATE POLICY "auditor_documents_staff_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'auditor-documents'
    AND EXISTS (SELECT 1 FROM public.profiles me
                 WHERE me.id = auth.uid()
                   AND me.role IN ('super_admin', 'regional_admin'))
  );


-- ---------------------------------------------------------------------
-- 4. Verification
-- ---------------------------------------------------------------------
-- Columns landed:
-- SELECT column_name, data_type, column_default
--   FROM information_schema.columns
--  WHERE table_schema = 'public' AND table_name = 'profiles'
--    AND column_name LIKE 'auditor\_%'
--  ORDER BY column_name;
--
-- Table + policies landed:
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'auditor_documents'
--  ORDER BY policyname;
--
-- Bucket landed (this is the line that was missing — expect exactly 1 row):
-- SELECT id, public FROM storage.buckets WHERE id = 'auditor-documents';
--
-- SELECT policyname, cmd FROM pg_policies
--  WHERE schemaname = 'storage' AND tablename = 'objects'
--    AND policyname LIKE 'auditor_documents%'
--  ORDER BY policyname;
--
-- Spot-check an auditor:
-- SELECT full_name, phone, auditor_standards, auditor_levels, auditor_sectors
--   FROM public.profiles WHERE role = 'auditor' ORDER BY created_at DESC LIMIT 10;
