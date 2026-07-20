-- =====================================================================
-- phase23 — Consultancy partner contracts + KPI tracking
-- =====================================================================
--
-- Client instruction, 21 Jul:
--   "Create an Electronic contract which each Consultant partner will sign
--    digitally or accept the terms & rules mentioned in the contract
--    electronically. The contract will be valid for 12 months renewable &
--    will be effective from date of approval by Certify.cx Administrator."
--   "The monthly KPI for a Consultancy partner is 5 paying Clients per
--    month. If no business is generated in 3 months then the account will
--    be deactivated."
--
-- Two decisions worth recording, both agreed before building:
--
--  1. Contract TEXT is admin-editable. A signed agreement is a legal
--     document; hardcoding it would mean a code change every time a clause
--     moves. The seeded text below is a DRAFT built from the client's own
--     terms and must be reviewed before any partner signs it.
--
--  2. The 3-month rule FLAGS, it does not auto-deactivate. Automatically
--     banning a partner's login with no human in the loop is a hard action
--     to undo, and the first account it would hit is the client's own
--     consultancy. `profiles.is_active` (phase10) stays the manual switch;
--     this migration only supplies the evidence an admin acts on.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Contract templates — the editable agreement text
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.contract_templates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which kind of partner this agreement is for. Consultancy is the only
  -- one the client has asked for; affiliates are likely next.
  partner_type  text NOT NULL DEFAULT 'consultancy',
  version       integer NOT NULL DEFAULT 1,
  title         text NOT NULL,
  -- Plain text, one clause per paragraph. Deliberately not HTML: this is
  -- rendered into a PDF and shown in a read-only pane, and accepting
  -- markup here would mean accepting an injection surface on a document
  -- users are asked to trust.
  body          text NOT NULL,
  -- Term length in months. The client specified 12, renewable.
  term_months   integer NOT NULL DEFAULT 12,
  is_active     boolean NOT NULL DEFAULT true,
  created_by    uuid REFERENCES public.profiles(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Only one active template per partner type, or "which contract did they
-- sign?" stops having a single answer.
CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_active_unique_idx
  ON public.contract_templates (partner_type)
  WHERE is_active;

CREATE UNIQUE INDEX IF NOT EXISTS contract_templates_version_unique_idx
  ON public.contract_templates (partner_type, version);

-- ---------------------------------------------------------------------
-- 2. Acceptances — the signature record
-- ---------------------------------------------------------------------
-- One row per partner per contract version. This is the evidence that a
-- specific person accepted specific words at a specific time, so the text
-- is SNAPSHOTTED here rather than referenced: editing the template later
-- must never rewrite what somebody already signed.
CREATE TABLE IF NOT EXISTS public.contract_acceptances (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id        uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  template_id       uuid REFERENCES public.contract_templates(id) ON DELETE SET NULL,
  partner_type      text NOT NULL DEFAULT 'consultancy',
  version           integer NOT NULL,
  title_snapshot    text NOT NULL,
  body_snapshot     text NOT NULL,

  -- The digital signature: what they typed, and when.
  signed_name       text NOT NULL,
  accepted_at       timestamptz NOT NULL DEFAULT now(),
  accepted_ip       text,
  user_agent        text,

  -- "effective from date of approval by Certify.cx Administrator" — so this
  -- is NOT accepted_at. It is set when the admin approves, which may be
  -- before or after the partner signs.
  effective_from    date,
  expires_at        date,

  storage_path      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- A partner signs a given version once.
CREATE UNIQUE INDEX IF NOT EXISTS contract_acceptances_unique_idx
  ON public.contract_acceptances (profile_id, partner_type, version);

CREATE INDEX IF NOT EXISTS contract_acceptances_profile_idx
  ON public.contract_acceptances (profile_id);

-- ---------------------------------------------------------------------
-- 3. Seed the draft consultancy agreement
-- ---------------------------------------------------------------------
-- ⚠️ DRAFT. Assembled from the client's stated terms on 21 Jul. It has not
-- been reviewed by a lawyer and must be checked before any partner signs.
-- An admin can rewrite every word of it in the admin panel without a code
-- change; doing so creates version 2 and leaves signed copies untouched.
INSERT INTO public.contract_templates (partner_type, version, title, body, term_months, is_active)
SELECT 'consultancy', 1, 'Consultancy Partner Agreement',
$CONTRACT$1. APPOINTMENT

Certify.cx appoints the Partner as a non-exclusive Consultancy Partner to introduce and onboard clients onto the Certify.cx certification platform. The Partner acts as an independent contractor. Nothing in this Agreement creates an employment, agency, joint venture or partnership relationship, and the Partner has no authority to bind Certify.cx.

2. THE PARTNER'S RESPONSIBILITIES

The Partner shall introduce and register clients on the Certify.cx platform, and shall follow up with each client through to completion of payment. The Partner shall represent Certify.cx accurately and shall not make any warranty, promise or representation on behalf of Certify.cx that is not expressly authorised in writing.

3. COMMISSION

Certify.cx shall credit the Partner twenty-five percent (25%) of the net sale value of each client whom the Partner onboards and registers on the platform, where "net sale value" means the amount actually received from the client after all discounts.

Commission is earned only on payments actually received. Where a payment is refunded, charged back or reversed, the corresponding commission is reversed.

Commission is credited to the Partner's account on the platform and paid in accordance with Certify.cx's payment schedule then in force.

4. PERFORMANCE (KPI)

The Partner's monthly performance target is five (5) paying clients per calendar month.

If the Partner generates no business for a period of three (3) consecutive months, Certify.cx may deactivate the Partner's account. Certify.cx will give notice before deactivating an account under this clause.

5. TERM AND RENEWAL

This Agreement is effective from the date the Partner's registration is approved by a Certify.cx Administrator and remains in force for twelve (12) months from that date. It is renewable by agreement of both parties.

6. CONFIDENTIALITY

The Partner shall keep confidential all client information, pricing, and platform information obtained under this Agreement, and shall not disclose it to any third party or use it for any purpose other than performing this Agreement. This obligation survives termination.

7. DATA PROTECTION

The Partner shall handle personal data of clients only as necessary to perform this Agreement and in accordance with applicable data protection law.

8. TERMINATION

Either party may terminate this Agreement on thirty (30) days written notice. Certify.cx may terminate immediately where the Partner is in material breach, including any breach of clause 6.

Commission already earned on payments received before termination remains payable.

9. GOVERNING LAW

This Agreement is governed by the laws of the United Arab Emirates.

10. ELECTRONIC ACCEPTANCE

By typing their full name and confirming below, the Partner agrees to be bound by this Agreement. The Partner acknowledges that this electronic acceptance has the same effect as a handwritten signature, and that the date, time and network address of acceptance are recorded.$CONTRACT$,
       12, true
WHERE NOT EXISTS (
  SELECT 1 FROM public.contract_templates WHERE partner_type = 'consultancy'
);

-- ---------------------------------------------------------------------
-- 4. KPI support
-- ---------------------------------------------------------------------
-- No new counters are stored. A stored monthly tally would drift the moment
-- a sale is refunded or back-dated, and `referrals` already holds the truth
-- (one row per introduced client, with converted_at set when they paid).
-- This view derives the KPI so it can never disagree with the ledger.
--
-- "Paying client" = a referral row that reached 'converted'. A consultancy
-- with no conversions at all reads last_conversion_at NULL and
-- months_since_last_conversion NULL — deliberately distinct from a partner
-- who was once active and went quiet.

CREATE OR REPLACE VIEW public.consultancy_kpi AS
SELECT
  p.id                                        AS profile_id,
  p.full_name,
  p.company_name,
  p.email,
  p.region,
  p.country,
  p.is_active,
  p.approval_status,
  p.created_at                                AS joined_at,
  -- Falls back to 25 to match api/checkout.js, which defaults a consultancy
  -- to 25% when no explicit override is set.
  COALESCE(p.commission_percent_override, 25) AS commission_percent,

  -- Lifetime
  COUNT(r.id) FILTER (WHERE r.status = 'converted')          AS total_paying_clients,
  COALESCE(SUM(r.commission_amount) FILTER
           (WHERE r.status = 'converted'), 0)                AS total_commission,

  -- This calendar month, against the target of 5
  COUNT(r.id) FILTER (
    WHERE r.status = 'converted'
      AND r.converted_at >= date_trunc('month', now())
  )                                                          AS paying_clients_this_month,

  -- Rolling 3 months — the window the deactivation rule is written against
  COUNT(r.id) FILTER (
    WHERE r.status = 'converted'
      AND r.converted_at >= now() - interval '3 months'
  )                                                          AS paying_clients_last_3_months,

  MAX(r.converted_at) FILTER (WHERE r.status = 'converted')  AS last_conversion_at,

  -- Whole months since the last conversion. NULL when they never converted.
  CASE
    WHEN MAX(r.converted_at) FILTER (WHERE r.status = 'converted') IS NULL THEN NULL
    ELSE EXTRACT(YEAR FROM age(now(),
           MAX(r.converted_at) FILTER (WHERE r.status = 'converted'))) * 12
       + EXTRACT(MONTH FROM age(now(),
           MAX(r.converted_at) FILTER (WHERE r.status = 'converted')))
  END                                                        AS months_since_last_conversion,

  -- The flag an admin acts on. Nothing is deactivated automatically.
  -- Measured from the approval date, because that is when the contract
  -- becomes effective and the KPI starts running. A partner approved less
  -- than 3 months ago is never at risk, however quiet they have been —
  -- otherwise every new partner is flagged on day one.
  (
    p.is_active
    AND COALESCE(p.approved_at, p.created_at) < now() - interval '3 months'
    AND COUNT(r.id) FILTER (
          WHERE r.status = 'converted'
            AND r.converted_at >= now() - interval '3 months'
        ) = 0
  )                                                          AS at_risk,

  -- Contract state
  ca.accepted_at    AS contract_accepted_at,
  ca.effective_from AS contract_effective_from,
  ca.expires_at     AS contract_expires_at,
  ca.version        AS contract_version,
  (ca.id IS NOT NULL AND (ca.expires_at IS NULL OR ca.expires_at >= CURRENT_DATE))
                    AS contract_current

FROM public.profiles p
LEFT JOIN public.referrals r ON r.referrer_id = p.id
LEFT JOIN LATERAL (
  SELECT * FROM public.contract_acceptances a
   WHERE a.profile_id = p.id AND a.partner_type = 'consultancy'
   ORDER BY a.version DESC
   LIMIT 1
) ca ON true
WHERE p.stakeholder_type = 'consultancy' OR p.role = 'consultancy'
GROUP BY p.id, p.full_name, p.company_name, p.email, p.region, p.country,
         p.is_active, p.approval_status, p.created_at, p.approved_at,
         p.commission_percent_override,
         ca.id, ca.accepted_at, ca.effective_from, ca.expires_at, ca.version;

-- A view in Postgres runs with its owner's rights, so it would BYPASS the
-- row-level security on profiles and referrals and expose every partner's
-- earnings to any signed-in user. Lock it to the service role; the admin UI
-- reads it through api/user.js, which verifies the caller is an admin.
REVOKE ALL ON public.consultancy_kpi FROM PUBLIC;
REVOKE ALL ON public.consultancy_kpi FROM anon, authenticated;

-- ---------------------------------------------------------------------
-- 5. RLS
-- ---------------------------------------------------------------------
ALTER TABLE public.contract_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_acceptances ENABLE ROW LEVEL SECURITY;

-- Any signed-in user may read the active template — a partner has to be able
-- to read the agreement before signing it.
DROP POLICY IF EXISTS "contract_templates_read_active" ON public.contract_templates;
CREATE POLICY "contract_templates_read_active"
  ON public.contract_templates FOR SELECT
  TO authenticated
  USING (is_active);

DROP POLICY IF EXISTS "contract_templates_admin_all" ON public.contract_templates;
CREATE POLICY "contract_templates_admin_all"
  ON public.contract_templates FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles me
                  WHERE me.id = auth.uid() AND me.role = 'super_admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles me
                       WHERE me.id = auth.uid() AND me.role = 'super_admin'));

