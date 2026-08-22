import crypto from 'node:crypto';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';
// applyCoupon is no longer imported directly: every pricing path now goes
// through bestDiscount, which resolves a coupon and the referral discount
// against the same subtotal and picks whichever saves the buyer more.
import {
  computeTotal, bestDiscount, PACKAGE_LABEL,
  employeeBandsFromCount, INCLUDED_LOCATIONS,
  // Resolves an ISO slug/code OR a compliance-audit slug/code to the display
  // code stored on the application. Compliance audits (SOC, PCI DSS, …) are
  // sold through this same handler since 22 Aug; without this they would be
  // recorded and receipted under their raw URL slug.
  resolveOrderStandardCode,
} from '../src/utils/pricing.js';
import { isOfflineMethod, stripeMethodTypesFor, PAYMENT_METHOD_IDS } from '../src/config/paymentMethods.js';
import { getRegionFromCountry } from '../src/utils/roles.js';
import { sendVerificationEmail } from './_sendVerificationEmail.js';
import { notifyAdmins } from './_notifyAdmins.js';
import { verifyAdmin } from './_verifyAdmin.js';
import { issueInvoice, issueReceipt, signedUrlFor } from './_billing.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',
});

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Consultancy partners earn a flat agreed rate on net sales rather than
// climbing the volume ladder (client, 21 Jul: "the consultancies will get 25%
// on each Client whom they onboard"). An explicit
// profiles.commission_percent_override still takes precedence.
const CONSULTANCY_COMMISSION_PERCENT = 25;

// Referral partners earn a flat 10% (client decision, 2 Aug) — matches the
// Referral Partner Agreement. Replaces the earlier volume tier ladder.
const REFERRAL_FLAT_COMMISSION_PERCENT = 10;

// The discount a buyer gets for arriving through a partner. This number is
// advertised publicly on /register/referral ("Referred clients get 10% off
// their first purchase") — changing it here without changing that copy makes
// the site state something untrue, so the two must move together.
const REFERRAL_BUYER_DISCOUNT_PERCENT = 10;

// Coupon lookups run through `.ilike()`, which treats `%`, `_` and `*` as
// wildcards. Because the lookup ends in `.maybeSingle()` — null on no match,
// an error on more than one — an unauthenticated caller could binary-search
// the coupon table one character at a time ('A%', 'AB%', …) until exactly one
// row matched, and `validate-coupon` would then hand back the real code and
// its value. A 100%-off admin coupon was discoverable, and usable, in minutes.
//
// The fix is to reject any code that is not a plain code, rather than to
// switch to `.eq()`. Case-insensitivity has to be preserved: coupon codes are
// user-typed, and there is no way to confirm from here that no legacy row was
// stored lower-case — an exact match would silently stop honouring it.
//
// Real codes are A–Z, 0–9 and hyphens (see genCode in AdminCoupons.jsx), so
// anything containing a wildcard was never a valid code in the first place.
// Returns '' for anything unusable, and callers treat '' as "no match".
const SAFE_CODE_RE = /^[A-Za-z0-9-]{1,64}$/;

function normalizeCouponCode(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return SAFE_CODE_RE.test(trimmed) ? trimmed : '';
}

// ---- Resolve a code typed at checkout, or carried in a ?ref= link ----
//
// One code does both jobs. The client asked for "a Unique ID code which will
// be automated to be reflected through the whole client purchase process" —
// so the partner shares ONE string, and it simultaneously discounts the buyer
// and credits the partner. Two separate codes (a tracking link plus a coupon)
// is what the old design had, and partners kept sharing the wrong one.
//
// Resolution order matters: an ordinary marketing coupon wins over a partner
// code of the same string, because a coupon is the more specific instrument
// and an admin can revoke it.
//
// Returns { coupon, referrer, referralCode } — any of which may be null.
async function resolveCheckoutCode(rawCode) {
  // Reject non-strings and cap the length before this reaches a database
  // query. An object would stringify to "[object Object]" and an array would
  // join itself; neither is a code, and an uncapped string goes straight into
  // a URL-encoded PostgREST filter.
  if (typeof rawCode !== 'string') return { coupon: null, referrer: null, referralCode: null };
  const code = rawCode.trim().slice(0, 64);
  if (!code) return { coupon: null, referrer: null, referralCode: null };

  // 1. A real coupon. May itself belong to a partner (phase25 referrer_id).
  const coupon = await resolveCoupon(code);
  if (coupon) {
    let referrer = null;
    if (coupon.referrer_id) {
      const { data } = await supabaseAdmin
        .from('profiles')
        .select('id, role, stakeholder_type, referral_code')
        .eq('id', coupon.referrer_id)
        .maybeSingle();
      referrer = data || null;
    }
    return { coupon, referrer, referralCode: referrer?.referral_code || null };
  }

  // 2. A partner's own referral code — an exact, indexed lookup. The previous
  // implementation scanned the first 1000 auth users for a UUID prefix, so
  // partner #1001 could never be resolved and two partners could collide.
  //
  // The role and approval filters are load-bearing, not defensive padding:
  //   - demoting a partner to `client` does NOT clear their referral_code (the
  //     phase25 trigger only ever fills a NULL, it never revokes), so without
  //     the role check an ex-partner's code would keep discounting buyers and
  //     earning commission indefinitely; and
  //   - `referral_code` sits on `profiles`, a row users can update themselves.
  //     Without the role check, anyone could set their own referral_code and
  //     become a resolvable "partner" without ever holding a partner role.
  const { data: partner } = await supabaseAdmin
    .from('profiles')
    .select('id, email, role, stakeholder_type, referral_code, approval_status, is_active')
    .eq('referral_code', code.toUpperCase())
    .in('role', ['referral', 'consultancy'])
    .maybeSingle();

  const usable = partner
    && partner.approval_status !== 'pending'
    && partner.approval_status !== 'rejected'
    && partner.is_active !== false;

  if (usable) return { coupon: null, referrer: partner, referralCode: partner.referral_code };

  return { coupon: null, referrer: null, referralCode: null };
}

