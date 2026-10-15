// ============================================
// Certify.cx — Compliance Audit catalog (UI)
// ============================================
// The eight compliance audit services WITH their logos, for use by React
// components only:
//  - the public landing page (/)
//  - the public certifications listing (/certifications)
//  - the service page (/compliance/:slug)
//
// The service data itself — id, slug, code, price, text keys — lives in
// utils/complianceServices.js, which imports no images. That split is load
// bearing: utils/pricing.js prices these services and is imported by
// api/checkout.js, which runs in Node, and Node cannot import a .png. Import
// THIS file from components; import complianceServices.js from anything that
// might run server-side.
//
// The logos are the frameworks' own marks, matching the reference site the
// client asked us to follow (kaleshaco.com/services). They are bundled rather
// than hot-linked so the cards do not break when that site reorganises its
// assets, and so Vite fingerprints and caches them like any other image.
//
// They arrived as white-background JPEGs and were re-cut on 22 Aug at the
// client's request: the white AROUND each mark is now transparent, so no white
// plate sits behind the logo on the dark theme. See ComplianceLogo.css for how
// the dark marks stay legible without one.
//
// NOTE: these are third-party trademarks (AICPA, PCI SSC, HITRUST Alliance,
// HHS and others). Several may only be displayed by a firm the owning body has
// licensed or accredited. Displaying them is the client's decision, taken
// knowingly; `regulator` records who owns each mark so that is easy to audit.

import { COMPLIANCE_SERVICES, getComplianceBySlug } from './complianceServices.js';

import socLogo from '../assets/compliance/soc.png';
import gdprLogo from '../assets/compliance/gdpr.png';
import pciLogo from '../assets/compliance/pci-dss.png';
import ccpaLogo from '../assets/compliance/ccpa-cpra.png';
import hitrustLogo from '../assets/compliance/hitrust.png';
import hipaaLogo from '../assets/compliance/hipaa.png';

// GMP and CE (replaced Penetration Testing / SOX ITGC, client 15 Oct) have no
// logo asset yet — ComplianceLogo renders nothing when `logo` is null/absent,
// same fallback every other service without a mark already uses.
const LOGOS = {
  soc: socLogo,
  gdpr: gdprLogo,
  'pci-dss': pciLogo,
  'ccpa-cpra': ccpaLogo,
  hitrust: hitrustLogo,
  hipaa: hipaaLogo,
};

export const COMPLIANCE_AUDITS = Object.fromEntries(
  Object.entries(COMPLIANCE_SERVICES).map(([id, service]) => [
    id,
    { ...service, logo: LOGOS[id] || null },
  ])
);

// Order matters — it is the order the client approved, reading left to right.
export const COMPLIANCE_AUDIT_LIST = Object.values(COMPLIANCE_AUDITS);

export function getComplianceAuditById(id) {
  return COMPLIANCE_AUDITS[id] || null;
}

// Same lookup by URL slug, for /compliance/:slug. Slug and id are the same
// string; both names exist so call sites read the way they mean.
export function getComplianceAuditBySlug(slug) {
  return getComplianceBySlug(slug) ? COMPLIANCE_AUDITS[slug] : null;
}