-- A partner reads their own signature record; nobody may edit one after the
-- fact, from any client. Writes go through the service role only.
DROP POLICY IF EXISTS "contract_acceptances_own_select" ON public.contract_acceptances;
CREATE POLICY "contract_acceptances_own_select"
  ON public.contract_acceptances FOR SELECT
  TO authenticated
  USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "contract_acceptances_staff_select" ON public.contract_acceptances;
CREATE POLICY "contract_acceptances_staff_select"
  ON public.contract_acceptances FOR SELECT
  TO authenticated
  USING (EXISTS (
    SELECT 1
      FROM public.profiles me
      LEFT JOIN public.profiles subject ON subject.id = public.contract_acceptances.profile_id
     WHERE me.id = auth.uid()
       AND (
         me.role = 'super_admin'
         OR (me.role = 'regional_admin' AND me.region IS NOT NULL
             AND me.region = subject.region)
       )
  ));

-- ---------------------------------------------------------------------
-- 6. Private bucket for signed contract PDFs
-- ---------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public)
SELECT 'contracts', 'contracts', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'contracts');

DROP POLICY IF EXISTS "contracts_owner_read" ON storage.objects;
CREATE POLICY "contracts_owner_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "contracts_staff_read" ON storage.objects;
CREATE POLICY "contracts_staff_read"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'contracts'
    AND EXISTS (SELECT 1 FROM public.profiles me
                 WHERE me.id = auth.uid()
                   AND me.role IN ('super_admin','regional_admin'))
  );

-- ---------------------------------------------------------------------
-- 7. Verify
-- ---------------------------------------------------------------------
-- SELECT partner_type, version, term_months, is_active,
--        length(body) AS body_chars
--   FROM public.contract_templates;
--
-- SELECT full_name, company_name, total_paying_clients,
--        paying_clients_this_month, paying_clients_last_3_months,
--        months_since_last_conversion, at_risk, contract_current
--   FROM public.consultancy_kpi
--  ORDER BY at_risk DESC, total_paying_clients DESC;
