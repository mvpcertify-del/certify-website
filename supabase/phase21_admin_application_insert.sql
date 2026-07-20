-- =====================================================================
-- phase21 — let admins create an application on a client's behalf
-- =====================================================================
--
-- Symptom: Admin → Applications → "Add Application" submits and nothing
-- happens. The modal shows an error, but it renders above the fold so it
-- is easy to miss. The network log is unambiguous:
--
--   POST https://<ref>.supabase.co/rest/v1/applications?select=id  ->  403
--
-- A 403 from PostgREST on an INSERT means row-level security rejected the
-- row ("new row violates row-level security policy"). The applications
-- INSERT policy in production only permits a client to insert their OWN
-- row (client_id = auth.uid()). AdminApplications.jsx inserts with
-- client_id = the chosen client, so a super admin is always rejected.
--
-- The insert runs from the browser on the anon key as the logged-in admin
-- (src/pages/admin/AdminApplications.jsx ~line 180), so the fix belongs in
-- RLS, not in api/ — and api/ is at exactly 12/12 Vercel Hobby routes
-- anyway.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Diagnostic — run this FIRST and keep the output.
--    It shows what is on the table today, before anything changes.
-- ---------------------------------------------------------------------
-- SELECT policyname, cmd, roles, qual, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'applications'
--  ORDER BY cmd, policyname;

-- ---------------------------------------------------------------------
-- 1. Staff INSERT policy
-- ---------------------------------------------------------------------
-- Scoped the same way every other admin list view is scoped: a super admin
-- may create an application for any client; a country admin only for a
-- client inside their own region. Auditors, certification bodies and
-- referrals are NOT included — none of them onboard clients.
--
-- WITH CHECK is evaluated against the row being inserted, so `subject` is
-- the client the application is being created for.

ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_staff_insert" ON public.applications;
CREATE POLICY "applications_staff_insert"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1
      FROM public.profiles me
      LEFT JOIN public.profiles subject ON subject.id = public.applications.client_id
     WHERE me.id = auth.uid()
       AND (
         me.role = 'super_admin'
         OR (me.role = 'regional_admin'
             AND me.region IS NOT NULL
             AND me.region = subject.region)
       )
  ));

-- ---------------------------------------------------------------------
-- 2. Keep the client's own-row insert working
-- ---------------------------------------------------------------------
-- Policies are OR'd together, so adding the staff policy cannot take this
-- away — but the production policy set is not in this repo, so this
-- recreates the one the app depends on rather than assuming it is there.

DROP POLICY IF EXISTS "applications_client_insert_own" ON public.applications;
CREATE POLICY "applications_client_insert_own"
  ON public.applications FOR INSERT
  TO authenticated
  WITH CHECK (client_id = auth.uid());

-- ---------------------------------------------------------------------
-- 3. Verify
-- ---------------------------------------------------------------------
-- Expect at least applications_staff_insert and
-- applications_client_insert_own with cmd = 'INSERT'.
--
-- SELECT policyname, cmd, with_check
--   FROM pg_policies
--  WHERE schemaname = 'public' AND tablename = 'applications' AND cmd = 'INSERT';
