-- Phase 54: Black Friday coupon CGBF60, 60% off ISO 9001 only (client, 26 Nov 2026).
-- Valid until 30 Nov 2026, 11:59:59 pm Pakistan time (UTC+5): the same moment the site banner ends.
-- Safe to run more than once.
--
-- What this does
--   1. discount_coupons.standard_slug: limits a coupon to ONE standard. api/checkout.js discounts an order only when
--      the order is exactly that standard, so a 60% code can never touch the US$1,999 audits or ride on a mixed basket.
--   2. Creates / refreshes CGBF60 (percent, 60, standard_slug = 'iso-9001', no use cap).
--   3. Switches the earlier CGBF30 off, if it was ever created.
-- Run it in the Supabase SQL editor BEFORE the new checkout code is relied on: until the column and the row exist the
-- banner button will show "Invalid coupon code".

ALTER TABLE public.discount_coupons
  ADD COLUMN IF NOT EXISTS standard_slug text;

INSERT INTO public.discount_coupons
  (code, description, discount_percent, discount_type, standard_slug, max_redemptions, expires_at, is_active)
VALUES
  ('CGBF60', 'Black Friday 2026: 60% off ISO 9001 (micro and small companies)', 60, 'percent', 'iso-9001', NULL, '2026-11-30T23:59:59+05:00', true)
ON CONFLICT (code) DO UPDATE
  SET discount_percent = 60,
      discount_type    = 'percent',
      standard_slug    = 'iso-9001',
      expires_at       = '2026-11-30T23:59:59+05:00',
      is_active        = true,
      updated_at       = now();

UPDATE public.discount_coupons
   SET is_active = false, updated_at = now()
 WHERE upper(code) = 'CGBF30';
