// -------------------------------------------------------
// Certify.cx — Pricing
//
// SINGLE-PACKAGE model: every catalog standard is offered as ONE all-inclusive
// "Standard" certification package. (The client dropped the old Bronze /
// Silver / Gold three-tier model and the 12-month support/audit add-ons.)
//
// TWO price points, set by the client on 12 Aug (core trio raised from $999 to $1,500 on 18 Sep):
//   ISO 9001 / ISO 14001 / ISO 45001 ....... US$ 1,500
//   every other standard ................... US$ 1,999
// The three cheaper standards are the high-volume management-system trio;
// everything else (food safety, information security, AI, medical devices, …)
// is a specialist audit and is priced accordingly. CORE_STANDARDS below is the
// single place that split is expressed — nothing else in the app hard-codes a
// number, so moving a standard between the two prices is a one-line change.
//
// The buyer's headline price covers an organization with up to 50
// employees at 1 location. Additional 50-employee bands and additional
// locations each add a flat surcharge. Payment is full (one-time) only —
// installment/monthly plans were removed.
//
// Note on `tier`: the pricing engine is tier-agnostic. Functions still accept
// a `tier` argument for backward-compatibility with older call sites and
// stored application rows, but it is ignored.
//
// Discount/promo codes are applied on the payment gateway by
// api/checkout.js — no geo or country-tier pricing here.
// -------------------------------------------------------
import { ISO_CATALOG, getIsoBySlug, getIsoByCode } from './isoCatalog.js';
// Data only — complianceServices.js imports no images, so this stays safe to
// pull into api/checkout.js, which runs in Node. Never swap it for
// complianceAudits.js here: that one imports .png files and would break the
// checkout API at import time.
import { resolveComplianceService } from './complianceServices.js';
import { getTestCheckoutItem } from './testCheckoutItem.js';

// Price of the three core management-system standards (USD, one-time).
export const CORE_PRICE = 1500;
// Price of every other standard in the catalog.
export const BASE_PRICE = 1999;
// The standards that carry CORE_PRICE, by catalog slug.
export const CORE_STANDARDS = new Set(['iso-9001', 'iso-14001', 'iso-45001']);

// The one package everyone buys. Stored on applications.selected_package and
// shown wherever a package name is displayed.
export const PACKAGE_LABEL = 'Standard';

// Each cumulative band of 50 additional employees adds this.
export const SURCHARGE_PER_EMPLOYEE_BAND = 200;
// Each additional physical site adds this.
export const SURCHARGE_PER_LOCATION = 200;
// Headcount included in the base price.
export const INCLUDED_EMPLOYEES = 50;
// Locations included in the base price.
export const INCLUDED_LOCATIONS = 1;
// Each surcharge band covers this many employees.
export const EMPLOYEES_PER_BAND = 50;

// Accept an ISO slug ('iso-9001') OR code ('ISO 9001' / 'ISO 9001:2015')
// and return the canonical slug, or null if unrecognized.
export function resolveStandardSlug(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (getIsoBySlug(trimmed)) return trimmed;
  const codeOnly = trimmed.split(':')[0].trim();
  return getIsoByCode(codeOnly)?.slug || null;
}

// One-time price for a standard. Tier-agnostic — `tier` is accepted for
// backward-compatibility with older call sites and stored rows, and ignored.
//
// Accepts a slug ('iso-9001'), a code ('ISO 9001') or a stored
// `recommended_iso` value ('ISO 9001:2015'); resolveStandardSlug normalizes
// all three. Anything unrecognized is priced at BASE_PRICE — the higher of the
// two — so an unmapped standard can never be sold below its intended price.
export function getPriceForStandard(slug, _tier) {
  // Hidden $1 test item (src/utils/testCheckoutItem.js) — checked first so it
  // always prices at $1 regardless of what it would otherwise resolve to.
  const testItem = getTestCheckoutItem(slug);
  if (testItem) return testItem.price;

  // Compliance audits (SOC, GDPR, PCI DSS, …) carry their own price and are
  // checked first. They resolve from either their slug ('sox-itgc', which is
  // what the ?iso= link carries) or their stored code ('SOX ITGC', which is
  // what applications.recommended_iso holds and what the server re-prices from
  // on every later call).
  const compliance = resolveComplianceService(slug);
  if (compliance) return compliance.price;

  const resolved = resolveStandardSlug(slug);
  return resolved && CORE_STANDARDS.has(resolved) ? CORE_PRICE : BASE_PRICE;
}

