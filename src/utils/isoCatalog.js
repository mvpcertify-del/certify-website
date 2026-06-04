// ============================================
// Certify.cx — ISO Certification Catalog
// ============================================
// Used by:
//  - Public landing page (clickable ISO standard cards)
//  - Public ISO landing page (/iso/:slug)
//  - Super Admin "Shareable Links" page (one card per ISO)
//
// Each entry's `slug` is the public URL slug used in /iso/:slug.

export const ISO_CATALOG = {
  'iso-9001': {
    slug: 'iso-9001',
    code: 'ISO 9001',
    titleKey: 'iso.iso9001Title',
    descKey: 'iso.iso9001Desc',
    icon: 'Award',
    color: '#3ECF8E',
  },
  'iso-14001': {
    slug: 'iso-14001',
    code: 'ISO 14001',
    titleKey: 'iso.iso14001Title',
    descKey: 'iso.iso14001Desc',
    icon: 'Globe2',
    color: '#3ECF8E',
  },
  'iso-45001': {
    slug: 'iso-45001',
    code: 'ISO 45001',
    titleKey: 'iso.iso45001Title',
    descKey: 'iso.iso45001Desc',
    icon: 'Shield',
    color: '#3ECF8E',
  },
  'iso-22000': {
    slug: 'iso-22000',
    code: 'ISO 22000',
    titleKey: 'iso.iso22000Title',
    descKey: 'iso.iso22000Desc',
    icon: 'Apple',
    color: '#3ECF8E',
  },
  'iso-21001': {
    slug: 'iso-21001',
    code: 'ISO 21001',
    titleKey: 'iso.iso21001Title',
    descKey: 'iso.iso21001Desc',
    icon: 'GraduationCap',
    color: '#3ECF8E',
  },
  'iso-iec-27001': {
    slug: 'iso-iec-27001',
    code: 'ISO/IEC 27001',
    titleKey: 'iso.iso27001Title',
    descKey: 'iso.iso27001Desc',
    icon: 'Lock',
    color: '#3ECF8E',
  },
  'iso-iec-27701': {
    slug: 'iso-iec-27701',
    code: 'ISO/IEC 27701',
    titleKey: 'iso.iso27701Title',
    descKey: 'iso.iso27701Desc',
    icon: 'ShieldCheck',
    color: '#3ECF8E',
  },
  'iso-iec-42001': {
    slug: 'iso-iec-42001',
    code: 'ISO/IEC 42001',
    titleKey: 'iso.iso42001Title',
    descKey: 'iso.iso42001Desc',
    icon: 'BrainCircuit',
    color: '#3ECF8E',
  },
  'iso-50001': {
    slug: 'iso-50001',
    code: 'ISO 50001',
    titleKey: 'iso.iso50001Title',
    descKey: 'iso.iso50001Desc',
    icon: 'Zap',
    color: '#3ECF8E',
  },
  'iso-37001': {
    slug: 'iso-37001',
    code: 'ISO 37001',
    titleKey: 'iso.iso37001Title',
    descKey: 'iso.iso37001Desc',
    icon: 'Scale',
    color: '#3ECF8E',
  },
  'iso-22301': {
    slug: 'iso-22301',
    code: 'ISO 22301',
    titleKey: 'iso.iso22301Title',
    descKey: 'iso.iso22301Desc',
    icon: 'Activity',
    color: '#3ECF8E',
  },
  'iso-13485': {
    slug: 'iso-13485',
    code: 'ISO 13485',
    titleKey: 'iso.iso13485Title',
    descKey: 'iso.iso13485Desc',
    icon: 'Stethoscope',
    color: '#3ECF8E',
  },
};

export const ISO_CATALOG_LIST = Object.values(ISO_CATALOG);

export function getIsoBySlug(slug) {
  return ISO_CATALOG[slug] || null;
}

export function getIsoByCode(code) {
  if (!code) return null;
  const normalized = code.trim().toUpperCase();
  return ISO_CATALOG_LIST.find(i => i.code.toUpperCase() === normalized) || null;
}
