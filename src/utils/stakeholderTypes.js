// ============================================
// Certify.cx — Shareable Links: Stakeholder Types
// ============================================
// The user-facing copy for each type — title, description, benefits and rules —
// is NOT stored here. It lives in src/i18n/locales/*.json under `stakeholder.*`
// and is read through `t()` by the pages below.
//
// It used to be English literals in this file, which meant an Arabic visitor to
// /register/referral, the sign-up wizard, and the Shareable Links page saw an
// Arabic shell wrapped around English cards (client, 1 Sep: "In the Arabic
// version, all information should be displayed in Arabic"). A catalog in
// src/utils cannot call `t()`, so it carries key names and the component
// resolves them — the same arrangement isoCatalog.js already uses.
//
// Read the copy with getStakeholderCopy(config, t) rather than reaching for the
// keys by hand; it also handles the benefits/rules arrays.

export const STAKEHOLDER_TYPES = {
  'certification-body': {
    id: 'certification-body',
    i18nKey: 'certificationBody',
    role: 'certification_body',
    icon: 'Award',
    color: '#8B5CF6',
  },
  'consultancy': {
    id: 'consultancy',
    i18nKey: 'consultancy',
    // A consultancy brings clients to the platform and earns on them — the same
    // SCREENS as a referral partner, but not the same thing. It carries its own
    // commission rate (25% of net), a monthly KPI, and a signed 12-month
    // contract, so it needs to be countable and governable on its own.
    // Client instruction, 19 Jul: "the same process features as
    // Referral/Affiliate"; 21 Jul: "Do not classify as referral."
    // Phase 19 briefly parked this on 'referral'; phase 22 moves it to its own
    // role. `stakeholder_type` stays 'consultancy' either way.
    role: 'consultancy',
    icon: 'Briefcase',
    color: '#F59E0B',
  },
  'referral': {
    id: 'referral',
    i18nKey: 'referral',
    role: 'referral',
    icon: 'Gift',
    color: '#EC4899',
  },
  'client': {
    id: 'client',
    i18nKey: 'client',
    role: 'client',
    icon: 'Building2',
    color: '#10B981',
  },
  'auditor': {
    id: 'auditor',
    i18nKey: 'auditor',
    role: 'auditor',
    icon: 'UserCheck',
    color: '#3B82F6',
  },
  'investor': {
    id: 'investor',
    i18nKey: 'investor',
    role: 'client',
    icon: 'TrendingUp',
    color: '#6366F1',
  },
};

/** Get a stakeholder type config by its slug */
export function getStakeholderType(slug) {
  return STAKEHOLDER_TYPES[slug] || null;
}

/** Get all stakeholder type slugs */
export function getStakeholderSlugs() {
  return Object.keys(STAKEHOLDER_TYPES);
}

/**
 * Resolve a type's translated copy. `t` comes from the calling component's
 * useTranslation().
 *
 * `benefits` and `rules` are arrays in the locale files, so they are read with
 * returnObjects. If a locale is missing the array i18next hands back the key
 * string instead — the Array.isArray guard turns that into an empty list, so a
 * half-translated locale renders a short section rather than the literal text
 * "stakeholder.referral.benefits" as a bullet.
 */
export function getStakeholderCopy(config, t) {
  if (!config) return null;
  const base = `stakeholder.${config.i18nKey}`;
  const list = (name) => {
    const v = t(`${base}.${name}`, { returnObjects: true });
    return Array.isArray(v) ? v : [];
  };
  return {
    title: t(`${base}.title`),
    singularTitle: t(`${base}.singular`),
    description: t(`${base}.desc`),
    benefits: list('benefits'),
    rules: list('rules'),
  };
}

/** Translated label for the platform role a type maps onto ("Role: Auditor"). */
export function getStakeholderRoleLabel(config, t) {
  const map = {
    super_admin: 'roles.superAdmin',
    regional_admin: 'roles.regionalAdmin',
    auditor: 'roles.auditor',
    certification_body: 'roles.certificationBody',
    client: 'roles.client',
    referral: 'roles.referral',
    consultancy: 'roles.consultancy',
  };
  const key = map[config?.role];
  return key ? t(key) : (config?.role || '');
}