// ---- Credit a partner for a sale, exactly once ----
//
// Called at the point money is committed. Idempotency is enforced by the
// unique index on referrals.application_id (phase25) AND by an explicit
// pre-check, so a re-confirmed payment or an admin toggling an order
// paid → unpaid → paid cannot pay the same commission twice.
//
// Best-effort by design: a commission failure must never roll back a sale
// that the buyer has already paid for. Failures are logged, not thrown.
async function creditReferralForOrder({ applicationId, referrerId, clientId, clientEmail, finalAmount, source }) {
  if (!applicationId || !referrerId) return null;

  // Self-referral. The id comparison alone is worthless on the guest path:
  // that handler creates a brand-new account for the buyer, so the two ids can
  // never match by construction, and a partner could buy through their own
  // code with a second email address — taking the buyer's 10% discount AND
  // their own commission on the same order, then repeating it as a resale
  // channel while ratcheting up their volume tier.
  if (referrerId === clientId) return null;

  const normaliseEmail = (e) => {
    const s = String(e || '').trim().toLowerCase();
    const at = s.lastIndexOf('@');
    if (at < 1) return s;
    // Strip +tags and (for Google-hosted addresses) dots, which are the two
    // free ways to make one mailbox look like many.
    let local = s.slice(0, at).split('+')[0];
    const domain = s.slice(at + 1);
    if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.replace(/\./g, '');
    return `${local}@${domain}`;
  };

  try {
    const { data: referrerProfile } = await supabaseAdmin
      .from('profiles').select('email').eq('id', referrerId).maybeSingle();
    if (referrerProfile?.email && clientEmail
        && normaliseEmail(referrerProfile.email) === normaliseEmail(clientEmail)) {
      console.warn(`creditReferralForOrder: self-referral blocked on application ${applicationId}`);
      return null;
    }
  } catch {
    // A failed lookup must not silently skip the check — fall through to the
    // review hold below, which catches it either way.
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('referrals')
      .select('id')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (existing) return existing.id;

    const tier = await getReferrerTier(referrerId);
    const pct = Number(tier?.commission_percent || 0);
    const commission = Math.round((Number(finalAmount || 0) * pct) / 100 * 100) / 100;

    const { data: row, error } = await supabaseAdmin
      .from('referrals')
      .insert({
        referrer_id: referrerId,
        referred_id: clientId || null,
        referred_email: clientEmail || '',
        application_id: applicationId,
        status: 'converted',
        payment_amount: Number(finalAmount || 0),
        commission_amount: commission,
        commission_percent: pct,
        tier_label: tier?.label || null,
        converted_at: new Date().toISOString(),
        payout_status: 'pending',
        source: source || 'code',
      })
      .select('id')
      .single();

    if (error) {
      // 23505 = the unique index fired, i.e. another request credited this
      // order first. That is the guarantee working, not a failure.
      if (error.code !== '23505') console.error('creditReferralForOrder insert failed:', error);
      return null;
    }

    // NOT `.catch()`: a Supabase query builder is a PromiseLike with only a
    // `then`, so calling .catch on it throws TypeError — which the outer catch
    // would swallow, leaving the commission written, the partner never
    // notified, and this function returning null as though it had failed.
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: referrerId,
        type: 'referral',
        title: 'Referral converted',
        message: `A client you referred has paid. You earned ${commission.toFixed(2)} (${pct}%).`,
      });
    } catch (e) {
      console.error('referral notification failed (non-blocking):', e?.message);
    }

    return row?.id || null;
  } catch (e) {
    console.error('creditReferralForOrder error (non-blocking):', e?.message);
    return null;
  }
}