// Turn whatever named the order — an ISO slug, an ISO code, a compliance slug
// or a compliance code — into the display code stored on
// applications.recommended_iso and printed on the Stripe line item. Returns
// null when nothing recognizes it, so callers keep their own fallback.
//
// Used by api/checkout.js so a compliance order is recorded as 'SOX ITGC'
// rather than the raw 'sox-itgc' slug: the slug would still price correctly,
// but every human-facing surface (the admin's new-order alert, the buyer's
// Stripe receipt, the invoice) would show a URL fragment.
export function resolveOrderStandardCode(input) {
  const testItem = getTestCheckoutItem(input);
  if (testItem) return testItem.code;
  const compliance = resolveComplianceService(input);
  if (compliance) return compliance.code;
  return getIsoBySlug(input)?.code || null;
}

// Convert a buyer-entered headcount into a count of cumulative 50-employee
// surcharge bands above the included 50. 50 → 0 bands; 100 → 1; 150 → 2; …
export function employeeBandsFromCount(employeeCount) {
  const n = Math.max(0, Math.floor(Number(employeeCount) || 0));
  if (n <= INCLUDED_EMPLOYEES) return 0;
  return Math.ceil((n - INCLUDED_EMPLOYEES) / EMPLOYEES_PER_BAND);
}

// Single source of truth for the buyer's total, used by both the UI and
// api/checkout.js so client and server agree. Full (one-time) payment only.
//   standardSlug    the one standard being bought (single-certification order)
//   standardSlugs   OR the full basket, in the buyer's chosen order. Since the
//                   two price points were introduced (12 Aug) a basket can mix
//                   $999 and $1,999 standards, so a count alone is no longer
//                   enough to price one — pass the list whenever there is one.
//   employeeBands   cumulative 50-headcount bands above the included 50
//   locations       additional sites beyond the included 1
//   standardsCount  legacy fallback: how many of `standardSlug` are being
//                   bought. Only consulted when `standardSlugs` is absent.
//                   Each certification is its own audit against the same
//                   organization, so the org-size surcharges are charged per
//                   certification, not once for the basket.
// Returns:
//   {
//     count,                 // certifications in the order
//     prices,                // list price of each, in basket order
//     perStandard,           // price of the first/only one (legacy callers)
//     uniformPrice,          // false when the basket mixes the two prices —
//                            // a "N × $999" line item is then a lie
//     base,                  // sum of the list prices
//     employeeSurchargeTotal,// flat employee surcharge
//     locationSurchargeTotal,// flat location surcharge
//     subtotal,              // amount to charge (base + surcharges)
//   }
export function computeTotal({
  standardSlug,
  standardSlugs,
  tier, // accepted but ignored (single-package model); kept for compatibility
  employeeBands = 0,
  locations = 0,
  standardsCount = 1,
}) {
  const basket = Array.isArray(standardSlugs) && standardSlugs.length ? standardSlugs : null;
  // Defaults to 1 so every existing single-standard call site is unchanged.
  const count = basket
    ? basket.length
    : Math.max(1, Number.isFinite(+standardsCount) ? Math.floor(+standardsCount) : 1);

  const items = basket || Array.from({ length: count }, () => standardSlug);
  const prices = items.map(s => getPriceForStandard(s));
  const base = prices.reduce((sum, p) => sum + p, 0);
  const perStandard = prices[0];
  const uniformPrice = prices.every(p => p === perStandard);

  const bands = Math.max(0, Number.isFinite(+employeeBands) ? Math.floor(+employeeBands) : 0);
  const locs  = Math.max(0, Number.isFinite(+locations)     ? Math.floor(+locations)     : 0);

  const employeeSurchargeTotal = bands * SURCHARGE_PER_EMPLOYEE_BAND * count;
  const locationSurchargeTotal = locs  * SURCHARGE_PER_LOCATION * count;

  const subtotal = base + employeeSurchargeTotal + locationSurchargeTotal;

  return {
    count,
    prices,
    perStandard,
    uniformPrice,
    base,
    employeeSurchargeTotal,
    locationSurchargeTotal,
    subtotal,
  };
}

