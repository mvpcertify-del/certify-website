import crypto from 'node:crypto';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
import { computeTotal, PACKAGE_LABEL } from '../src/utils/pricing.js';
import { getIsoBySlug } from '../src/utils/isoCatalog.js';
import { isOfflineMethod, stripeMethodTypesFor, PAYMENT_METHOD_IDS } from '../src/config/paymentMethods.js';
import { getRegionFromCountry } from '../src/utils/roles.js';
import { sendVerificationEmail } from './_sendVerificationEmail.js';
import { notifyAdmins } from './_notifyAdmins.js';
import { verifyAdmin } from './_verifyAdmin.js';

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

// -------------------------------------------------------
// Pay-first (guest) checkout helpers
// -------------------------------------------------------
function randomPassword() {
  // The buyer never uses this — access is granted via a magic link. It only
  // needs to be strong enough that nobody can guess it before the account is
  // (a) approved and (b) reachable by password at all.
  return crypto.randomBytes(18).toString('base64url') + 'Aa1!';
}

function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

// Record a coupon redemption and increment its counter. Called ONLY after a
// payment is actually confirmed (card success / admin offline verify) so an
// abandoned checkout never burns a single-use code. Best-effort + idempotent
// per order (callers gate on the first confirmation).
async function burnCoupon(couponCode, { clientId, applicationId, finalAmount }) {
  if (!couponCode) return;
  try {
    const { data: c } = await supabaseAdmin
      .from('discount_coupons')
      .select('id, discount_percent, redemption_count')
      .ilike('code', String(couponCode).trim())
      .maybeSingle();
    if (!c) return;
    // Increment first — this is the anti-abuse guarantee (single-use / cap).
    await supabaseAdmin
      .from('discount_coupons')
      .update({ redemption_count: (c.redemption_count || 0) + 1 })
      .eq('id', c.id);
    try {
      await supabaseAdmin.from('coupon_redemptions').insert({
        coupon_id: c.id,
        client_id: clientId || null,
        application_id: applicationId || null,
        discount_percent: Number(c.discount_percent),
        discounted_amount: finalAmount ?? null,
      });
    } catch (e) {
      console.error('coupon redemption record failed (non-blocking):', e);
    }
  } catch (e) {
    console.error('burnCoupon error (non-blocking):', e);
  }
}

// Look up an active, non-expired, non-exhausted coupon by code. Returns the
// row or null. Shared by the guest and logged-in paths.
async function resolveCoupon(couponCode) {
  if (!couponCode) return null;
  const { data: c } = await supabaseAdmin
    .from('discount_coupons')
    .select('*')
    .ilike('code', String(couponCode).trim())
    .maybeSingle();
  if (c && c.is_active) {
    const exp = c.expires_at ? new Date(c.expires_at) : null;
    const capped = c.max_redemptions != null && (c.redemption_count || 0) >= c.max_redemptions;
    if (!capped && (!exp || exp > new Date())) return c;
  }
  return null;
}