async function getReferrerTier(referrerId) {
  // A partner who negotiated their own rate bypasses the flat rate entirely.
  // Consultancies are seeded at 25% by phase20; affiliates normally have no
  // override and fall through to the Bronze/Silver/Gold table below.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('commission_percent_override, stakeholder_type')
    .eq('id', referrerId)
    .maybeSingle();

  if (profile?.commission_percent_override != null) {
    return {
      commission_percent: Number(profile.commission_percent_override),
      label: profile.stakeholder_type === 'consultancy' ? 'Consultancy' : 'Agreed rate',
    };
  }

  // A consultancy earns 25% of net by agreement (client, 21 Jul), not by
  // volume tier. phase22 seeds the override for consultancies that existed
  // when it ran, but a consultancy onboarded afterwards has none — without
  // this it would silently fall through to the Bronze/Silver/Gold ladder and
  // be paid 15%. The override still wins when an admin sets a different rate.
  if (profile?.stakeholder_type === 'consultancy') {
    return { commission_percent: CONSULTANCY_COMMISSION_PERCENT, label: 'Consultancy' };
  }

  // Referral partners earn a FLAT 10% (client decision, 2 Aug), matching the
  // Referral Partner Agreement they sign. This replaces the earlier volume
  // ladder (Bronze/Silver/Gold); the ladder helpers are kept only so an admin
  // who re-enables tier rows in referral_commission_tiers still resolves
  // correctly, but with no rows the flat rate applies.
  return { commission_percent: REFERRAL_FLAT_COMMISSION_PERCENT, label: 'Referral' };
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

  const safe = normalizeCouponCode(extracted);
  if (!safe) return res.status(200).json({ valid: false, reason: 'not_found' });
  const normalized = safe.toUpperCase();

  const { data: coupon, error } = await supabaseAdmin
    .from('discount_coupons')
    .select('*')
    .ilike('code', safe)
    .maybeSingle();
  if (error) {
    // Never echo the raw Postgres/PostgREST text to an unauthenticated caller:
    // combined with a crafted code that is a free schema-probing primitive.
    console.error('Validate coupon error:', error);
    return res.status(500).json({ valid: false, error: 'Could not validate that code' });
  }
  // Not a coupon — it may be a partner's referral code. The buyer should not
  // have to know which kind of code they were given, and the partner shares
  // only one string, so the same box has to accept both.
  if (!coupon) {
    const { data: partner } = await supabaseAdmin
      .from('profiles')
      .select('id, referral_code')
      .eq('referral_code', normalized)
      .maybeSingle();

    if (partner) {
      return res.status(200).json({
        valid: true,
        coupon: {
          id: null,
          code: partner.referral_code,
          discount_type: 'percent',
          discount_percent: REFERRAL_BUYER_DISCOUNT_PERCENT,
          discount_amount: null,
          // Marks this as a partner code rather than a marketing coupon, so
          // the page can label it correctly. The server re-resolves it at
          // purchase regardless — nothing here is trusted for pricing.
          referral: true,
        },
      });
    }
    return res.status(200).json({ valid: false, reason: 'not_found' });
  }

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
      discount_type: coupon.discount_type || 'percent',
      discount_percent: coupon.discount_percent == null ? null : Number(coupon.discount_percent),
      discount_amount: coupon.discount_amount == null ? null : Number(coupon.discount_amount),
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
      .select('id, discount_type, discount_percent, discount_amount, redemption_count')
      .ilike('code', normalizeCouponCode(couponCode))
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
        discount_type: c.discount_type || 'percent',
        discount_percent: c.discount_percent == null ? null : Number(c.discount_percent),
        discount_amount: c.discount_amount == null ? null : Number(c.discount_amount),
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
    .ilike('code', normalizeCouponCode(couponCode))
    .maybeSingle();
  if (c && c.is_active) {
    const exp = c.expires_at ? new Date(c.expires_at) : null;
    const capped = c.max_redemptions != null && (c.redemption_count || 0) >= c.max_redemptions;
    if (!capped && (!exp || exp > new Date())) return c;
  }
  return null;
}

