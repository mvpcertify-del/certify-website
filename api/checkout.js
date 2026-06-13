import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { computeTotal } from '../src/utils/pricing.js';
import { isOfflineMethod, stripeMethodTypesFor } from '../src/config/paymentMethods.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const DEFAULT_TIERS = [
  { min_conversions: 1,  max_conversions: 15, commission_percent: 15, label: 'Bronze' },
  { min_conversions: 15, max_conversions: 20, commission_percent: 20, label: 'Silver' },
  { min_conversions: 20, max_conversions: 25, commission_percent: 25, label: 'Gold' },
  { min_conversions: 25, max_conversions: null, commission_percent: 25, label: 'Gold+' },
];

// Pick the tier whose [min, max) bracket contains the conversion count.
// 0 conversions → first tier; open-ended max (null) handles the top bracket.
function pickTier(tiers, conversionCount) {
  const active = (tiers || []).filter(t => t.is_active !== false);
  const sorted = [...active].sort((a, b) => a.min_conversions - b.min_conversions);
  const list = sorted.length ? sorted : DEFAULT_TIERS;
  // Use (n+1) as the "with this conversion" count — the new sale we're about
  // to commit increments the referrer's rolling count.
  const n = conversionCount + 1;
  for (const tier of list) {
    const max = tier.max_conversions ?? Infinity;
    if (n >= tier.min_conversions && n < max) return tier;
  }
  return list[list.length - 1];
}

async function getReferrerTier(referrerId) {
  // Count conversions by this referrer in the rolling 12-month window
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

  const { count } = await supabaseAdmin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId)
    .eq('status', 'converted')
    .gte('converted_at', twelveMonthsAgo.toISOString());

  const { data: tiers } = await supabaseAdmin
    .from('referral_commission_tiers')
    .select('*')
    .order('min_conversions', { ascending: true });

  return pickTier(tiers, count || 0);
}

