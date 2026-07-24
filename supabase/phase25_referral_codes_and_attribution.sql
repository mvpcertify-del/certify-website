-- =====================================================================
-- phase25 — Referral codes, order attribution, and partner-owned coupons
-- =====================================================================
--
-- Client instruction (24 Jul):
--   "The role of a referral Partner is to be able to register their referrals
--    & issue Referral coupons that have discount unique to them to enable them
--    monitor their referred clients & commission available to them."
--   "The REFERRAL Discount code should be activated in the referral Dashboard
--    to enable them share with their clients — Each referral should have a
--    Unique ID code which will be automated to be reflected through the whole
--    client purchase process."
--
-- ---------------------------------------------------------------------
-- WHAT WAS ACTUALLY BROKEN (found 24 Jul, all three independently fatal)
-- ---------------------------------------------------------------------
--
--  1. NO PARTNER HAS EVER BEEN PAID FOR A SALE MADE THROUGH THE LIVE FUNNEL.
--     api/checkout.js guestCheckoutHandler — the handler every real buyer
--     goes through — contained no referral lookup and no commission write at
--     all. Commission was only ever credited on the legacy logged-in path
--     (/client/checkout/:id), which the pay-first funnel replaced.
--
--  2. THE ADVERTISED "REFERRED CLIENTS GET 10% OFF" WAS NEVER APPLIED on that
--     funnel either. It exists only in the legacy branch. A buyer arriving
--     from a partner link paid full price. That promise is on a public page.
--
--  3. THERE WAS NO REFERRAL CODE. The `?ref=` value in the partner's share
--     link was `user.id.slice(0,8)` — computed in the browser, stored
--     nowhere, and resolved server-side by scanning the FIRST 1000 users for
--     a UUID prefix match (api/referrals.js). Partner #1001 could never be
--     resolved, and a prefix collision would silently pay the wrong partner.
--
-- ---------------------------------------------------------------------
-- DESIGN DECISIONS
-- ---------------------------------------------------------------------
--
--  A. ONE CODE, BOTH JOBS. `profiles.referral_code` is the partner's single
--     identifier. Typed at checkout it gives the buyer the referral discount
--     AND credits the partner. The client asked for "a Unique ID code ...
--     reflected through the whole client purchase process" — a separate
--     tracking link and discount coupon would be two codes for one purpose,
--     and partners would share the wrong one.
--
--  B. CODES ARE STORED, NOT DERIVED. A derived code cannot be changed, cannot
--     be revoked, cannot be looked up by an index, and — as above — silently
--     broke past 1000 users. `referral_code` is a real unique column with a
--     real index. Format REF-XXXXXX over a 28-char alphabet with 0/O/1/I/L
--     removed, because these get read aloud and typed off a phone screen.
--
--  C. ATTRIBUTION MOVES ONTO THE ORDER. `applications.referral_code` and
--     `applications.referrer_id` are stamped at purchase. Attribution was
--     previously done by matching the buyer's email against a row the partner
--     had manually typed — so a buyer who paid with a different address than
--     the partner entered lost the partner their commission. The code travels
--     with the order and cannot drift.
--
--  D. `referrals.application_id` links the credit to the sale that caused it,
--     which is what makes the credit idempotent: a second confirmation of the
--     same order cannot pay a partner twice.
--
--  E. `discount_coupons.referrer_id` lets an admin issue a partner-specific
--     coupon (a promotion beyond the standard rate) that still credits that
--     partner. `created_by` already existed but is an audit stamp that no
--     code reads — it is not, and must not be repurposed as, ownership.
--
--  F. `referrals.paid_at` is created here because api/referrals.js has been
--     WRITING to it since phase20 and it exists in no migration. markPayout
--     does `if (error) throw error`, so the "Mark as paid" button in
--     Settings → Payouts has been returning 500 for every payout, always.
--
-- Idempotent: safe to run more than once.
-- =====================================================================

BEGIN;

-- ---------------------------------------------------------------------
-- 1. profiles.referral_code — the partner's unique, shareable identifier
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS referral_code text;

-- Partial unique index, not a UNIQUE constraint: the overwhelming majority of
-- profiles are clients and will never hold a code. A plain unique constraint
-- would index every NULL row for nothing.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_referral_code_key
  ON public.profiles (referral_code)
  WHERE referral_code IS NOT NULL;

COMMENT ON COLUMN public.profiles.referral_code IS
  'Unique shareable code for a referral/consultancy partner. Typed at checkout '
  'it both discounts the buyer and credits this partner. Format REF-XXXXXX.';

-- ---------------------------------------------------------------------
-- 2. Code generator
-- ---------------------------------------------------------------------
-- Alphabet excludes 0 O 1 I L — these codes are read off a phone screen and
-- dictated over the phone, and those five are the pairs people mistype.
-- 28^6 ≈ 481 million combinations; the retry loop covers collisions.
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  alphabet text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  candidate text;
  i int;
  attempts int := 0;
BEGIN
  LOOP
    candidate := 'REF-';
    FOR i IN 1..6 LOOP
      candidate := candidate || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    END LOOP;

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.profiles WHERE referral_code = candidate
    );

    attempts := attempts + 1;
    IF attempts > 50 THEN
      -- Astronomically unlikely; fail loudly rather than loop forever.
      RAISE EXCEPTION 'generate_referral_code: could not find a free code after 50 attempts';
    END IF;
  END LOOP;

  RETURN candidate;