// A multi-standard basket is charged once but stored as one application row per
// certification, so each row records its own share of the money rather than the
// whole order — `total_amount` is summed in revenue views, and repeating the
// basket total on every row would inflate them by the size of the basket.
//
// The split is weighted by each standard's list price, not even: since 12 Aug a
// basket can mix $999 and $1,999 standards, and splitting a $2,998 order evenly
// would book $1,499 against each — overstating the cheap certification and
// understating the expensive one in every per-standard revenue figure.
// Discounts and surcharges are spread in the same proportion. The last row
// absorbs the rounding remainder so the shares always sum to the charge
// exactly; the amount actually charged is the Stripe session, not this.
function amountShares(total, prices) {
  const amount = Number(total) || 0;
  const weights = (Array.isArray(prices) && prices.length ? prices : [1]).map(p => Number(p) || 0);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const n = weights.length;
  // All-zero weights (shouldn't happen) would divide by zero — split evenly.
  const shares = weights.map(w => Math.round((amount * (weightSum ? w / weightSum : 1 / n)) * 100) / 100);
  const drift = Math.round((amount - shares.reduce((a, b) => a + b, 0)) * 100) / 100;
  shares[n - 1] = Math.round((shares[n - 1] + drift) * 100) / 100;
  return shares;
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
      // Raw organization size as the buyer typed it on the checkout form.
      // Preferred over the two derived values above when present: the bands are
      // a pricing detail the client computes for display, and a client-computed
      // price input is never trusted.
      employeeCount,
      locationCount,
      paymentMethod = 'card',
      couponCode,
      referralCode,
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
    //
    // The buyer may have typed a coupon, arrived on a partner's ?ref= link, or
    // both. Until now this handler read only `couponCode` and ignored referrals
    // entirely — which is why no partner had ever been paid for a sale made
    // through this funnel, and why the advertised "referred clients get 10%
    // off" never actually applied here.
    //
    // Organization size: re-derive the surcharge bands from the raw headcount
    // and site count whenever the form sent them, so the charge follows what
    // the buyer described rather than a number the browser worked out.
    const rawEmployees = Number.isFinite(+employeeCount) && +employeeCount > 0
      ? Math.floor(+employeeCount) : null;
    const rawLocations = Number.isFinite(+locationCount) && +locationCount > 0
      ? Math.floor(+locationCount) : null;
    const bands = rawEmployees !== null
      ? employeeBandsFromCount(rawEmployees)
      : Math.max(0, Math.floor(Number(employeeBands) || 0));
    const extraLocations = rawLocations !== null
      ? Math.max(0, rawLocations - INCLUDED_LOCATIONS)
      : Math.max(0, Math.floor(Number(additionalLocations) || 0));

    const totals = computeTotal({ standardSlug: isoName, employeeBands: bands, locations: extraLocations });

    const typed = await resolveCheckoutCode(couponCode);
    // Only resolve the link code if the typed one produced nothing useful, so
    // a code the buyer deliberately typed always wins over one they merely
    // arrived with.
    const needLink = !typed.coupon && !typed.referrer;
    const linked = needLink
      ? await resolveCheckoutCode(referralCode)
      : { coupon: null, referrer: null, referralCode: null };

    // The link's coupon was previously computed and then thrown away, so a
    // partner who shared a partner-owned coupon in their link had their buyer
    // silently dropped to the flat 10% instead of the larger promotion the
    // partner had advertised.
    const coupon = typed.coupon || linked.coupon || null;
    const referrer = typed.referrer || linked.referrer || null;
    const usedReferralCode = typed.referralCode || linked.referralCode || null;

    // The coupon and the referral discount do NOT stack — the buyer gets
    // whichever saves them more (bestDiscount resolves percent vs fixed-amount
    // into real money against this subtotal before comparing).
    const referralPct = referrer ? REFERRAL_BUYER_DISCOUNT_PERCENT : 0;
    const { discountAmount, total: finalPrice } = bestDiscount(totals.subtotal, coupon, referralPct);

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
    const recommendedIso = resolveOrderStandardCode(isoName) || isoName || 'ISO 9001:2015';
    const offline = isOfflineMethod(paymentMethod);
    const { data: appRow, error: appErr } = await supabaseAdmin
      .from('applications')
      .insert({
        client_id: userId,
        status: 'awaiting_registration',
        selected_package: selectedPackage,
        recommended_iso: recommendedIso,
        additional_employee_bands: bands,
        additional_locations: extraLocations,
        // The organization as the buyer described it, kept alongside the
        // pricing bands — the auditor and CB need the real numbers, not the
        // billing approximation of them.
        ...(rawEmployees !== null ? { employee_count: rawEmployees } : {}),
        ...(rawLocations !== null ? { locations_count: rawLocations } : {}),
        total_amount: finalPrice,
        payment_method: paymentMethod,
        payment_status: offline ? 'awaiting_verification' : 'pending',
        ...(company_name ? { company_name } : {}),
        ...(coupon ? { coupon_code: coupon.code } : {}),
        // Attribution rides on the ORDER, not on an email match against a row
        // the partner typed by hand. A buyer who pays with a different address
        // than the partner entered used to lose them the commission entirely.
        ...(usedReferralCode ? { referral_code: usedReferralCode } : {}),
        ...(referrer ? { referrer_id: referrer.id } : {}),
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
      // Carry the whole order back on cancel. Previously only the standard
      // survived, so a buyer who backed out of Stripe returned to a reset form
      // — org size gone, and the partner's referral code gone with it, which
      // cost the partner the commission on the retry.
      cancel_url: `${baseUrl}/checkout?${new URLSearchParams({
        iso: isoName || '',
        staff: String(bands),
        locations: String(extraLocations),
        ...(usedReferralCode ? { ref: usedReferralCode } : {}),
        cancelled: '1',
      }).toString()}`,
      metadata: { applicationId, clientId: userId, guest: 'true', paymentMethod, couponCode: coupon?.code || '', discountAmount: String(discountAmount) },
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
      .select('id, client_id, payment_status, coupon_code, total_amount, referrer_id, referral_code')
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
      // Stamp the method as well as the status: this is the automatic
      // "reflected from the payment gateway" link the client asked for — a
      // Stripe order then reads back as "Paid — Credit/Debit Card" in the admin
      // Payment Status dropdown without anybody touching it. 'card' is the only
      // online method (see src/config/paymentMethods.js), so it is unambiguous.
      await supabaseAdmin
        .from('applications')
        .update({ payment_status: 'paid', payment_method: 'card' })
        .eq('id', applicationId);
      // Burn the coupon now that money has actually arrived (first confirm only).
      await burnCoupon(app.coupon_code, {
        clientId: app.client_id, applicationId, finalAmount: app.total_amount,
      });

      // Credit the referring partner. This path does not run
      // applyPaymentLandedSideEffects (it deliberately leaves the buyer
      // pending for admin approval), so the credit has to be raised here too —
      // otherwise every CARD sale, the most common kind, would still pay
      // nobody. Idempotent, so an admin later marking the same order paid
      // cannot double it.
      if (app.referrer_id) {
        await creditReferralForOrder({
          applicationId,
          referrerId: app.referrer_id,
          clientId: app.client_id,
          clientEmail: email || '',
          finalAmount: app.total_amount,
          source: 'code',
        });
      }
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

      // The buyer gets a receipt notification of their own. This path does NOT
      // go through applyPaymentLandedSideEffects (it deliberately leaves the
      // client 'pending' for admin approval), so without this a card buyer had
      // no record of their payment anywhere in the product. It is waiting for
      // them the moment the admin approves their access.
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: app.client_id,
          type: 'system',
          title: 'Payment received',
          message: app.total_amount != null
            ? `We have received your card payment of ${Number(app.total_amount).toFixed(2)}. Your account is being activated.`
            : 'We have received your card payment. Your account is being activated.',
        });
      } catch (e) {
        console.error('payment-received notification failed (non-blocking):', e?.message);
      }
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
// -------------------------------------------------------
// Billing documents (invoice + payment receipt)
// -------------------------------------------------------
// All three are admin-gated. Issuing a financial document is a staff action;
// nothing here may be reachable by a client, and every amount is taken from
// the admin's request rather than the buyer's browser.

