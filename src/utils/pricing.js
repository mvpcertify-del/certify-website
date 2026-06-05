// -------------------------------------------------------
// Certify.cx — Pricing
//
// Per-standard pricing model with explicit employee/location surcharges.
// ISO 9001 / 14001 / 45001 sit in the lower band ($799 / $999); every other
// catalog standard sits in the higher band ($999 / $1299).
//
// The buyer's headline price assumes an organization with up to 10
// employees at 1 location. Additional 50-employee bands and additional
// locations each add a flat surcharge.
//
// Discount/promo codes are applied on the payment gateway by
// api/checkout.js — no geo or country-tier pricing here.
// -------------------------------------------------------
import { ISO_CATALOG, getIsoBySlug, getIsoByCode } from './isoCatalog.js';

// Standards in the lower pricing band.
const LOWER_BAND_SLUGS = new Set(['iso-9001', 'iso-14001', 'iso-45001']);

// Two-tier pricing per band (USD, one-time).
const PRICING = {
  lower:  { standard: 799, premium: 999  },
  higher: { standard: 999, premium: 1299 },
};

// Each cumulative band of 50 additional employees adds this.
export const SURCHARGE_PER_EMPLOYEE_BAND = 200;
// Each additional physical site adds this.
export const SURCHARGE_PER_LOCATION = 200;
// Headcount included in the base price.
export const INCLUDED_EMPLOYEES = 10;
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

function bandFor(slug) {
  const s = resolveStandardSlug(slug);
  return s && LOWER_BAND_SLUGS.has(s) ? PRICING.lower : PRICING.higher;
}

function normalizeTier(tier) {
  return String(tier || 'standard').toLowerCase() === 'premium' ? 'premium' : 'standard';
}

// Base one-time price for a standard at the given tier.
export function getPriceForStandard(slug, tier = 'standard') {
  return bandFor(slug)[normalizeTier(tier)];
}

// Monthly equivalent for the 12-month plan. Preserves the legacy ~9× ratio
// ($799 → $89) so existing UI math doesn't shift.
export function getMonthlyForStandard(slug, tier = 'standard') {
  return Math.ceil(getPriceForStandard(slug, tier) / 9);
}

// Convert a buyer-entered headcount into a count of cumulative 50-employee
// surcharge bands above the included 10. 10 → 0 bands; 50 → 1; 100 → 2; …
export function employeeBandsFromCount(employeeCount) {
  const n = Math.max(0, Math.floor(Number(employeeCount) || 0));
  if (n <= INCLUDED_EMPLOYEES) return 0;
  return Math.ceil((n - INCLUDED_EMPLOYEES) / EMPLOYEES_PER_BAND);
}

// Single source of truth for the buyer's total, used by both the UI and
// api/checkout.js so client and server agree.
//   employeeBands  cumulative 50-headcount bands above the included 10
//   locations      additional sites beyond the included 1
// Returns:
//   {
//     base,                  // base price for the chosen period
//     employeeSurchargeTotal,// flat surcharge across the contract
//     locationSurchargeTotal,// flat surcharge across the contract
//     subtotal,              // amount to charge per period (per month if isMonthly)
//     contractTotal,         // total over the full contract (subtotal × 12 if isMonthly)
//   }
// Monthly subscriptions distribute the surcharges across 12 months (rounded
// up per month so we never under-collect).
export function computeTotal({
  standardSlug,
  tier = 'standard',
  isMonthly = false,
  employeeBands = 0,
  locations = 0,
}) {
  const base = isMonthly
    ? getMonthlyForStandard(standardSlug, tier)
    : getPriceForStandard(standardSlug, tier);

  const bands = Math.max(0, Number.isFinite(+employeeBands) ? Math.floor(+employeeBands) : 0);
  const locs  = Math.max(0, Number.isFinite(+locations)     ? Math.floor(+locations)     : 0);

  const employeeSurchargeTotal = bands * SURCHARGE_PER_EMPLOYEE_BAND;
  const locationSurchargeTotal = locs  * SURCHARGE_PER_LOCATION;

  const employeeSurchargePerPeriod = isMonthly ? Math.ceil(employeeSurchargeTotal / 12) : employeeSurchargeTotal;
  const locationSurchargePerPeriod = isMonthly ? Math.ceil(locationSurchargeTotal / 12) : locationSurchargeTotal;

  const subtotal = base + employeeSurchargePerPeriod + locationSurchargePerPeriod;
  const contractTotal = isMonthly ? subtotal * 12 : subtotal;

  return {
    base,
    employeeSurchargeTotal,
    locationSurchargeTotal,
    employeeSurchargePerPeriod,
    locationSurchargePerPeriod,
    subtotal,
    contractTotal,
  };
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
    standard: getPriceForStandard(s.slug, 'standard'),
    premium:  getPriceForStandard(s.slug, 'premium'),
  }));
}