// --- Validate a coupon code without creating a Stripe session ---
// Returns { valid, reason?, coupon? }. Reasons: not_found, inactive,
// expired, exhausted. Accepts either a raw code or a full share URL with
// ?coupon=CODE or ?code=CODE in the query string.
async function validateCouponHandler(req, res) {
  const { code } = req.body || {};
  if (!code || typeof code !== 'string') {
    return res.status(400).json({ valid: false, error: 'Missing code' });
  }

  let extracted = code.trim();
  if (/^https?:\/\//i.test(extracted) || extracted.includes('?') || extracted.includes('=')) {
    try {
      const url = new URL(extracted, 'https://placeholder.local');
      const fromQuery = url.searchParams.get('coupon') || url.searchParams.get('code');
      if (fromQuery) extracted = fromQuery;
    } catch {
      const m = extracted.match(/[?&](?:coupon|code)=([^&\s]+)/i);
      if (m) extracted = decodeURIComponent(m[1]);
    }
  }

  const normalized = extracted.trim().toUpperCase();
  const { data: coupon, error } = await supabaseAdmin
    .from('discount_coupons')
    .select('*')
    .ilike('code', normalized)
    .maybeSingle();
  if (error) {
    console.error('Validate coupon error:', error);
    return res.status(500).json({ valid: false, error: error.message });
  }
  if (!coupon)            return res.status(200).json({ valid: false, reason: 'not_found' });
  if (!coupon.is_active)  return res.status(200).json({ valid: false, reason: 'inactive' });
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
    return res.status(200).json({ valid: false, reason: 'expired' });
  }
  if (coupon.max_redemptions != null && (coupon.redemption_count || 0) >= coupon.max_redemptions) {
    return res.status(200).json({ valid: false, reason: 'exhausted' });
  }
  return res.status(200).json({
    valid: true,
    coupon: {
      id: coupon.id,
      code: coupon.code,
      discount_percent: Number(coupon.discount_percent),
      description: coupon.description,
    },
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Route on the `action` field. The validate-coupon path used to live in
  // its own api/ file but was merged here to stay under the Vercel Hobby
  // 12-function limit.
  if (req.body?.action === 'validate-coupon') {
    return validateCouponHandler(req, res);
  }

  try {
    const {
      isoName,
      tier,
      applicationId,
      clientId,
      couponCode,
      employeeBands = 0,
      additionalLocations = 0,
      paymentMethod = 'card',
    } = req.body;

    // Reject unknown payment methods before they reach the DB or Stripe. The
    // config helpers fail safe (unknown → online/card), so without this an
    // arbitrary string would be persisted into applications.payment_method.
    const VALID_PAYMENT_METHODS = ['card', 'paypal', 'moneygram', 'bank_transfer'];
    if (!VALID_PAYMENT_METHODS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // ---- 0. Recompute the buyer's price server-side ----
    // Never trust the client. The same helper feeds the UI total, so the
    // displayed amount and the charge always agree. Full payment only.
    const totals = computeTotal({
      standardSlug: isoName,
      tier,
      employeeBands,
      locations: additionalLocations,
    });
    const price = totals.subtotal;

    // ---- 1. Resolve coupon (if provided) ----
    let coupon = null;
    if (couponCode) {
      const { data: c } = await supabaseAdmin
        .from('discount_coupons')
        .select('*')
        .ilike('code', String(couponCode).trim())
        .maybeSingle();
      if (c && c.is_active) {
        const exp = c.expires_at ? new Date(c.expires_at) : null;
        const capped = c.max_redemptions != null && (c.redemption_count || 0) >= c.max_redemptions;
        if (!capped && (!exp || exp > new Date())) {
          coupon = c;
        }
      }
    }

    // ---- 2. Resolve referral (if client was referred) ----
    let referralRecord = null;
    if (clientId) {
      try {
        const { data: userMeta } = await supabaseAdmin.auth.admin.getUserById(clientId);
        const clientEmail = userMeta?.user?.email;
        if (clientEmail) {
          const { data: ref } = await supabaseAdmin
            .from('referrals')
            .select('*')
            .eq('referred_email', clientEmail)
            .in('status', ['pending', 'signed_up'])
            .maybeSingle();
          if (ref) referralRecord = ref;
        }
      } catch (e) {
        console.error('Referral discount check error (non-blocking):', e);
      }
    }

    // ---- 3. Decide which discount to apply (do NOT stack) ----
    // Coupon wins over the baseline 10% referral sign-up discount.
    const couponPct = coupon ? Number(coupon.discount_percent) : 0;
    const referralSignupDiscountPct = referralRecord ? 10 : 0;
    const discountPct = Math.max(couponPct, referralSignupDiscountPct);
    const finalPrice = Math.round(price * (1 - discountPct / 100) * 100) / 100;

    // ---- 4. Offline payment (MoneyGram / bank transfer) ----
    // No Stripe session: the buyer transfers funds out-of-band. We persist the
    // order with payment_status='awaiting_verification' and surface the
    // transfer instructions in the UI. Coupon redemption and referral
    // conversion are intentionally deferred until an admin verifies receipt —
    // we must not credit a commission or burn a coupon before money arrives.
    if (isOfflineMethod(paymentMethod)) {
      // The write is scoped to (id, client_id) so a caller cannot record an
      // offline order against an application they don't own — an empty result
      // means the application/owner pair didn't match. NOTE: clientId still
      // comes from the request body; the robust fix is to verify the caller's
      // Bearer JWT (see api/_verifyAdmin.js for the getUser pattern) and derive
      // clientId server-side. Tracked as a follow-up hardening.
      if (!applicationId || !clientId) {
        return res.status(400).json({ error: 'Missing application or client reference' });
      }
      let updated;
      try {
        const { data, error: offErr } = await supabaseAdmin
          .from('applications')
          .update({
            additional_employee_bands: Math.max(0, Math.floor(Number(employeeBands) || 0)),
            additional_locations: Math.max(0, Math.floor(Number(additionalLocations) || 0)),
            total_amount: finalPrice,
            payment_method: paymentMethod,
            payment_status: 'awaiting_verification',
            ...(coupon ? { coupon_code: coupon.code } : {}),
          })
          .eq('id', applicationId)
          .eq('client_id', clientId)
          .select('id');
        if (offErr) throw offErr;
        updated = data;
      } catch (persistErr) {
        console.error('Offline order persistence error:', persistErr);
        return res.status(500).json({ error: 'Could not record your order. Please try again.' });
      }
      if (!updated || updated.length === 0) {
        return res.status(403).json({ error: 'Order not found for this account.' });
      }
      return res.status(200).json({
        offline: true,
        paymentMethod,
        amount: finalPrice,
        appliedDiscountPct: discountPct,
      });
    }

    // ---- 4a. Stripe session (card / PayPal) — full one-time payment ----
    const lineItem = {
      price_data: {
        currency: 'usd',
        product_data: {
          name: `${isoName} - ${tier} Package`,
          description: 'One-Time Payment',
        },
        unit_amount: Math.round(finalPrice * 100),
      },
      quantity: 1,
    };

    const baseUrl = process.env.VITE_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://certify.cx');

    const sessionConfig = {
      payment_method_types: stripeMethodTypesFor(paymentMethod),
      line_items: [lineItem],
      mode: 'payment',
      // Allow coupons created directly in the Stripe dashboard to also work,
      // alongside our app-managed discount_coupons table.
      allow_promotion_codes: true,
      success_url: `${baseUrl}/client/apply/${applicationId}?payment=success`,
      cancel_url: `${baseUrl}/client/checkout/${applicationId}?payment=cancelled`,
      metadata: {
        applicationId: applicationId,
        clientId: clientId,
        paymentMethod,
        referralDiscount: referralRecord ? 'true' : 'false',
        couponCode: coupon?.code || '',
        discountPct: String(discountPct),
        employeeBands: String(totals.employeeSurchargeTotal / 200 || 0),
        additionalLocations: String(totals.locationSurchargeTotal / 200 || 0),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // ---- 4b. Persist surcharge counts + total to the application row ----
    // The applications table has additional_employee_bands /
    // additional_locations / total_amount columns (see Phase B migration).
    if (applicationId) {
      try {
        await supabaseAdmin
          .from('applications')
          .update({
            additional_employee_bands: Math.max(0, Math.floor(Number(employeeBands) || 0)),
            additional_locations: Math.max(0, Math.floor(Number(additionalLocations) || 0)),
            total_amount: totals.subtotal,
            payment_method: paymentMethod,
            payment_status: 'pending',
          })
          .eq('id', applicationId);
      } catch (persistErr) {
        console.error('Surcharge persistence error (non-blocking):', persistErr);
      }
    }

    // ---- 5. Record coupon redemption ----
    if (coupon) {
      try {
        await supabaseAdmin.from('coupon_redemptions').insert({
          coupon_id: coupon.id,
          client_id: clientId || null,
          application_id: applicationId || null,
          discount_percent: couponPct,
          original_amount: price,
          discounted_amount: finalPrice,
        });

        await supabaseAdmin
          .from('discount_coupons')
          .update({ redemption_count: (coupon.redemption_count || 0) + 1 })
          .eq('id', coupon.id);

        if (applicationId) {
          await supabaseAdmin
            .from('applications')
            .update({ coupon_code: coupon.code })
            .eq('id', applicationId);
        }
      } catch (cErr) {
        console.error('Coupon redemption recording error (non-blocking):', cErr);
      }
    }

    // ---- 6. Commission + referrer notification ----
    // Referral conversion commission uses the referrer's CURRENT tier,
    // evaluated on rolling 12-month conversion count.
    if (referralRecord) {
      try {
        const saleAmount = finalPrice;
        const tierData = await getReferrerTier(referralRecord.referrer_id);
        const commissionPct = Number(tierData.commission_percent);
        const commission = Math.round(saleAmount * (commissionPct / 100) * 100) / 100;

        await supabaseAdmin
          .from('referrals')
          .update({
            status: 'converted',
            payment_amount: saleAmount,
            commission_amount: commission,
            commission_percent: commissionPct,
            tier_label: tierData.label,
            referred_id: clientId,
            converted_at: new Date().toISOString(),
            payout_status: 'pending',
          })
          .eq('id', referralRecord.id);

        await supabaseAdmin.from('notifications').insert({
          user_id: referralRecord.referrer_id,
          title: 'Referral Converted!',
          message: `Your referral (${referralRecord.referred_email}) completed a payment of $${saleAmount.toFixed(2)}. Your ${commissionPct}% commission (${tierData.label}) of $${commission.toFixed(2)} has been credited. Please send your bank/payment details to mvpcertify@gmail.com to receive your payout.`,
          type: 'referral',
        });
      } catch (refErr) {
        console.error('Referral commission error (non-blocking):', refErr);
      }
    }

    return res.status(200).json({
      url: session.url,
      referralDiscount: !!referralRecord,
      coupon: coupon ? { code: coupon.code, discount_percent: couponPct } : null,
      appliedDiscountPct: discountPct,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