// A regional admin is scoped to their own region. verifyAdmin admits them but
// says nothing about WHICH records they may touch, so without this a Kenya
// admin could POST any other region's applicationId and read back the full
// invoice — bill-to details, amounts, and a working signed URL to the PDF.
// Returns { error, status } on refusal, or null when the caller may proceed.
async function assertBillingScope(caller, { applicationId, clientId }) {
  if (caller.role === 'super_admin') return null;

  let subjectId = clientId || null;
  if (!subjectId && applicationId) {
    const { data: app } = await supabaseAdmin
      .from('applications').select('client_id').eq('id', applicationId).maybeSingle();
    if (!app) return { error: 'Order not found', status: 404 };
    subjectId = app.client_id;
  }
  if (!subjectId) return { error: 'Provide an applicationId or clientId', status: 400 };

  const { data: subject } = await supabaseAdmin
    .from('profiles').select('region').eq('id', subjectId).maybeSingle();
  if (!subject) return { error: 'Client not found', status: 404 };

  if (!caller.region || subject.region !== caller.region) {
    return { error: 'Forbidden: that client is outside your region.', status: 403 };
  }
  return null;
}

async function issueInvoiceHandler(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const scope = await assertBillingScope(auth.caller, req.body || {});
  if (scope) return res.status(scope.status).json({ error: scope.error });

  try {
    const result = await issueInvoice(supabaseAdmin, req.body || {}, auth.caller);
    return res.status(200).json({
      success: true,
      invoice: result.invoice,
      alreadyExisted: result.alreadyExisted,
      emailSent: result.emailSent,
      url: await signedUrlFor(supabaseAdmin, result.invoice.storage_path),
    });
  } catch (err) {
    console.error('issue-invoice error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Could not issue the invoice' });
  }
}

async function issueReceiptHandler(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  const scope = await assertBillingScope(auth.caller, req.body || {});
  if (scope) return res.status(scope.status).json({ error: scope.error });

  try {
    const result = await issueReceipt(supabaseAdmin, req.body || {}, auth.caller);
    return res.status(200).json({
      success: true,
      receipt: result.receipt,
      invoice: result.invoice,
      emailSent: result.emailSent,
      url: await signedUrlFor(supabaseAdmin, result.receipt.storage_path),
    });
  } catch (err) {
    console.error('issue-receipt error:', err);
    return res.status(err.status || 500).json({ error: err.message || 'Could not issue the receipt' });
  }
}

// List the invoices and receipts for one application, each with a short-lived
// signed download URL. The PDFs live in a private bucket, so a URL is the only
// way to hand the file to the browser.
async function listBillingDocumentsHandler(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { applicationId, clientId } = req.body || {};
    if (!applicationId && !clientId) {
      return res.status(400).json({ error: 'Provide an applicationId or clientId' });
    }

    const scope = await assertBillingScope(auth.caller, { applicationId, clientId });
    if (scope) return res.status(scope.status).json({ error: scope.error });

    const filter = (q) => (applicationId ? q.eq('application_id', applicationId) : q.eq('client_id', clientId));

    const { data: invoices } = await filter(
      supabaseAdmin.from('invoices').select('*')).order('created_at', { ascending: false });
    const { data: receipts } = await filter(
      supabaseAdmin.from('payment_receipts').select('*')).order('created_at', { ascending: false });

    const withUrls = async (rows) => Promise.all((rows || []).map(async (r) => ({
      ...r,
      url: await signedUrlFor(supabaseAdmin, r.storage_path),
    })));

    return res.status(200).json({
      invoices: await withUrls(invoices),
      receipts: await withUrls(receipts),
    });
  } catch (err) {
    console.error('list-billing-documents error:', err);
    return res.status(500).json({ error: err.message || 'Could not load billing documents' });
  }
}

// Values accepted by the applications.payment_status / payment_method CHECK
// constraints (supabase/phase17_checkout_repair_and_country.sql). Anything
// outside these sets must be rejected here — Postgres would otherwise reject it
// as an opaque 23514 the admin cannot act on.
const PAYMENT_STATUS_VALUES = ['pending', 'awaiting_verification', 'verified', 'paid', 'unpaid'];
const PAYMENT_METHOD_VALUES = ['card', 'cash', 'bank_transfer', 'paypal', 'moneygram'];
// 'verified' is the legacy offline-verified value; both mean "money arrived".
const PAID_PAYMENT_STATUSES = ['verified', 'paid'];

