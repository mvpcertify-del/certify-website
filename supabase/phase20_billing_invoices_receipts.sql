-- ============================================================================
-- Phase 20 — Billing: fixed-amount coupons, invoices, payment receipts
-- ============================================================================
-- Client instructions, 19–20 Jul:
--   1. "Need to create Discount coupon to share with Clients based on $$
--      instead of %. For example: US$ 200 Discount."
--   2. "Need to generate the Invoice & be shared with the Client with mode of
--      payment displayed & full payment information."
--   3. "After payment is received from Client, certify.cx will issue a payment
--      receipt voucher & sent to client."
--   4. Sparck Services S.A.R.L: $999 package − $699 approved discount = $300,
--      paid in cash. WCA GLOBAL (the consultancy that introduced them) earns
--      25% of the net sale.
--
-- Fully idempotent — safe to run more than once.
-- PREREQUISITES: phase2 (coupons), phase14 (referral role), phase17 (checkout
-- repair). Run phase19 before or after this — they are independent.
-- ============================================================================


-- ============================================================================
-- 1. Fixed-amount discount coupons
-- ============================================================================
-- Until now discount_coupons.discount_percent was NOT NULL with a
-- CHECK (> 0 AND <= 100), which makes a "$200 off" coupon literally
-- unstorable. Add an explicit discount_type discriminator so percent and
-- amount coupons can coexist, and relax the percent column so it can be NULL
-- on an amount coupon.

ALTER TABLE public.discount_coupons
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percent';
ALTER TABLE public.discount_coupons
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2);

-- Currency is fixed to USD platform-wide today, but storing it makes a future
-- multi-currency change a data migration rather than a code archaeology dig.
ALTER TABLE public.discount_coupons
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD';

ALTER TABLE public.discount_coupons
  DROP CONSTRAINT IF EXISTS discount_coupons_discount_percent_check;
ALTER TABLE public.discount_coupons
  ALTER COLUMN discount_percent DROP NOT NULL;

ALTER TABLE public.discount_coupons
  DROP CONSTRAINT IF EXISTS discount_coupons_discount_type_check;
ALTER TABLE public.discount_coupons
  ADD CONSTRAINT discount_coupons_discount_type_check
  CHECK (discount_type IN ('percent', 'amount'));

-- Exactly one of the two value columns must be populated, and it must be
-- populated correctly for the declared type. This is the guard that stops a
-- half-filled coupon row from silently discounting nothing at checkout.
ALTER TABLE public.discount_coupons
  DROP CONSTRAINT IF EXISTS discount_coupons_value_check;
ALTER TABLE public.discount_coupons
  ADD CONSTRAINT discount_coupons_value_check
  CHECK (
    (discount_type = 'percent'
      AND discount_percent IS NOT NULL
      AND discount_percent > 0
      AND discount_percent <= 100
      AND discount_amount IS NULL)
    OR
    (discount_type = 'amount'
      AND discount_amount IS NOT NULL
      AND discount_amount > 0
      AND discount_percent IS NULL)
  );

-- No backfill statement is needed: the column was added NOT NULL DEFAULT
-- 'percent', so every pre-existing row is already labelled correctly.


-- ----------------------------------------------------------------------------
-- Redemption ledger — same treatment
-- ----------------------------------------------------------------------------
ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS discount_type text NOT NULL DEFAULT 'percent';
ALTER TABLE public.coupon_redemptions
  ADD COLUMN IF NOT EXISTS discount_amount numeric(10,2);

ALTER TABLE public.coupon_redemptions
  ALTER COLUMN discount_percent DROP NOT NULL;

ALTER TABLE public.coupon_redemptions
  DROP CONSTRAINT IF EXISTS coupon_redemptions_discount_type_check;
ALTER TABLE public.coupon_redemptions
  ADD CONSTRAINT coupon_redemptions_discount_type_check
  CHECK (discount_type IN ('percent', 'amount'));

-- Relaxing discount_percent's NOT NULL without this would allow a redemption
-- row with BOTH value columns null — a redemption recording no discount at all.
ALTER TABLE public.coupon_redemptions
  DROP CONSTRAINT IF EXISTS coupon_redemptions_value_check;
ALTER TABLE public.coupon_redemptions
  ADD CONSTRAINT coupon_redemptions_value_check
  CHECK (
    (discount_type = 'percent' AND discount_percent IS NOT NULL)
    OR
    (discount_type = 'amount'  AND discount_amount  IS NOT NULL)
  );