END;
$$;

-- ---------------------------------------------------------------------
-- 3. Backfill every existing partner
-- ---------------------------------------------------------------------
-- Covers both the promoted roles (phase14 referral, phase22 consultancy) and
-- the legacy stakeholder_type rows that predate them, so no partner who is
-- already sharing a link is left without a code.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT id FROM public.profiles
    WHERE referral_code IS NULL
      AND (
        role IN ('referral', 'consultancy')
        OR stakeholder_type IN ('referral', 'consultancy')
      )
  LOOP
    UPDATE public.profiles
      SET referral_code = public.generate_referral_code()
      WHERE id = r.id;
  END LOOP;
END $$;

-- ---------------------------------------------------------------------
-- 4. Auto-issue a code the moment someone becomes a partner
-- ---------------------------------------------------------------------
-- Fires on INSERT and on a role change into a partner role, so a partner who
-- registers tomorrow, or a client an admin promotes, has a usable code
-- immediately — no admin step, no empty dashboard.
CREATE OR REPLACE FUNCTION public.ensure_referral_code()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.referral_code IS NULL
     AND (
       NEW.role IN ('referral', 'consultancy')
       OR NEW.stakeholder_type IN ('referral', 'consultancy')
     )
  THEN
    NEW.referral_code := public.generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_ensure_referral_code ON public.profiles;
CREATE TRIGGER trg_profiles_ensure_referral_code
  BEFORE INSERT OR UPDATE OF role, stakeholder_type ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.ensure_referral_code();

-- ---------------------------------------------------------------------
-- 5. Attribution on the order itself
-- ---------------------------------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS referral_code text,
  ADD COLUMN IF NOT EXISTS referrer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'applications_referrer_id_fkey'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_referrer_id_fkey
      FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS applications_referrer_id_idx
  ON public.applications (referrer_id)
  WHERE referrer_id IS NOT NULL;

COMMENT ON COLUMN public.applications.referral_code IS
  'The partner code used at checkout. Stamped at purchase so attribution '
  'cannot drift if the buyer later changes their email address.';

-- ---------------------------------------------------------------------
-- 6. referrals — link the credit to the sale, and the missing paid_at
-- ---------------------------------------------------------------------
ALTER TABLE public.referrals
  ADD COLUMN IF NOT EXISTS application_id uuid,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'referrals_application_id_fkey'
  ) THEN
    ALTER TABLE public.referrals
      ADD CONSTRAINT referrals_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES public.applications(id) ON DELETE SET NULL;
  END IF;
END $$;

-- One credit per order. This is the idempotency guarantee: a re-confirmed
-- payment, or an admin toggling an order paid → unpaid → paid, cannot create
-- a second commission row for the same sale.
CREATE UNIQUE INDEX IF NOT EXISTS referrals_application_id_key
  ON public.referrals (application_id)
  WHERE application_id IS NOT NULL;

COMMENT ON COLUMN public.referrals.paid_at IS
  'When the commission was actually paid out. api/referrals.js markPayout has '
  'been writing this since phase20 against a column that did not exist, so '
  'every "Mark as paid" click returned a 500.';

COMMENT ON COLUMN public.referrals.source IS
  'How the referral was attributed: code | manual | signup_link.';

-- ---------------------------------------------------------------------
-- 7. Partner-owned coupons
-- ---------------------------------------------------------------------
-- Lets an admin issue a coupon that belongs to a named partner, so a
-- promotion beyond the standard rate still credits the right person.
ALTER TABLE public.discount_coupons
  ADD COLUMN IF NOT EXISTS referrer_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'discount_coupons_referrer_id_fkey'
  ) THEN
    ALTER TABLE public.discount_coupons
      ADD CONSTRAINT discount_coupons_referrer_id_fkey
      FOREIGN KEY (referrer_id) REFERENCES public.profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS discount_coupons_referrer_id_idx
  ON public.discount_coupons (referrer_id)
  WHERE referrer_id IS NOT NULL;

COMMENT ON COLUMN public.discount_coupons.referrer_id IS
  'The partner this coupon belongs to. Redeeming it credits them. Distinct '
  'from created_by, which is an audit stamp for who typed it in.';

-- A partner may read the coupons issued to them. They may NOT write: coupon
-- creation stays with the super admin (discount_coupons_super_admin_write,
-- phase4). Handing partners the ability to mint their own discounts is a
-- commercial decision, not a technical one, and has not been asked for.
DROP POLICY IF EXISTS discount_coupons_partner_read ON public.discount_coupons;
CREATE POLICY discount_coupons_partner_read ON public.discount_coupons
  FOR SELECT
  USING (referrer_id = auth.uid());

COMMIT;

-- =====================================================================
-- Verification — run after applying
-- =====================================================================
-- SELECT id, full_name, role, referral_code
--   FROM public.profiles
--  WHERE role IN ('referral','consultancy')
--  ORDER BY created_at;
--
-- Expect: every partner has a REF-XXXXXX code, all distinct.
--
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name = 'referrals' AND column_name IN ('paid_at','application_id','source');
--
-- Expect: 3 rows.
