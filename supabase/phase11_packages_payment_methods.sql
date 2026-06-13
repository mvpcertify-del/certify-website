-- ============================================
-- Certify.cx — Phase 11 Migration: Packages + Payment Methods
-- ============================================
-- Run in the Supabase SQL Editor.
-- Idempotent (safe to re-run).
--
-- Background:
--   1. The two-package model (Standard / Premium) was replaced by three
--      packages stored in applications.selected_package:
--        Bronze = base certification
--        Silver = Bronze + 12 months online support
--        Gold   = Silver + 12 months system internal audit
--      Pricing logic lives in src/utils/pricing.js (base + add-ons), shared
--      between the checkout UI and api/checkout.js. No data migration of the
--      text column is required — historical rows keep their stored label and
--      normalizeTier() maps legacy 'Standard'→silver, 'Premium'→gold.
--
--   2. Checkout now offers four payment methods:
--        card, paypal        → processed online via Stripe
--        moneygram, bank_transfer → offline; the buyer transfers funds and an
--                                   admin verifies receipt.
--      Two new columns track this. The 6-month / 12-month installment options
--      were removed — payment is full (one-time) only.
-- ============================================


-- --------------------------------------------
-- 1. Add payment-method tracking columns
-- --------------------------------------------
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS payment_status text;

-- Allowed payment methods (NULL until checkout begins).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_payment_method_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_payment_method_check
      CHECK (payment_method IS NULL OR payment_method IN ('card', 'paypal', 'moneygram', 'bank_transfer'));
  END IF;

  -- Payment lifecycle:
  --   pending               online session created, not yet confirmed
  --   awaiting_verification  offline transfer initiated, awaiting admin check
  --   verified              admin confirmed receipt of an offline payment
  --   unpaid                explicit not-paid (rarely set)
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'applications_payment_status_check'
  ) THEN
    ALTER TABLE public.applications
      ADD CONSTRAINT applications_payment_status_check
      CHECK (payment_status IS NULL OR payment_status IN ('pending', 'awaiting_verification', 'verified', 'unpaid'));
  END IF;
END $$;


-- --------------------------------------------
-- 2. Index — offline orders awaiting verification
-- --------------------------------------------
-- Admins filter the queue of offline payments that still need a manual check.
CREATE INDEX IF NOT EXISTS idx_applications_payment_status
  ON public.applications (payment_status)
  WHERE payment_status = 'awaiting_verification';


-- --------------------------------------------
-- 3. Notes
-- --------------------------------------------
-- selected_package is a free-text column; no enum/constraint is added so that
-- the legacy 'Standard'/'Premium' values remain valid alongside the new
-- 'Bronze'/'Silver'/'Gold' labels. The UI and API always normalize the value
-- before pricing.
