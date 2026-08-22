// ============================================
// Certify.cx — Compliance Audit services (data only)
// ============================================
// The eight non-ISO compliance audit engagements sold alongside the ISO
// catalog. Shown on the landing page, on /certifications, on their own
// /compliance/:slug page, and selectable in the public checkout.
//
// WHY THIS FILE IS SEPARATE FROM complianceAudits.js
// --------------------------------------------------
// This module holds no image imports. utils/pricing.js has to price a
// compliance service, and pricing.js is imported by api/checkout.js, which runs
// in Node on Vercel — Node cannot import a .png, so a single asset import
// reachable from here would take the whole checkout API down. The logos live in
// complianceAudits.js, which is only ever imported by React components.
//
// STILL DELIBERATELY NOT PART OF ISO_CATALOG
// ------------------------------------------
// These are audit and advisory engagements, not accredited ISO certifications.
// Keeping them out of ISO_CATALOG keeps them out of the auditor's ISO standard
// list and the ISO-specific parts of the application flow, while the price and
// checkout paths below are shared on purpose so a buyer pays through exactly
// the same gateway either way.
//
// PRICES — READ THIS BEFORE CHANGING THEM
// ---------------------------------------
// The client asked (22 Aug) for these eight to be buyable, but has not yet
// given a price for any of them. Nothing here is an invented number: every one
// is set to COMPLIANCE_PRICE, which is the site's OWN existing specialist-audit
// price (utils/pricing.js BASE_PRICE, US$1,999) — the same price ISO/IEC 27001
// and the other specialist standards already sell at.
//
// That is a placeholder, and a live one: a buyer can pay it today. Real SOC 2
// and HITRUST engagements are usually priced well above it. Each service has
// its own `price` field so a single number can be corrected without touching
// the other seven.

// The site's existing specialist-audit price. Used as the placeholder for all
// eight until the client supplies per-service pricing.
export const COMPLIANCE_PRICE = 1999;

export const COMPLIANCE_SERVICES = {
  soc: {
    id: 'soc',
    slug: 'soc',
    code: 'SOC',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.socTitle',
    descKey: 'compliance.socDesc',
    accent: '#1F5FA9',
    regulator: 'AICPA — SOC for Service Organizations',
  },
  gdpr: {
    id: 'gdpr',
    slug: 'gdpr',
    code: 'GDPR',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.gdprTitle',
    descKey: 'compliance.gdprDesc',
    accent: '#003399',
    regulator: 'EU General Data Protection Regulation (GDPR)',
  },
  'pci-dss': {
    id: 'pci-dss',
    slug: 'pci-dss',
    code: 'PCI DSS',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.pciTitle',
    descKey: 'compliance.pciDesc',
    accent: '#14657D',
    regulator: 'PCI Security Standards Council',
  },
  'ccpa-cpra': {
    id: 'ccpa-cpra',
    slug: 'ccpa-cpra',
    code: 'CCPA / CPRA',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.ccpaTitle',
    descKey: 'compliance.ccpaDesc',
    accent: '#5B6BE0',
    regulator: 'CCPA / CPRA (State of California)',
  },
  hitrust: {
    id: 'hitrust',
    slug: 'hitrust',
    code: 'HITRUST',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.hitrustTitle',
    descKey: 'compliance.hitrustDesc',
    accent: '#7A2230',
    regulator: 'HITRUST Alliance',
  },
  hipaa: {
    id: 'hipaa',
    slug: 'hipaa',
    code: 'HIPAA / HITECH',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.hipaaTitle',
    descKey: 'compliance.hipaaDesc',
    accent: '#1F2937',
    regulator: 'HIPAA / HITECH (US Dept. of Health & Human Services)',
  },
  'penetration-testing': {
    id: 'penetration-testing',
    slug: 'penetration-testing',
    code: 'PEN TEST',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.pentestTitle',
    descKey: 'compliance.pentestDesc',
    accent: '#1F2937',
    regulator: 'Vulnerability & Penetration Testing',
  },
  'sox-itgc': {
    id: 'sox-itgc',
    slug: 'sox-itgc',
    code: 'SOX ITGC',
    price: COMPLIANCE_PRICE,
    titleKey: 'compliance.soxTitle',
    descKey: 'compliance.soxDesc',
    accent: '#78BE20',
    regulator: 'Sarbanes-Oxley Act (SOX)',
  },
};

// Order matters — it is the order the client approved, reading left to right.
export const COMPLIANCE_SERVICE_LIST = Object.values(COMPLIANCE_SERVICES);

export function getComplianceBySlug(slug) {
  return (slug && COMPLIANCE_SERVICES[slug]) || null;
}

// Resolve a service from either its slug ('sox-itgc') or its stored display
// code ('SOX ITGC'). Both forms occur: the slug travels in the ?iso= URL
// parameter, and the code is what lands in applications.recommended_iso — which
// is the value api/checkout.js re-prices the order from. If only the slug
// resolved, a paid compliance order would be re-priced as an unknown standard
// on every later call.
export function resolveComplianceService(input) {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (COMPLIANCE_SERVICES[trimmed]) return COMPLIANCE_SERVICES[trimmed];
  const upper = trimmed.toUpperCase();
  return COMPLIANCE_SERVICE_LIST.find(s => s.code.toUpperCase() === upper) || null;
}

// True when a slug/code names a compliance audit rather than an ISO standard.
export function isComplianceStandard(input) {
  return resolveComplianceService(input) !== null;
}