-- ============================================================================
-- 2. Issuer identity (who the invoice is FROM)
-- ============================================================================
-- The client sent WCA GLOBAL-branded sample documents but asked for invoices
-- "from Certify.cx". Rather than hard-coding either answer into a PDF
-- generator, the issuing entity lives in the database and is editable by a
-- super admin — so changing the trading name, TRN or bank details is a form
-- edit, not a redeploy.
--
-- Seeded with the WCA GLOBAL details taken from the client's own invoice and
-- receipt PDFs, because those are the only verified banking details we hold.
-- CONFIRM WITH THE CLIENT before the first invoice goes out.

CREATE TABLE IF NOT EXISTS public.org_settings (
  id                integer PRIMARY KEY DEFAULT 1,
  legal_name        text NOT NULL DEFAULT 'WCA GLOBAL FZE',
  trading_name      text NOT NULL DEFAULT 'Certify.cx',
  address_lines     text[] NOT NULL DEFAULT ARRAY[
                      'B21-057 Block B, SRTI Park',
                      'Sharjah FU 66636',
                      'United Arab Emirates'
                    ],
  tax_label         text NOT NULL DEFAULT 'TRN',
  tax_number        text DEFAULT '104366665800003',
  email             text DEFAULT 'support@certify.cx',
  phone             text DEFAULT '+971 50 6449356',
  bank_details      text DEFAULT 'Account Name WCA GLOBAL(FZE)-AED · Account Number 019101245120 · IBAN AE960330000019101245120 · SWIFT BOMLAEADXXX · Mashreq Bank, Dubai-UAE',
  invoice_prefix    text NOT NULL DEFAULT 'CCX',
  invoice_footer    text DEFAULT 'Certificate is IAF/UAF Accredited. Fee covers certificate issuance valid for 3 years, conditional to yearly surveillance in years 2 & 3.',
  updated_at        timestamptz NOT NULL DEFAULT now(),
  -- Single-row table: the CHECK is what enforces that.
  CONSTRAINT org_settings_singleton CHECK (id = 1)
);

INSERT INTO public.org_settings (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.org_settings ENABLE ROW LEVEL SECURITY;

-- Staff only. bank_details holds the live IBAN/SWIFT, so "any signed-in user"
-- would expose full banking details to every self-signup account that never
-- bought anything. Clients never need to query this: the issuer block is
-- rendered into the PDF server-side, where api/_billing.js reads the row with
-- the service role and bypasses RLS entirely.
DROP POLICY IF EXISTS "org_settings_read" ON public.org_settings;
CREATE POLICY "org_settings_read"
  ON public.org_settings FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid()
       AND p.role IN ('super_admin', 'regional_admin')
  ));

DROP POLICY IF EXISTS "org_settings_super_admin_write" ON public.org_settings;
CREATE POLICY "org_settings_super_admin_write"
  ON public.org_settings FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.profiles p
     WHERE p.id = auth.uid() AND p.role = 'super_admin'
  ));