// Everything that must happen once an order's money has actually landed:
// approve the buyer, burn their coupon, and email the one-click dashboard link.
// Shared by the Verify Payment button and the admin Payment Status dropdown so
// an admin who marks a cash sale "Paid" can never leave the buyer locked out.
// Returns whether the access email was sent.
async function applyPaymentLandedSideEffects(app, { alreadyPaid }) {
  // "Has this already run?" cannot be answered by the order's payment_status
  // alone. An admin who moves an order paid → unpaid → paid arrives back here
  // with alreadyPaid=false and would burn the coupon a second time and email a
  // second magic link. So look for the traces the first run leaves behind:
  //   - the buyer is already approved (created 'pending', so this only becomes
  //     true once payment landed or an admin granted access — and that button
  //     emails the link itself), and
  //   - a coupon_redemptions row already exists for this order.
  const { data: prof } = await supabaseAdmin
    .from('profiles').select('approval_status').eq('id', app.client_id).maybeSingle();
  const alreadyApproved = prof?.approval_status === 'approved';

  await supabaseAdmin.from('profiles').update({ approval_status: 'approved' }).eq('id', app.client_id);

  // Coupon burn and access email fire only on the first confirmation.
  if (alreadyPaid || alreadyApproved) return false;

  const { data: burnt } = await supabaseAdmin
    .from('coupon_redemptions').select('id').eq('application_id', app.id).limit(1);
  if (!burnt?.length) {
    await burnCoupon(app.coupon_code, {
      clientId: app.client_id, applicationId: app.id, finalAmount: app.total_amount,
    });
  }

  // Credit the partner who brought this sale, if any. Attribution was stamped
  // onto the order at checkout (phase25 applications.referrer_id), so it does
  // not depend on the buyer's email still matching a row a partner typed by
  // hand months earlier. Idempotent — see creditReferralForOrder.
  if (app.referrer_id) {
    const { data: buyer } = await supabaseAdmin
      .from('profiles').select('email').eq('id', app.client_id).maybeSingle();
    await creditReferralForOrder({
      applicationId: app.id,
      referrerId: app.referrer_id,
      clientId: app.client_id,
      clientEmail: buyer?.email || '',
      finalAmount: app.total_amount,
      source: 'code',
    });
  }

  // Tell the buyer their money arrived. Until now the only thing that ever
  // raised a "Payment received" notification was the post-payment registration
  // form (src/pages/client/ApplicationForm.jsx, on ?payment=success) — so a
  // card buyer who closed the tab, and EVERY cash or bank-transfer buyer, got
  // nothing in their notifications at all. This is the one place all three
  // payment routes converge, so it is the right place to raise it.
  // Best-effort: a notification failure must never roll back a confirmed sale.
  try {
    await supabaseAdmin.from('notifications').insert({
      user_id: app.client_id,
      type: 'system',
      title: 'Payment received',
      message: app.total_amount != null
        ? `We have received your payment of ${Number(app.total_amount).toFixed(2)}. Your certification is now being processed.`
        : 'We have received your payment. Your certification is now being processed.',
    });
  } catch (e) {
    console.error('payment-received notification failed (non-blocking):', e?.message);
  }

  const r = await emailDashboardLink(app.client_id);
  return r.ok;
}

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
      .select('id, client_id, payment_status, coupon_code, total_amount, referrer_id, referral_code')
      .eq('id', applicationId)
      .maybeSingle();
    if (!app) return res.status(404).json({ error: 'Order not found' });

    const alreadyVerified = PAID_PAYMENT_STATUSES.includes(app.payment_status);

    await supabaseAdmin.from('applications').update({ payment_status: 'verified' }).eq('id', applicationId);
    const emailSent = await applyPaymentLandedSideEffects(app, { alreadyPaid: alreadyVerified });

    return res.status(200).json({ ok: true, emailSent });
  } catch (error) {
    console.error('verify-offline-payment error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}

// ---- Admin: set an order's payment status + method from the workflow card ----
// Admin-gated and region-scoped. Deliberately NOT done as a browser-side
// applications.update(): moving an order into a paid state has to carry the same
// follow-through as the Verify Payment button (approve the client, burn the
// coupon, email their dashboard link), which needs the service role.
async function setPaymentStatusHandler(req, res) {
  const auth = await verifyAdmin(req);
  if (auth.error) return res.status(auth.status).json({ error: auth.error });

  try {
    const { applicationId, paymentStatus, paymentMethod } = req.body || {};
    if (!applicationId) return res.status(400).json({ error: 'Missing application reference' });

    const scope = await assertBillingScope(auth.caller, { applicationId });
    if (scope) return res.status(scope.status).json({ error: scope.error });

    const nextStatus = paymentStatus ? String(paymentStatus) : null;
    const nextMethod = paymentMethod ? String(paymentMethod) : null;
    // A blank status is NOT accepted. Writing payment_status = NULL would make
    // the client dashboard treat the order as paid (it reads null as "no gate")
    // and expose the assigned Certification Body on an unpaid order. An admin
    // who means "not paid" picks Unpaid.
    if (!nextStatus || !PAYMENT_STATUS_VALUES.includes(nextStatus)) {
      return res.status(400).json({ error: 'Invalid payment status' });
    }
    if (nextMethod && !PAYMENT_METHOD_VALUES.includes(nextMethod)) {
      return res.status(400).json({ error: 'Invalid payment method' });
    }

    const { data: app } = await supabaseAdmin
      .from('applications')
      .select('id, client_id, payment_status, payment_method, coupon_code, total_amount, referrer_id, referral_code')
      .eq('id', applicationId)
      .maybeSingle();
    if (!app) return res.status(404).json({ error: 'Order not found' });

    const wasPaid = PAID_PAYMENT_STATUSES.includes(app.payment_status);
    const nowPaid = PAID_PAYMENT_STATUSES.includes(nextStatus);

    // The method is only written when the chosen option carries one (the
    // "Paid — …" rows). The non-paid options say nothing about how the buyer
    // intends to pay, so moving a bank-transfer order to "Awaiting
    // verification" must not erase payment_method='bank_transfer' — otherwise
    // verifying it later would re-label a bank sale as a card sale.
    const patch = { payment_status: nextStatus };
    if (nextMethod) patch.payment_method = nextMethod;

    const { error: updErr } = await supabaseAdmin
      .from('applications')
      .update(patch)
      .eq('id', applicationId);
    if (updErr) throw updErr;

    const emailSent = nowPaid
      ? await applyPaymentLandedSideEffects(app, { alreadyPaid: wasPaid })
      : false;

    return res.status(200).json({
      ok: true,
      emailSent,
      payment_status: nextStatus,
      payment_method: nextMethod || app.payment_method || null,
    });
  } catch (error) {
    console.error('set-payment-status error:', error);
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
  // Admin sets an order's payment status/method from the Workflow Controls card.
  // Moving into a paid state grants dashboard access, same as verifying above.
  if (req.body?.action === 'set-payment-status') {
    return setPaymentStatusHandler(req, res);
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
  // --- Billing documents ---
  // These live here rather than in their own api/ file because api/ is at
  // exactly the 12-function Vercel Hobby ceiling; a 13th route file would fail
  // the deployment. The implementation is in api/_billing.js.
  if (req.body?.action === 'issue-invoice') {
    return issueInvoiceHandler(req, res);
  }
  if (req.body?.action === 'issue-receipt') {
    return issueReceiptHandler(req, res);
  }
  if (req.body?.action === 'list-billing-documents') {
    return listBillingDocumentsHandler(req, res);
  }

  try {
    const {
      isoName,
      applicationId,
      applicationIds,
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

    // ---- 0. Resolve which certifications this order covers ----
    // Since 9 Aug the dashboard lets a client pick several standards at once.
    // Each one is its own application row (each is audited and certified
    // separately) but they are paid for in a single transaction. A request
    // that sends only `applicationId` behaves exactly as before.
    const requestedIds = [...new Set(
      (Array.isArray(applicationIds) && applicationIds.length ? applicationIds : [applicationId])
        .filter(id => typeof id === 'string' && id.trim())
    )];

    let orderApplications = [];
    if (requestedIds.length) {
      const { data: rows, error: rowsErr } = await supabaseAdmin
        .from('applications')
        .select('id, client_id, recommended_iso')
        .in('id', requestedIds);
      if (rowsErr) {
        console.error('checkout: could not load the order applications:', rowsErr);
        return res.status(500).json({ error: 'Could not load your order. Please try again.' });
      }
      orderApplications = rows || [];
      // Every row must exist AND belong to the buyer. Without this, a crafted
      // basket could attach someone else's applications to this payment — and
      // paying for a row is what unlocks it.
      //
      // A single-application order is only held to this when the row actually
      // came back, so any older call path that reaches here without a matching
      // row still falls through to the request's own `isoName` as before.
      const owned =
        !!clientId
        && orderApplications.length === requestedIds.length
        && orderApplications.every(a => a.client_id === clientId);
      if (!owned && requestedIds.length > 1) {
        return res.status(403).json({ error: 'Order not found for this account.' });
      }
      if (!owned) {
        orderApplications = [];
      } else {
        // Preserve the buyer's order so the Stripe description reads the same
        // as the checkout page they just confirmed.
        const byId = new Map(orderApplications.map(a => [a.id, a]));
        orderApplications = requestedIds.map(id => byId.get(id));
      }
    }

    // ---- 0b. Recompute the buyer's price server-side ----
    // Never trust the client. The same helper feeds the UI total, so the
    // displayed amount and the charge always agree. Full payment only.
    //
    // Which standards are in the order is read from the rows above, NOT from
    // the request. Since 12 Aug the catalog has two price points, so `isoName`
    // stopped being a cosmetic label: a buyer who sent 'iso-9001' while
    // holding an ISO 27001 application would otherwise be charged $999 for a
    // $1,999 certification. `isoName` is only used when no row was loaded.
    //
    // One entry per row, INCLUDING rows whose recommended_iso is blank — the
    // priced list has to stay index-aligned with requestedIds, because the
    // per-row money split below walks the two together. A blank standard falls
    // through getPriceForStandard to the higher of the two prices, so a missing
    // value can never undercharge.
    const pricedStandards = orderApplications.length
      ? orderApplications.map(a => a?.recommended_iso || null)
      : [isoName];
    // Same list with the blanks dropped — for display only (Stripe's line-item
    // description), never for money.
    const orderStandards = pricedStandards.filter(Boolean);
    // Counted from rows the server loaded itself, never from the request.
    const standardsCount = pricedStandards.length;

    const totals = computeTotal({
      standardSlugs: pricedStandards,
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
        .ilike('code', normalizeCouponCode(couponCode))
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
    // A percent coupon and a fixed-amount coupon can't be compared as raw
    // numbers, so bestDiscount resolves both into money against this subtotal
    // and keeps whichever saves the buyer more.
    const referralSignupDiscountPct = referralRecord ? 10 : 0;
    const { discountAmount, total: finalPrice } = bestDiscount(price, coupon, referralSignupDiscountPct);

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
      // Each row carries its own share of the order, not the basket total —
      // otherwise a three-standard order would be counted three times over in
      // every revenue figure that sums this column. One statement per row
      // because the shares differ; the (id, client_id) scope and the
      // "every row came back" check below are exactly as they were.
      const offlineShares = amountShares(finalPrice, totals.prices);
      const updated = [];
      try {
        for (let i = 0; i < requestedIds.length; i++) {
          const { data, error: offErr } = await supabaseAdmin
            .from('applications')
            .update({
              additional_employee_bands: Math.max(0, Math.floor(Number(employeeBands) || 0)),
              additional_locations: Math.max(0, Math.floor(Number(additionalLocations) || 0)),
              total_amount: offlineShares[i],
              payment_method: paymentMethod,
              payment_status: 'awaiting_verification',
              ...(coupon ? { coupon_code: coupon.code } : {}),
            })
            .eq('id', requestedIds[i])
            .eq('client_id', clientId)
            .select('id');
          if (offErr) throw offErr;
          if (data?.length) updated.push(data[0].id);
        }
      } catch (persistErr) {
        console.error('Offline order persistence error:', persistErr);
        return res.status(500).json({ error: 'Could not record your order. Please try again.' });
      }
      if (updated.length !== requestedIds.length) {
        return res.status(403).json({ error: 'Order not found for this account.' });
      }
      return res.status(200).json({
        offline: true,
        paymentMethod,
        amount: finalPrice,
        appliedDiscountAmount: discountAmount,
      });
    }

    // ---- 4a. Stripe session (card / PayPal) — full one-time payment ----
    const lineItem = {
      price_data: {
        currency: 'usd',
        product_data: {
          name: standardsCount > 1
            ? `${standardsCount} certifications - ${PACKAGE_LABEL} Package`
            : `${resolveOrderStandardCode(isoName) || isoName} - ${PACKAGE_LABEL} Package`,
          // Stripe shows this under the item, so the buyer can see on the
          // payment page itself exactly which standards they are paying for.
          description: standardsCount > 1 && orderStandards.length
            ? orderStandards.join(' · ')
            : 'One-Time Payment',
        },
        unit_amount: Math.round(finalPrice * 100),
      },
      quantity: 1,
    };

    const baseUrl = process.env.VITE_APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://certify.cx');
    // The rest of the basket travels back from Stripe so the registration form
    // can complete every application that was just paid for.
    const alsoQuery = requestedIds.length > 1
      ? `&also=${requestedIds.slice(1).join(',')}`
      : '';

    const sessionConfig = {
      payment_method_types: stripeMethodTypesFor(paymentMethod),
      line_items: [lineItem],
      mode: 'payment',
      // Allow coupons created directly in the Stripe dashboard to also work,
      // alongside our app-managed discount_coupons table.
      allow_promotion_codes: true,
      success_url: `${baseUrl}/client/apply/${applicationId}?payment=success${alsoQuery}`,
      cancel_url: `${baseUrl}/client/checkout/${applicationId}?payment=cancelled`,
      metadata: {
        applicationId: applicationId,
        applicationIds: requestedIds.join(','),
        clientId: clientId,
        paymentMethod,
        referralDiscount: referralRecord ? 'true' : 'false',
        couponCode: coupon?.code || '',
        discountAmount: String(discountAmount),
        employeeBands: String(totals.employeeSurchargeTotal / 200 || 0),
        additionalLocations: String(totals.locationSurchargeTotal / 200 || 0),
      },
    };

    const session = await stripe.checkout.sessions.create(sessionConfig);

    // ---- 4b. Persist surcharge counts + total to the application row ----
    // The applications table has additional_employee_bands /
    // additional_locations / total_amount columns (see Phase B migration).
    if (requestedIds.length) {
      // Per row, not the basket total, and weighted by list price — see the
      // offline branch above.
      const shares = amountShares(totals.subtotal, totals.prices);
      try {
        for (let i = 0; i < requestedIds.length; i++) {
          await supabaseAdmin
            .from('applications')
            .update({
              additional_employee_bands: Math.max(0, Math.floor(Number(employeeBands) || 0)),
              additional_locations: Math.max(0, Math.floor(Number(additionalLocations) || 0)),
              total_amount: shares[i],
              payment_method: paymentMethod,
              payment_status: 'pending',
            })
            .eq('id', requestedIds[i]);
        }
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
          discount_type: coupon.discount_type || 'percent',
          discount_percent: coupon.discount_percent == null ? null : Number(coupon.discount_percent),
          discount_amount: coupon.discount_amount == null ? null : Number(coupon.discount_amount),
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
      coupon: coupon ? {
        code: coupon.code,
        discount_type: coupon.discount_type || 'percent',
        discount_percent: coupon.discount_percent == null ? null : Number(coupon.discount_percent),
        discount_amount: coupon.discount_amount == null ? null : Number(coupon.discount_amount),
      } : null,
      appliedDiscountAmount: discountAmount,
    });
  } catch (error) {
    console.error('Stripe checkout error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