// ---- Anonymous "pay first, register after" checkout ----
// Creates the buyer's client account AT the payment step, records the order,
// then either opens Stripe (card) or returns offline instructions (cash /
// bank). No signup gate and no pre-purchase email verification — the account
// is held at approval_status='pending' until payment is confirmed.
async function guestCheckoutHandler(req, res) {
  try {
    const {
      isoName, // ISO slug (e.g. 'iso-9001')
      employeeBands = 0,
      additionalLocations = 0,
      paymentMethod = 'card',
      couponCode,
      contact = {},
    } = req.body || {};

    if (!PAYMENT_METHOD_IDS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const name = String(contact.name || '').trim();
    const email = String(contact.email || '').trim().toLowerCase();
    if (!name) return res.status(400).json({ error: 'Please enter your full name.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    const company_name = contact.company ? String(contact.company).trim() : null;
    const phone = contact.phone ? String(contact.phone).trim() : null;
    const country = contact.country ? String(contact.country).trim() : null;
    const region = country ? (getRegionFromCountry(country) || null) : null;

    // ---- Price (recomputed server-side; never trust the client) ----
    const totals = computeTotal({ standardSlug: isoName, employeeBands, locations: additionalLocations });
    const coupon = await resolveCoupon(couponCode);
    const couponPct = coupon ? Number(coupon.discount_percent) : 0;
    const finalPrice = Math.round(totals.subtotal * (1 - couponPct / 100) * 100) / 100;

    // ---- 1. Create the client account ----
    // New buyers are created approval_status='pending' so nobody can log in
    // (password OR reset-password) until payment is confirmed. Confirmation
    // flips them to 'approved' and emails a one-click dashboard magic link.
    // email_confirm:true suppresses Supabase's own verify email — this flow
    // never sends a pre-purchase verification email.
    //
    // SECURITY: if the email already exists we deliberately DO NOT reuse or
    // mutate that account. This endpoint is unauthenticated; reusing an
    // existing row would let anyone overwrite another user's profile (even an
    // admin's) just by knowing their email. Returning customers must log in and
    // purchase from their dashboard instead.
    const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: randomPassword(),
      email_confirm: true,
      user_metadata: {
        name, role: 'client', company_name, country, region,
        stakeholder_type: 'client', approval_status: 'pending',
      },
    });
    if (!created?.user) {
      const msg = String(createErr?.message || '').toLowerCase();
      const emailTaken =
        createErr?.code === 'email_exists' ||
        createErr?.status === 422 ||
        msg.includes('already') || msg.includes('registered') || msg.includes('exists');
      if (emailTaken) {
        return res.status(409).json({
          code: 'account_exists',
          error: 'An account with this email already exists. Please log in to complete your purchase.',
        });
      }
      console.error('guest-checkout createUser failed:', createErr);
      return res.status(400).json({ error: createErr?.message || 'Could not create your account. Please try again.' });
    }
    const userId = created.user.id;

    // ---- 2. Upsert the fresh profile ----
    await supabaseAdmin.from('profiles').upsert({
      id: userId,
      email,
      full_name: name,
      role: 'client',
      company_name,
      region,
      stakeholder_type: 'client',
      approval_status: 'pending',
      ...(phone ? { phone } : {}),
    }, { onConflict: 'id' });

    // ---- 3. Create the application (company registration completed post-payment) ----
    const selectedPackage = PACKAGE_LABEL;
    const recommendedIso = getIsoBySlug(isoName)?.code || isoName || 'ISO 9001:2015';
    const offline = isOfflineMethod(paymentMethod);
    const { data: appRow, error: appErr } = await supabaseAdmin
      .from('applications')
      .insert({
        client_id: userId,
        status: 'awaiting_registration',
        selected_package: selectedPackage,
        recommended_iso: recommendedIso,
        additional_employee_bands: Math.max(0, Math.floor(Number(employeeBands) || 0)),
        additional_locations: Math.max(0, Math.floor(Number(additionalLocations) || 0)),
        total_amount: finalPrice,
        payment_method: paymentMethod,
        payment_status: offline ? 'awaiting_verification' : 'pending',
        ...(company_name ? { company_name } : {}),
        ...(coupon ? { coupon_code: coupon.code } : {}),
      })
      .select('id')
      .single();
    if (appErr || !appRow?.id) {
      console.error('guest-checkout application insert failed:', appErr);
      return res.status(500).json({ error: 'Could not record your order. Please try again.' });
    }
    const applicationId = appRow.id;

    // Alert admins to the new order/lead (best-effort).
    notifyAdmins(supabaseAdmin, {
      title: offline ? 'New order (awaiting payment)' : 'New order (card checkout)',
      message: `${name} (${email})${company_name ? ` — ${company_name}` : ''} started ${selectedPackage} · ${recommendedIso} · $${finalPrice}.`,
      region: region || null,
    }).catch(() => {});

    // ---- 4a. Offline (cash / bank) → no Stripe. Access is issued only after
    // an admin verifies the payment, so we do NOT email a magic link here. ----
    if (offline) {
      return res.status(200).json({ offline: true, paymentMethod, amount: finalPrice, applicationId });
    }

    // ---- 4b. Card → Stripe Checkout session ----
    const baseUrl = process.env.VITE_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://certify.cx');
    const session = await stripe.checkout.sessions.create({
      payment_method_types: stripeMethodTypesFor(paymentMethod),
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: `${recommendedIso} - ${selectedPackage} Package`, description: 'One-Time Payment' },
          unit_amount: Math.round(finalPrice * 100),
        },
        quantity: 1,
      }],
      mode: 'payment',
      customer_email: email,
      allow_promotion_codes: true,
      // {CHECKOUT_SESSION_ID} is verified server-side on the success page before
      // we unlock the account, so this redirect cannot be forged.
      success_url: `${baseUrl}/checkout/success?app=${applicationId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/checkout?iso=${encodeURIComponent(isoName)}&cancelled=1`,
      metadata: { applicationId, clientId: userId, guest: 'true', paymentMethod, couponCode: coupon?.code || '', discountPct: String(couponPct) },
    });

    return res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('guest-checkout error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// ---- Confirm a guest card payment (called by the public success page) ----
// Unauthenticated by necessity (the buyer has no session yet), so it is made
// safe by verifying the Stripe session server-side: only a session Stripe
// reports as paid AND whose metadata points at this application can unlock it.
// Resolve a client's email/name and send the one-click dashboard magic link.
// Shared by the offline-verify and the Super-Admin approve actions so the
// "grant access" step is identical wherever it happens.
async function emailDashboardLink(clientId) {
  let email = null, name = null;
  const { data: prof } = await supabaseAdmin
    .from('profiles').select('email, full_name').eq('id', clientId).maybeSingle();
  email = prof?.email || null;
  name = prof?.full_name || null;
  if (!email) {
    const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(clientId);
    email = authUser?.user?.email || null;
  }
  if (!email) return { ok: false, email: null };
  const r = await sendVerificationEmail({
    supabaseAdmin, email, name, linkType: 'magiclink', redirectPath: '/auth/callback',
  });
  if (!r.ok) console.error('emailDashboardLink: magic link email failed', r);
  return { ok: !!r.ok, email };
}

async function confirmGuestPaymentHandler(req, res) {
  try {
    const { applicationId, sessionId } = req.body || {};
    if (!applicationId || !sessionId) {
      return res.status(400).json({ error: 'Missing order or session reference' });
    }

    let session;
    try {
      session = await stripe.checkout.sessions.retrieve(sessionId);
    } catch {
      return res.status(400).json({ error: 'Invalid payment session' });
    }
    if (!session || session.payment_status !== 'paid' || session.metadata?.applicationId !== String(applicationId)) {
      return res.status(402).json({ error: 'Payment not confirmed' });
    }

    const { data: app } = await supabaseAdmin
      .from('applications')
      .select('id, client_id, payment_status, coupon_code, total_amount')
      .eq('id', applicationId)
      .maybeSingle();
    if (!app) return res.status(404).json({ error: 'Order not found' });

    const alreadyPaid = app.payment_status === 'paid' || app.payment_status === 'verified';

    // Look up the buyer for the admin alert + the "we'll email you" message.
    const { data: prof } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, company_name, region, approval_status')
      .eq('id', app.client_id).maybeSingle();
    const email = prof?.email || null;

    if (!alreadyPaid) {
      await supabaseAdmin.from('applications').update({ payment_status: 'paid' }).eq('id', applicationId);
      // Burn the coupon now that money has actually arrived (first confirm only).
      await burnCoupon(app.coupon_code, {
        clientId: app.client_id, applicationId, finalAmount: app.total_amount,
      });
      // The client asked that a client account be activated in the dashboard
      // ONLY AFTER a Super Admin approves. So payment no longer auto-approves:
      // the buyer stays 'pending' and we alert the admins that a paid client is
      // waiting. Access (the magic link) is issued by the approve-client-access
      // action, not here.
      await notifyAdmins(supabaseAdmin, {
        title: 'New paid client awaiting approval',
        message: `${prof?.full_name || email || 'A client'}${prof?.company_name ? ` (${prof.company_name})` : ''} has paid and is awaiting dashboard approval.`,
        region: prof?.region || null,
      }).catch(() => {});
    }

    // Never downgrade an already-approved client (idempotent re-confirm).
    const pendingApproval = prof?.approval_status !== 'approved';

    return res.status(200).json({ ok: true, pendingApproval, email });
  } catch (error) {
    console.error('confirm-guest-payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// ---- Super Admin: approve a paid client and grant dashboard access ----
// Admin-gated (Bearer JWT). Flips approval_status→approved and emails the
// one-click dashboard magic link. This is the gate the client asked for: a paid
// client is only activated once an admin approves. Used for card payers (whose
// payment is auto-verified by Stripe); offline payers are approved by the
// verify-offline-payment action instead.
async function approveClientAccessHandler(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { applicationId, clientId } = req.body || {};
    let targetClientId = clientId || null;
    if (applicationId) {
      // Enforce the payment gate server-side: only a paid/verified order may be
      // approved for dashboard access. This stops an abandoned, unpaid card
      // order from being granted access even if the UI offered it.
      const { data: app } = await supabaseAdmin
        .from('applications').select('client_id, payment_status').eq('id', applicationId).maybeSingle();
      if (!app) return res.status(404).json({ error: 'Order not found' });
      if (app.payment_status !== 'paid' && app.payment_status !== 'verified') {
        return res.status(409).json({ error: 'This order has not been paid yet.' });
      }
      targetClientId = targetClientId || app.client_id || null;
    }
    if (!targetClientId) return res.status(400).json({ error: 'Missing client reference' });

    const { data: prof } = await supabaseAdmin
      .from('profiles').select('approval_status').eq('id', targetClientId).maybeSingle();
    if (!prof) return res.status(404).json({ error: 'Client not found' });
    const alreadyApproved = prof.approval_status === 'approved';

    // Idempotent: don't re-stamp approved_by/approved_at (or re-email) if the
    // client is already approved.
    if (alreadyApproved) {
      return res.status(200).json({ ok: true, emailSent: false, alreadyApproved: true });
    }

    await supabaseAdmin.from('profiles').update({
      approval_status: 'approved',
      approved_by: auth.caller.id,
      approved_at: new Date().toISOString(),
    }).eq('id', targetClientId);

    const r = await emailDashboardLink(targetClientId);

    return res.status(200).json({ ok: true, emailSent: r.ok, email: r.email, alreadyApproved: false });
  } catch (error) {
    console.error('approve-client-access error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// ---- Admin: verify an offline (cash / bank) payment ----
// Admin-gated (Bearer JWT). Marks the order verified, approves the client, and
// emails the one-click dashboard magic link — the moment an offline buyer
// actually gains access. Replaces the old client-side status flip so the
// approval + access email happen atomically with verification.
async function verifyOfflinePaymentHandler(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { applicationId } = req.body || {};
    if (!applicationId) return res.status(400).json({ error: 'Missing application reference' });

    const { data: app } = await supabaseAdmin
      .from('applications')
      .select('id, client_id, payment_status, coupon_code, total_amount')
      .eq('id', applicationId)
      .maybeSingle();
    if (!app) return res.status(404).json({ error: 'Order not found' });

    const alreadyVerified = app.payment_status === 'verified' || app.payment_status === 'paid';

    await supabaseAdmin.from('applications').update({ payment_status: 'verified' }).eq('id', applicationId);
    await supabaseAdmin.from('profiles').update({ approval_status: 'approved' }).eq('id', app.client_id);
    if (!alreadyVerified) {
      await burnCoupon(app.coupon_code, {
        clientId: app.client_id, applicationId, finalAmount: app.total_amount,
      });
    }

    // Email the buyer their dashboard access link (only on first verification).
    let emailSent = false;
    if (!alreadyVerified) {
      const r = await emailDashboardLink(app.client_id);
      emailSent = r.ok;
    }

    return res.status(200).json({ ok: true, emailSent });
  } catch (error) {
    console.error('verify-offline-payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// Best-effort in-memory throttle for the unauthenticated consultation form.
// Keyed by client IP + email; bounded to a few requests per window. NOTE: this
// only protects within a single warm serverless instance — a robust limit needs
// a shared store (Upstash/Redis) or a captcha, which is the real follow-up.
const CONSULT_WINDOW_MS = 10 * 60 * 1000;
const CONSULT_MAX = 3;
const consultHits = new Map(); // key -> number[] (timestamps)

function consultThrottled(key, nowMs) {
  const recent = (consultHits.get(key) || []).filter((t) => nowMs - t < CONSULT_WINDOW_MS);
  if (recent.length >= CONSULT_MAX) {
    consultHits.set(key, recent);
    return true;
  }
  recent.push(nowMs);
  consultHits.set(key, recent);
  // Opportunistic prune so the Map can't grow unbounded on a long-lived instance.
  if (consultHits.size > 5000) {
    for (const [k, arr] of consultHits) {
      if (!arr.some((t) => nowMs - t < CONSULT_WINDOW_MS)) consultHits.delete(k);
    }
  }
  return false;
}

// Public consultation-request handler. Unauthenticated by design (the buyer
// hasn't signed up yet). It ONLY alerts admins; it never emails the requester
// and never accepts a recipient address, so it can't be turned into a mailer.
// Inputs are length-capped to keep the alert (and any spam) bounded.
async function bookConsultationHandler(req, res) {
  try {
    const c = req.body?.contact || {};
    const cap = (v, n) => String(v || '').trim().slice(0, n);
    const name = cap(c.name, 120);
    const email = cap(c.email, 200).toLowerCase();
    const phone = cap(c.phone, 40);
    const company = cap(c.company, 160);
    const preferredTime = cap(c.preferredTime, 120);
    const message = cap(c.message, 1000);
    const isoInterest = cap(c.isoInterest, 120);

    if (!name) return res.status(400).json({ error: 'Please enter your name.' });
    if (!isValidEmail(email)) return res.status(400).json({ error: 'Please enter a valid email address.' });

    // Best-effort flood guard (per warm instance). Silently succeeds so a bot
    // gets no signal, but we skip the admin fan-out once over the limit.
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    if (consultThrottled(`${ip}|${email}`, Date.now())) {
      return res.status(200).json({ success: true });
    }

    const region = null; // no country captured on the consultation form
    const lines = [
      `${name} (${email})`,
      phone ? `Phone: ${phone}` : null,
      company ? `Company: ${company}` : null,
      isoInterest ? `Interested in: ${isoInterest}` : null,
      preferredTime ? `Preferred time: ${preferredTime}` : null,
      message ? `Message: ${message}` : null,
    ].filter(Boolean);

    await notifyAdmins(supabaseAdmin, {
      title: 'New consultation request',
      message: lines.join(' · '),
      region,
    }).catch(() => {});

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('book-consultation error:', error);
    return res.status(500).json({ error: 'Could not submit your request. Please try again.' });
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  // Route on the `action` field. These sub-routes used to warrant their own
  // api/ files but are merged here to stay under the Vercel Hobby 12-function
  // limit.
  if (req.body?.action === 'validate-coupon') {
    return validateCouponHandler(req, res);
  }
  // Pay-first flow: an anonymous buyer creates their account AT the payment
  // step (no signup gate, no pre-purchase email verification).
  if (req.body?.action === 'guest-checkout') {
    return guestCheckoutHandler(req, res);
  }
  // Called by the public /checkout success page after Stripe redirects back.
  // Verifies the Stripe session server-side, then unlocks the account.
  if (req.body?.action === 'confirm-guest-payment') {
    return confirmGuestPaymentHandler(req, res);
  }
  // Admin confirms receipt of an offline (cash / bank) payment: marks the order
  // verified, approves the client, and emails their dashboard magic link.
  if (req.body?.action === 'verify-offline-payment') {
    return verifyOfflinePaymentHandler(req, res);
  }
  // Admin approves a paid client and grants dashboard access (magic link).
  // The client-account activation gate: card payers are only let in after this.
  if (req.body?.action === 'approve-client-access') {
    return approveClientAccessHandler(req, res);
  }
  // Public: a visitor requests a consultation (e.g. from the gap-analysis
  // results popup). Notifies admins only — recipients are derived server-side,
  // never from the request, so this cannot be used to email arbitrary inboxes.
  if (req.body?.action === 'book-consultation') {
    return bookConsultationHandler(req, res);
  }

  try {
    const {
      isoName,
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
    if (!PAYMENT_METHOD_IDS.includes(paymentMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    // ---- 0. Recompute the buyer's price server-side ----
    // Never trust the client. The same helper feeds the UI total, so the
    // displayed amount and the charge always agree. Full payment only.
    const totals = computeTotal({
      standardSlug: isoName,
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
          name: `${isoName} - ${PACKAGE_LABEL} Package`,
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