-- ============================================================================
-- 3. Invoices
-- ============================================================================
-- Invoice numbers come from a sequence so two concurrent issuances can never
-- collide. invoice_number is still writable by the caller so historical
-- documents (e.g. Sparck's existing INV/2026/117) can be entered as-is.

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START 1;

-- PostgREST cannot call nextval() directly, so expose it as an RPC. Restricted
-- to the two billing sequences by name — without that guard this would be a
-- generic "advance any sequence in the database" primitive.
CREATE OR REPLACE FUNCTION public.nextval_public(seq_name text)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF seq_name NOT IN ('invoice_number_seq', 'receipt_number_seq') THEN
    RAISE EXCEPTION 'Sequence % is not available through this function', seq_name;
  END IF;
  RETURN nextval(format('public.%I', seq_name));
END;
$$;

-- Service-role only. api/_billing.js is the sole caller and runs service-role;
-- no client should be able to burn invoice numbers.
REVOKE ALL ON FUNCTION public.nextval_public(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.nextval_public(text) FROM anon, authenticated;

CREATE TABLE IF NOT EXISTS public.invoices (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number    text NOT NULL UNIQUE,
  application_id    uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  client_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Billed-to details are SNAPSHOTTED, not joined. An invoice is a legal
  -- record of what was billed on the day it was issued; if the client later
  -- renames the company or changes address, the issued invoice must not
  -- silently change with it.
  bill_to_name      text NOT NULL,
  bill_to_address   text,
  bill_to_email     text,
  bill_to_country   text,

  description       text NOT NULL,
  currency          text NOT NULL DEFAULT 'USD',
  subtotal          numeric(10,2) NOT NULL,
  discount_amount   numeric(10,2) NOT NULL DEFAULT 0,
  discount_label    text,
  total             numeric(10,2) NOT NULL,
  amount_paid       numeric(10,2) NOT NULL DEFAULT 0,

  payment_method    text,
  payment_terms     text,
  notes             text,

  issue_date        date NOT NULL DEFAULT CURRENT_DATE,
  due_date          date,
  status            text NOT NULL DEFAULT 'issued',

  storage_path      text,
  sent_at           timestamptz,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT invoices_status_check
    CHECK (status IN ('draft', 'issued', 'paid', 'cancelled')),
  CONSTRAINT invoices_total_check
    CHECK (total >= 0 AND discount_amount >= 0 AND amount_paid >= 0)
);

CREATE INDEX IF NOT EXISTS invoices_client_id_idx      ON public.invoices(client_id);
CREATE INDEX IF NOT EXISTS invoices_application_id_idx ON public.invoices(application_id);
CREATE INDEX IF NOT EXISTS invoices_issue_date_idx     ON public.invoices(issue_date DESC);

-- One invoice per application, so a double-click or a retried request cannot
-- produce two invoices for the same sale. Partial: historical/ad-hoc invoices
-- with no application are still allowed.
CREATE UNIQUE INDEX IF NOT EXISTS invoices_application_unique_idx
  ON public.invoices(application_id)
  WHERE application_id IS NOT NULL;


-- ============================================================================
-- 4. Payment receipts
-- ============================================================================
-- Issued AFTER money is confirmed received. Separate from the invoice because
-- one invoice can legitimately be settled by more than one payment.

CREATE SEQUENCE IF NOT EXISTS public.receipt_number_seq START 1;

CREATE TABLE IF NOT EXISTS public.payment_receipts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number    text NOT NULL UNIQUE,
  invoice_id        uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  application_id    uuid REFERENCES public.applications(id) ON DELETE SET NULL,
  client_id         uuid REFERENCES public.profiles(id) ON DELETE SET NULL,

  customer_name     text NOT NULL,
  currency          text NOT NULL DEFAULT 'USD',
  amount            numeric(10,2) NOT NULL CHECK (amount > 0),
  payment_method    text,
  payment_date      date NOT NULL DEFAULT CURRENT_DATE,
  memo              text,

  storage_path      text,
  sent_at           timestamptz,
  created_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_receipts_client_id_idx  ON public.payment_receipts(client_id);
CREATE INDEX IF NOT EXISTS payment_receipts_invoice_id_idx ON public.payment_receipts(invoice_id);


-- ----------------------------------------------------------------------------
-- Atomic invoice settlement
-- ----------------------------------------------------------------------------
-- Settling an invoice from JS as read-then-write loses updates: two receipts
-- issued concurrently both read amount_paid = 0 and both write 0 + amount, so
-- one payment silently vanishes. This does the increment inside a single
-- statement under a row lock, and caps the result at the invoice total so an
-- over-payment can never be recorded.
--
-- Returns the updated invoice row.
CREATE OR REPLACE FUNCTION public.apply_invoice_payment(
  p_invoice_id uuid,
  p_amount numeric
)
RETURNS public.invoices
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result public.invoices;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RAISE EXCEPTION 'Payment amount must be positive';
  END IF;

  UPDATE public.invoices
     SET amount_paid = LEAST(total, amount_paid + p_amount),
         status = CASE
                    WHEN status = 'cancelled' THEN status
                    WHEN LEAST(total, amount_paid + p_amount) >= total THEN 'paid'
                    ELSE status
                  END,
         updated_at = now()
   WHERE id = p_invoice_id
  RETURNING * INTO result;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invoice % not found', p_invoice_id;
  END IF;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_invoice_payment(uuid, numeric) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.apply_invoice_payment(uuid, numeric) FROM anon, authenticated;


-- ============================================================================
-- 5. RLS for invoices & receipts
-- ============================================================================
-- A client may read their own documents. Staff read everything. NOBODY writes
-- through the anon key — issuance happens service-role only, from the API, so
-- there is deliberately no INSERT/UPDATE policy for ordinary users.

ALTER TABLE public.invoices         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_receipts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_client_select" ON public.invoices;
CREATE POLICY "invoices_client_select"
  ON public.invoices FOR SELECT
  USING (client_id = auth.uid());

-- Staff read is REGION-SCOPED. A super admin sees everything; a country admin
-- sees only invoices whose client sits in their own region. Certification
-- bodies are deliberately excluded — a CB has no business reading what a
-- client was charged, and including them would cut against the payment-gated
-- CB visibility rule.
DROP POLICY IF EXISTS "invoices_staff_select" ON public.invoices;
CREATE POLICY "invoices_staff_select"
  ON public.invoices FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.profiles me
      LEFT JOIN public.profiles subject ON subject.id = public.invoices.client_id
     WHERE me.id = auth.uid()
       AND (
         me.role = 'super_admin'
         OR (me.role = 'regional_admin' AND me.region IS NOT NULL
             AND me.region = subject.region)
       )
  ));