// Apply a discount coupon to a subtotal.
//
// Coupons come in two shapes (see supabase/phase20_billing_invoices_receipts):
//   discount_type='percent' → discount_percent, e.g. 10 = 10% off
//   discount_type='amount'  → discount_amount,  e.g. 200 = US$200 off
//
// Single source of truth so the checkout UI and api/checkout.js can never
// disagree about what the buyer owes. Older rows have no discount_type; they
// are all percent coupons, hence the fallback.
//
// The result is clamped at zero — a $699 coupon against a $300 order gives a
// $300 discount and a $0 total, never a negative charge.
export function applyCoupon(subtotal, coupon) {
  const base = Math.max(0, Number(subtotal) || 0);
  if (!coupon) {
    return { discountAmount: 0, total: base, label: null };
  }

  const type = coupon.discount_type || 'percent';
  let discountAmount;
  let label;

  if (type === 'amount') {
    discountAmount = Math.max(0, Number(coupon.discount_amount) || 0);
    label = `US$${discountAmount.toLocaleString()} off`;
  } else {
    const pct = Math.max(0, Number(coupon.discount_percent) || 0);
    discountAmount = base * (pct / 100);
    label = `${pct}% off`;
  }

  discountAmount = Math.min(base, Math.round(discountAmount * 100) / 100);

  return {
    discountAmount,
    total: Math.round((base - discountAmount) * 100) / 100,
    label,
  };
}

// Pick the better of two competing discounts. Percent and fixed-amount
// coupons cannot be compared numerically (25 vs 200 is meaningless), so they
// are resolved into actual money against this subtotal first. Used where a
// coupon and the baseline referral sign-up discount both apply — they do not
// stack, the buyer gets whichever saves more.
export function bestDiscount(subtotal, coupon, referralPercent = 0) {
  const withCoupon = applyCoupon(subtotal, coupon);
  const withReferral = referralPercent > 0
    ? applyCoupon(subtotal, { discount_type: 'percent', discount_percent: referralPercent })
    : { discountAmount: 0, total: Math.max(0, Number(subtotal) || 0), label: null };

  return withReferral.discountAmount > withCoupon.discountAmount ? withReferral : withCoupon;
}

// -------------------------------------------------------
// Public landing-page Pricing Calculator
//
// A self-service estimator shown on the ISO landing page, distinct from the
// post-purchase checkout surcharge model above. The buyer types an exact
// headcount and location count; charges are flat per 10-employee band and
// per additional site:
//   Employees  1–10 → included, then +$200 per 10 (11–20 +$200, 21–30 +$400 …)
//   Locations  1 included, then +$300 each additional
// -------------------------------------------------------
export const CALC_EMPLOYEES_INCLUDED = 10;
export const CALC_EMPLOYEES_PER_BAND = 10;
export const CALC_CHARGE_PER_EMPLOYEE_BAND = 200;
export const CALC_LOCATIONS_INCLUDED = 1;
export const CALC_CHARGE_PER_LOCATION = 300;

// Flat employee surcharge for an exact headcount. 10 → $0; 11–20 → $200;
// 21–30 → $400; … and continues linearly for larger organizations.
export function calcEmployeeCharge(employeeCount) {
  const n = Math.max(0, Math.floor(Number(employeeCount) || 0));
  if (n <= CALC_EMPLOYEES_INCLUDED) return 0;
  const bands = Math.ceil((n - CALC_EMPLOYEES_INCLUDED) / CALC_EMPLOYEES_PER_BAND);
  return bands * CALC_CHARGE_PER_EMPLOYEE_BAND;
}

// Flat location surcharge: $300 for every site beyond the first.
export function calcLocationCharge(locationCount) {
  const n = Math.max(0, Math.floor(Number(locationCount) || 0));
  const additional = Math.max(0, n - CALC_LOCATIONS_INCLUDED);
  return additional * CALC_CHARGE_PER_LOCATION;
}

// Full calculator breakdown for the landing page and its generated invoice.
//   basePrice      base package price (defaults to the standard tier)
//   employeeCount  exact headcount entered by the buyer
//   locationCount  exact number of sites entered by the buyer
export function calcPackageTotal({ basePrice, employeeCount = 1, locationCount = 1 }) {
  const base = Math.max(0, Number(basePrice) || 0);
  const employeeCharge = calcEmployeeCharge(employeeCount);
  const locationCharge = calcLocationCharge(locationCount);
  return {
    basePrice: base,
    employeeCharge,
    locationCharge,
    total: base + employeeCharge + locationCharge,
  };
}

// Pricing table across all catalog standards. Useful for an admin overview
// or a public pricing matrix.
export function getPricingTable() {
  return Object.values(ISO_CATALOG).map(s => ({
    slug: s.slug,
    code: s.code,
    price: getPriceForStandard(s.slug),
  }));
}
