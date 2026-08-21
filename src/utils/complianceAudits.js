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
// `logo` is the framework's own mark, matching the reference site the client
// asked us to follow (kaleshaco.com/services). They are imported rather than
// hot-linked so the cards do not break when that site reorganises its assets,
// and so Vite fingerprints and caches them like any other bundled image.
//
// NOTE: these are third-party trademarks (AICPA, PCI SSC, HITRUST Alliance,
// HHS and others). Several may only be displayed by a firm the owning body has
// licensed or accredited. Displaying them is the client's decision, taken
// knowingly; `regulator` records who owns each mark so that is easy to audit.
//
// All eight are JPEGs with a solid white background, not transparent PNGs, so
// they are rendered on a white tile — see components/ui/ComplianceLogo.jsx.

import socLogo from '../assets/compliance/soc.jpg';
import gdprLogo from '../assets/compliance/gdpr.jpg';
import pciLogo from '../assets/compliance/pci-dss.jpg';
import ccpaLogo from '../assets/compliance/ccpa-cpra.jpg';
import hitrustLogo from '../assets/compliance/hitrust.jpg';
import hipaaLogo from '../assets/compliance/hipaa.jpg';
import pentestLogo from '../assets/compliance/pentesting.jpg';
import soxLogo from '../assets/compliance/sox.jpg';

export const COMPLIANCE_AUDITS = {
  soc: {
    id: 'soc',
    titleKey: 'compliance.socTitle',
    descKey: 'compliance.socDesc',
    logo: socLogo,
    accent: '#1F5FA9',
    regulator: 'AICPA — SOC for Service Organizations',
  },
  gdpr: {
    id: 'gdpr',
    titleKey: 'compliance.gdprTitle',
    descKey: 'compliance.gdprDesc',
    logo: gdprLogo,
    accent: '#003399',
    regulator: 'EU General Data Protection Regulation (GDPR)',
  },
  'pci-dss': {
    id: 'pci-dss',
    titleKey: 'compliance.pciTitle',
    descKey: 'compliance.pciDesc',
    logo: pciLogo,
    accent: '#14657D',
    regulator: 'PCI Security Standards Council',
  },
  'ccpa-cpra': {
    id: 'ccpa-cpra',
    titleKey: 'compliance.ccpaTitle',
    descKey: 'compliance.ccpaDesc',
    logo: ccpaLogo,
    accent: '#5B6BE0',
    regulator: 'CCPA / CPRA (State of California)',
  },
  hitrust: {
    id: 'hitrust',
    titleKey: 'compliance.hitrustTitle',
    descKey: 'compliance.hitrustDesc',
    logo: hitrustLogo,
    accent: '#7A2230',
    regulator: 'HITRUST Alliance',
  },
  hipaa: {
    id: 'hipaa',
    titleKey: 'compliance.hipaaTitle',
    descKey: 'compliance.hipaaDesc',
    logo: hipaaLogo,
    accent: '#1F2937',
    regulator: 'HIPAA / HITECH (US Dept. of Health & Human Services)',
  },
  'penetration-testing': {
    id: 'penetration-testing',
    titleKey: 'compliance.pentestTitle',
    descKey: 'compliance.pentestDesc',
    logo: pentestLogo,
    accent: '#1F2937',
    regulator: 'Vulnerability & Penetration Testing',
  },
  'sox-itgc': {
    id: 'sox-itgc',
    titleKey: 'compliance.soxTitle',
    descKey: 'compliance.soxDesc',
    logo: soxLogo,
    accent: '#78BE20',
    regulator: 'Sarbanes-Oxley Act (SOX)',
  },
};

// Order matters — it is the order the client approved, reading left to right.
export const COMPLIANCE_AUDIT_LIST = Object.values(COMPLIANCE_AUDITS);

export function getComplianceAuditById(id) {
  return COMPLIANCE_AUDITS[id] || null;
}
