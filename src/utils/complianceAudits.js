// ============================================
// Certify.cx — Compliance Audit Catalog
// ============================================
// The eight non-ISO compliance audit services, shown in their own
// "Compliance Audits" section directly below the ISO standards on:
//  - the public landing page (/)
//  - the public certifications listing (/certifications)
//
// Deliberately a separate catalog from ISO_CATALOG rather than extra entries
// inside it. These are advisory/audit engagements, not accredited ISO
// certifications: they have no /iso/:slug page, no price in utils/pricing.js
// and no checkout SKU. Adding them to ISO_CATALOG would have put them into the
// checkout standard picker, the application form and the auditor's standard
// list, where they would be sold with an ISO price and no way to deliver them.
//
// So there is no `slug`-based route here on purpose — `id` is a stable key for
// React lists and for whatever enquiry flow these gain later.
//
// `logo.lines` / `logo.color` drive <ComplianceLogo>, which draws an ORIGINAL
// wordmark badge. These are not the official AICPA / PCI SSC / HITRUST / HHS
// marks — see the note at the top of components/ui/ComplianceLogo.jsx for why.
// Colours are chosen to echo each framework's usual palette while staying
// legible against white text (all are AA or better at this text size).

export const COMPLIANCE_AUDITS = {
  soc: {
    id: 'soc',
    titleKey: 'compliance.socTitle',
    descKey: 'compliance.socDesc',
    logo: { lines: ['SOC'], color: '#1F5FA9' },
  },
  gdpr: {
    id: 'gdpr',
    titleKey: 'compliance.gdprTitle',
    descKey: 'compliance.gdprDesc',
    logo: { lines: ['GDPR'], color: '#003399' },
  },
  'pci-dss': {
    id: 'pci-dss',
    titleKey: 'compliance.pciTitle',
    descKey: 'compliance.pciDesc',
    logo: { lines: ['PCI', 'DSS'], color: '#14657D' },
  },
  'ccpa-cpra': {
    id: 'ccpa-cpra',
    titleKey: 'compliance.ccpaTitle',
    descKey: 'compliance.ccpaDesc',
    logo: { lines: ['CCPA', 'CPRA'], color: '#A3242C' },
  },
  hitrust: {
    id: 'hitrust',
    titleKey: 'compliance.hitrustTitle',
    descKey: 'compliance.hitrustDesc',
    logo: { lines: ['HITRUST'], color: '#7A2230' },
  },
  hipaa: {
    id: 'hipaa',
    titleKey: 'compliance.hipaaTitle',
    descKey: 'compliance.hipaaDesc',
    logo: { lines: ['HIPAA'], color: '#005EA2' },
  },
  'penetration-testing': {
    id: 'penetration-testing',
    titleKey: 'compliance.pentestTitle',
    descKey: 'compliance.pentestDesc',
    logo: { lines: ['PEN', 'TEST'], color: '#5B3BA6' },
  },
  'sox-itgc': {
    id: 'sox-itgc',
    titleKey: 'compliance.soxTitle',
    descKey: 'compliance.soxDesc',
    logo: { lines: ['SOX'], color: '#0F6B5C' },
  },
};

// Order matters — it is the order the client approved, reading left to right.
export const COMPLIANCE_AUDIT_LIST = Object.values(COMPLIANCE_AUDITS);

export function getComplianceAuditById(id) {
  return COMPLIANCE_AUDITS[id] || null;
}
