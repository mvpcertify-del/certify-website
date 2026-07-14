// -------------------------------------------------------
// Certify.cx — Pricing
//
// SINGLE-PACKAGE, SINGLE-PRICE model. Every catalog standard is offered as ONE
// all-inclusive "Standard" certification package at the SAME price — $999.
// (The client dropped the old Bronze / Silver / Gold three-tier model and the
// 12-month support/audit add-ons, then flattened the last remaining price
// split: ISO 9001 / 14001 / 45001 used to be $799 and are now $999 like the
// rest.)
//
// The buyer's headline price covers an organization with up to 50
// employees at 1 location. Additional 50-employee bands and additional
// locations each add a flat surcharge. Payment is full (one-time) only —
// installment/monthly plans were removed.
//
// Note on `tier`: the pricing engine is now tier-agnostic. Functions still
// accept a `tier` argument for backward-compatibility with older call sites
// and stored application rows, but it is ignored — the price is the single
// package base plus surcharges.
//
// Discount/promo codes are applied on the payment gateway by
// api/checkout.js — no geo or country-tier pricing here.
// -------------------------------------------------------
import { ISO_CATALOG, getIsoBySlug, getIsoByCode } from './isoCatalog.js';

// Base certification price (USD, one-time). One price for every standard.
const BASE_PRICE = 999;

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

// One-time price for a standard. Tier-agnostic AND standard-agnostic: both
// arguments are accepted for backward-compatibility with older call sites and
// stored rows, but every standard is the same single package price.
export function getPriceForStandard(_slug, _tier) {
  return BASE_PRICE;
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
//   employeeBands  cumulative 50-headcount bands above the included 10
//   locations      additional sites beyond the included 1
// Returns:
//   {
//     base,                  // base package price
//     employeeSurchargeTotal,// flat employee surcharge
//     locationSurchargeTotal,// flat location surcharge
//     subtotal,              // amount to charge (base + surcharges)
//   }
export function computeTotal({
  standardSlug,
  tier, // accepted but ignored (single-package model); kept for compatibility
  employeeBands = 0,
  locations = 0,
}) {
  const base = getPriceForStandard(standardSlug);

  const bands = Math.max(0, Number.isFinite(+employeeBands) ? Math.floor(+employeeBands) : 0);
  const locs  = Math.max(0, Number.isFinite(+locations)     ? Math.floor(+locations)     : 0);

  const employeeSurchargeTotal = bands * SURCHARGE_PER_EMPLOYEE_BAND;
  const locationSurchargeTotal = locs  * SURCHARGE_PER_LOCATION;

  const subtotal = base + employeeSurchargeTotal + locationSurchargeTotal;

  return {
    base,
    employeeSurchargeTotal,
    locationSurchargeTotal,
    subtotal,
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
    price: getPriceForStandard(s.slug),
  }));
}