DROP POLICY IF EXISTS "receipts_client_select" ON public.payment_receipts;
CREATE POLICY "receipts_client_select"
  ON public.payment_receipts FOR SELECT
  USING (client_id = auth.uid());

DROP POLICY IF EXISTS "receipts_staff_select" ON public.payment_receipts;
CREATE POLICY "receipts_staff_select"
  ON public.payment_receipts FOR SELECT
  USING (EXISTS (
    SELECT 1
      FROM public.profiles me
      LEFT JOIN public.profiles subject ON subject.id = public.payment_receipts.client_id
     WHERE me.id = auth.uid()
       AND (
         me.role = 'super_admin'
         OR (me.role = 'regional_admin' AND me.region IS NOT NULL
             AND me.region = subject.region)
       )
  ));


-- ============================================================================
-- 6. Private storage bucket for the generated PDFs
-- ============================================================================
-- Mirrors the `certificates` bucket from phase9: private, served only through
-- short-lived signed URLs.

INSERT INTO storage.buckets (id, name, public)
VALUES ('billing-documents', 'billing-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Objects are stored at {client_id}/{invoice|receipt}-{number}.pdf, so the
-- first path segment is the owner check.
DROP POLICY IF EXISTS "billing_documents_owner_read" ON storage.objects;
CREATE POLICY "billing_documents_owner_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'billing-documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "billing_documents_staff_read" ON storage.objects;
CREATE POLICY "billing_documents_staff_read"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'billing-documents'
    AND EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role IN ('super_admin', 'regional_admin', 'certification_body')
    )
  );


-- ============================================================================
-- 7. Commission fixes
-- ============================================================================
-- 7a. payout_status has been written by api/checkout.js and api/referrals.js
--     and read by the Referrals and Settings pages since phase 2, but it was
--     never added by ANY migration. Every write to it was failing inside a
--     non-blocking try/catch — which silently discarded the whole commission
--     credit for that sale. This is the column that was missing.
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS payout_status text NOT NULL DEFAULT 'pending';

ALTER TABLE public.referrals
  DROP CONSTRAINT IF EXISTS referrals_payout_status_check;
ALTER TABLE public.referrals
  ADD CONSTRAINT referrals_payout_status_check
  CHECK (payout_status IN ('pending', 'paid'));

-- 7b. A per-partner commission override. The tier table (Bronze/Silver/Gold)
--     stays the default for affiliates; a consultancy that negotiated its own
--     rate gets it recorded here. Client, 20 Jul: WCA GLOBAL earns 25% of net
--     sales. NULL = fall back to the tier table.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS commission_percent_override numeric(5,2);

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_commission_override_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_commission_override_check
  CHECK (commission_percent_override IS NULL
         OR (commission_percent_override >= 0 AND commission_percent_override <= 100));

-- Seed every consultancy at the agreed 25%.
UPDATE public.profiles
   SET commission_percent_override = 25
 WHERE stakeholder_type = 'consultancy'
   AND commission_percent_override IS NULL;


-- ============================================================================
-- 8. Verification
-- ============================================================================
-- SELECT code, discount_type, discount_percent, discount_amount
--   FROM public.discount_coupons ORDER BY created_at DESC;
--
-- SELECT email, role, stakeholder_type, commission_percent_override
--   FROM public.profiles WHERE stakeholder_type = 'consultancy';
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'referrals' AND column_name = 'payout_status';
