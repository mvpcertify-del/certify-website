// ============================================
// Certify.cx — RBAC: Roles, Regions & Permissions
// ============================================

// ---------------------------------------------------
// Roles
// ---------------------------------------------------
export const ROLES = {
  SUPER_ADMIN: 'super_admin',
  REGIONAL_ADMIN: 'regional_admin',
  AUDITOR: 'auditor',
  CERTIFICATION_BODY: 'certification_body',
  CLIENT: 'client',
  // Referral partner — an individual who refers clients and earns commission.
  // Promoted from a `client` stakeholder_type to a first-class role in phase 14.
  REFERRAL: 'referral',
};

export const ROLE_LABELS = {
  [ROLES.SUPER_ADMIN]: 'Super Admin',
  [ROLES.REGIONAL_ADMIN]: 'Regional Admin',
  [ROLES.AUDITOR]: 'Auditor',
  [ROLES.CERTIFICATION_BODY]: 'Certification Body',
  [ROLES.CLIENT]: 'Client',
  [ROLES.REFERRAL]: 'Referral',
};

/** Ordered by privilege level (highest first) */
export const ROLE_HIERARCHY = [
  ROLES.SUPER_ADMIN,
  ROLES.REGIONAL_ADMIN,
  ROLES.CERTIFICATION_BODY,
  ROLES.AUDITOR,
  ROLES.CLIENT,
  ROLES.REFERRAL,
];

// ---------------------------------------------------
// Regions
// ---------------------------------------------------
export const REGIONS = [
  { id: 'asia', label: 'Asia', emoji: '🌏' },
  { id: 'africa', label: 'Africa', emoji: '🌍' },
  { id: 'europe', label: 'Europe', emoji: '🇪🇺' },
  { id: 'north_america', label: 'North America', emoji: '🌎' },
  { id: 'south_america', label: 'South America', emoji: '🌎' },
];

export function getRegionLabel(regionId) {
  return REGIONS.find(r => r.id === regionId)?.label || regionId;
}

/**
 * Map a country name (from Geoapify or user input) to a region ID.
 * Returns null if no match is found.
 */
const COUNTRY_REGION_MAP = {
  // Asia
  'india': 'asia',
  'china': 'asia',
  'japan': 'asia',
  'south korea': 'asia',
  'singapore': 'asia',
  'malaysia': 'asia',
  'indonesia': 'asia',
  'thailand': 'asia',
  'vietnam': 'asia',
  'philippines': 'asia',
  'pakistan': 'asia',
  'bangladesh': 'asia',
  'sri lanka': 'asia',
  'nepal': 'asia',
  'myanmar': 'asia',
  'cambodia': 'asia',
  'laos': 'asia',
  'mongolia': 'asia',
  'hong kong': 'asia',
  'taiwan': 'asia',
  'australia': 'asia',
  'new zealand': 'asia',
  'saudi arabia': 'asia',
  'ksa': 'asia',
  'united arab emirates': 'asia',
  'uae': 'asia',
  'qatar': 'asia',
  'kuwait': 'asia',
  'bahrain': 'asia',
  'oman': 'asia',
  'jordan': 'asia',
  'lebanon': 'asia',
  'iraq': 'asia',
  'iran': 'asia',
  'yemen': 'asia',
  'syria': 'asia',
  'palestine': 'asia',
  'israel': 'asia',
  'turkey': 'asia',
  'afghanistan': 'asia',
  'uzbekistan': 'asia',
  'kazakhstan': 'asia',
  'turkmenistan': 'asia',
  'tajikistan': 'asia',
  'kyrgyzstan': 'asia',
  'armenia': 'asia',
  'georgia': 'asia',
  'azerbaijan': 'asia',
  'brunei': 'asia',
  'east timor': 'asia',
  'maldives': 'asia',
  'bhutan': 'asia',

  // Africa
  'egypt': 'africa',
  'south africa': 'africa',
  'nigeria': 'africa',
  'kenya': 'africa',
  'ghana': 'africa',
  'ethiopia': 'africa',
  'tanzania': 'africa',
  'uganda': 'africa',
  'rwanda': 'africa',
  'morocco': 'africa',
  'tunisia': 'africa',
  'algeria': 'africa',
  'libya': 'africa',
  'sudan': 'africa',
  'south sudan': 'africa',
  'cameroon': 'africa',
  'ivory coast': 'africa',
  'senegal': 'africa',
  'mali': 'africa',
  'burkina faso': 'africa',
  'niger': 'africa',
  'chad': 'africa',
  'democratic republic of the congo': 'africa',
  'republic of the congo': 'africa',
  'angola': 'africa',
  'mozambique': 'africa',
  'zimbabwe': 'africa',
  'zambia': 'africa',
  'botswana': 'africa',
  'namibia': 'africa',
  'madagascar': 'africa',
  'mauritius': 'africa',
  'somalia': 'africa',
  'eritrea': 'africa',
  'djibouti': 'africa',
  'gabon': 'africa',
  'togo': 'africa',
  'benin': 'africa',
  'sierra leone': 'africa',
  'liberia': 'africa',
  'guinea': 'africa',
  'gambia': 'africa',
  'malawi': 'africa',
  'lesotho': 'africa',
  'eswatini': 'africa',
  'equatorial guinea': 'africa',
  'cape verde': 'africa',
  'comoros': 'africa',
  'seychelles': 'africa',
  'sao tome and principe': 'africa',
  'central african republic': 'africa',
  'burundi': 'africa',

  // Europe
  'united kingdom': 'europe',
  'uk': 'europe',
  'france': 'europe',
  'germany': 'europe',
  'italy': 'europe',
  'spain': 'europe',
  'netherlands': 'europe',
  'belgium': 'europe',
  'switzerland': 'europe',
  'austria': 'europe',
  'sweden': 'europe',
  'norway': 'europe',
  'denmark': 'europe',
  'finland': 'europe',
  'ireland': 'europe',
  'portugal': 'europe',
  'poland': 'europe',
  'czech republic': 'europe',
  'czechia': 'europe',
  'greece': 'europe',
  'romania': 'europe',
  'hungary': 'europe',
  'russia': 'europe',
  'ukraine': 'europe',
  'croatia': 'europe',
  'serbia': 'europe',
  'bulgaria': 'europe',
  'slovakia': 'europe',
  'slovenia': 'europe',
  'lithuania': 'europe',
  'latvia': 'europe',
  'estonia': 'europe',
  'luxembourg': 'europe',
  'malta': 'europe',
  'cyprus': 'europe',
  'iceland': 'europe',
  'albania': 'europe',
  'north macedonia': 'europe',
  'montenegro': 'europe',
  'bosnia and herzegovina': 'europe',
  'moldova': 'europe',
  'belarus': 'europe',
  'kosovo': 'europe',
  'liechtenstein': 'europe',
  'monaco': 'europe',
  'andorra': 'europe',
  'san marino': 'europe',

  // North America
  'united states': 'north_america',
  'united states of america': 'north_america',
  'usa': 'north_america',
  'canada': 'north_america',
  'mexico': 'north_america',
  'guatemala': 'north_america',
  'honduras': 'north_america',
  'el salvador': 'north_america',
  'nicaragua': 'north_america',
  'costa rica': 'north_america',
  'panama': 'north_america',
  'belize': 'north_america',
  'cuba': 'north_america',
  'haiti': 'north_america',
  'dominican republic': 'north_america',
  'jamaica': 'north_america',
  'trinidad and tobago': 'north_america',
  'bahamas': 'north_america',
  'barbados': 'north_america',
  'puerto rico': 'north_america',

  // South America
  'brazil': 'south_america',
  'argentina': 'south_america',
  'colombia': 'south_america',
  'chile': 'south_america',
  'peru': 'south_america',
  'venezuela': 'south_america',
  'ecuador': 'south_america',
  'bolivia': 'south_america',
  'paraguay': 'south_america',
  'uruguay': 'south_america',
  'guyana': 'south_america',
  'suriname': 'south_america',
  'french guiana': 'south_america',
};

export function getRegionFromCountry(country) {
  if (!country) return null;
  return COUNTRY_REGION_MAP[country.toLowerCase().trim()] || null;
}

/**
 * Async version — checks the `countries` DB table first (so admin-managed
 * country→region links win), then falls back to the static map.
 *
 * Pass a configured Supabase client. Returns null if no match found anywhere.
 */
export async function getRegionFromCountryAsync(country, supabase) {
  if (!country) return null;
  const name = country.trim();

  if (supabase) {
    try {
      const { data } = await supabase
        .from('countries')
        .select('region_id')
        .ilike('name', name)
        .maybeSingle();
      if (data?.region_id) return data.region_id;
    } catch {
      // fall through to static map
    }
  }

  return COUNTRY_REGION_MAP[name.toLowerCase()] || null;
}

// ---------------------------------------------------
// Certification Lifecycle Statuses
// ---------------------------------------------------
export const CERTIFICATION_STATUSES = {
  PENDING: 'pending',
  AUDIT_SCHEDULED: 'audit_scheduled',
  IN_REVIEW: 'in_review',
  APPROVED: 'approved',
  REJECTED: 'rejected',
};

export const CERTIFICATION_STATUS_ORDER = [
  CERTIFICATION_STATUSES.PENDING,
  CERTIFICATION_STATUSES.AUDIT_SCHEDULED,
  CERTIFICATION_STATUSES.IN_REVIEW,
  CERTIFICATION_STATUSES.APPROVED,
  CERTIFICATION_STATUSES.REJECTED,
];

// ---------------------------------------------------
// Granular Permissions
// ---------------------------------------------------
export const PERMISSIONS = {
  // Dashboard
  VIEW_DASHBOARD: 'view_dashboard',

  // Companies
  VIEW_COMPANIES: 'view_companies',
  MANAGE_COMPANIES: 'manage_companies',
  REGISTER_COMPANY: 'register_company',

  // Certification Requests
  VIEW_CERTIFICATIONS: 'view_certifications',
  VIEW_ALL_CERTIFICATIONS: 'view_all_certifications',
  CREATE_CERTIFICATION: 'create_certification',
  MANAGE_CERTIFICATIONS: 'manage_certifications',
  APPROVE_CERTIFICATIONS: 'approve_certifications',
  VIEW_CERTIFICATION_STATUS: 'view_certification_status',

  // Auditors
  VIEW_AUDITORS: 'view_auditors',
  MANAGE_AUDITORS: 'manage_auditors',
  ASSIGN_AUDITORS: 'assign_auditors',
  SUBMIT_AUDIT_REPORT: 'submit_audit_report',

  // Certification Bodies
  VIEW_BODIES: 'view_bodies',
  MANAGE_BODIES: 'manage_bodies',
  REVIEW_AUDIT_REPORTS: 'review_audit_reports',

  // Reports
  VIEW_REPORTS: 'view_reports',
  EXPORT_REPORTS: 'export_reports',

  // Referrals — referral partner's own dashboard (refer clients, track commission)
  VIEW_REFERRALS: 'view_referrals',

  // Users & Settings
  MANAGE_USERS: 'manage_users',
  MANAGE_SETTINGS: 'manage_settings',
  MANAGE_REGIONS: 'manage_regions',
  MANAGE_ROLES: 'manage_roles',
  CREATE_ADMINS: 'create_admins',
};

// ---------------------------------------------------
// Role → Permission Mapping
// ---------------------------------------------------
const ROLE_PERMISSIONS = {
  // ---- Super Admin: explicit full access (no CREATE_CERTIFICATION) ----
  [ROLES.SUPER_ADMIN]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COMPANIES,
    PERMISSIONS.MANAGE_COMPANIES,
    PERMISSIONS.REGISTER_COMPANY,
    PERMISSIONS.VIEW_CERTIFICATIONS,
    PERMISSIONS.VIEW_ALL_CERTIFICATIONS,
    PERMISSIONS.MANAGE_CERTIFICATIONS,
    PERMISSIONS.APPROVE_CERTIFICATIONS,
    PERMISSIONS.VIEW_CERTIFICATION_STATUS,
    PERMISSIONS.VIEW_AUDITORS,
    PERMISSIONS.MANAGE_AUDITORS,
    PERMISSIONS.ASSIGN_AUDITORS,
    PERMISSIONS.SUBMIT_AUDIT_REPORT,
    PERMISSIONS.VIEW_BODIES,
    PERMISSIONS.MANAGE_BODIES,
    PERMISSIONS.REVIEW_AUDIT_REPORTS,
    PERMISSIONS.VIEW_REPORTS,
    PERMISSIONS.EXPORT_REPORTS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.MANAGE_REGIONS,
    PERMISSIONS.MANAGE_ROLES,
    PERMISSIONS.CREATE_ADMINS,
    PERMISSIONS.VIEW_REFERRALS,
  ],

  // ---- Regional Admin ----
  [ROLES.REGIONAL_ADMIN]: [
    PERMISSIONS.VIEW_DASHBOARD,
    // Companies — manage in own region
    PERMISSIONS.VIEW_COMPANIES,
    PERMISSIONS.MANAGE_COMPANIES,
    // Certifications — manage requests, view (no CREATE_CERTIFICATION)
    PERMISSIONS.VIEW_CERTIFICATIONS,
    PERMISSIONS.VIEW_ALL_CERTIFICATIONS,
    PERMISSIONS.MANAGE_CERTIFICATIONS,
    PERMISSIONS.VIEW_CERTIFICATION_STATUS,
    // Auditors — create & assign auditors in region
    PERMISSIONS.VIEW_AUDITORS,
    PERMISSIONS.MANAGE_AUDITORS,
    PERMISSIONS.ASSIGN_AUDITORS,
    // Bodies — create & manage in region
    PERMISSIONS.VIEW_BODIES,
    PERMISSIONS.MANAGE_BODIES,
    // Reports
    PERMISSIONS.VIEW_REPORTS,
    // Users & Settings
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_SETTINGS,
  ],

  // ---- Auditor ----
  [ROLES.AUDITOR]: [
    PERMISSIONS.VIEW_DASHBOARD,
    // Certifications — view + submit audit reports
    PERMISSIONS.VIEW_CERTIFICATIONS,
    PERMISSIONS.VIEW_CERTIFICATION_STATUS,
    PERMISSIONS.SUBMIT_AUDIT_REPORT,
    // Settings (own profile)
    PERMISSIONS.MANAGE_SETTINGS,
  ],

  // ---- Certification Body ----
  [ROLES.CERTIFICATION_BODY]: [
    PERMISSIONS.VIEW_DASHBOARD,
    // Certifications — review + approve
    PERMISSIONS.VIEW_CERTIFICATIONS,
    PERMISSIONS.VIEW_CERTIFICATION_STATUS,
    PERMISSIONS.REVIEW_AUDIT_REPORTS,
    PERMISSIONS.APPROVE_CERTIFICATIONS,
    // Settings (own profile)
    PERMISSIONS.MANAGE_SETTINGS,
  ],

  // ---- Client (Company) ----
  [ROLES.CLIENT]: [
    PERMISSIONS.VIEW_DASHBOARD,
    // Certifications — create requests + view status
    PERMISSIONS.CREATE_CERTIFICATION,
    PERMISSIONS.VIEW_CERTIFICATION_STATUS,
    // Settings (own profile)
    PERMISSIONS.MANAGE_SETTINGS,
  ],

  // ---- Referral Partner (individual) ----
  [ROLES.REFERRAL]: [
    PERMISSIONS.VIEW_DASHBOARD,
    // Own referral dashboard: refer clients + track commission
    PERMISSIONS.VIEW_REFERRALS,
    // Settings (own profile)
    PERMISSIONS.MANAGE_SETTINGS,
  ],
};

// ---------------------------------------------------
// Route → Required Permissions Mapping
// ---------------------------------------------------
export const ROUTE_PERMISSIONS = {
  '/dashboard': [PERMISSIONS.VIEW_DASHBOARD],
  '/companies': [PERMISSIONS.VIEW_COMPANIES, PERMISSIONS.REGISTER_COMPANY],
  '/certification-requests': [PERMISSIONS.VIEW_CERTIFICATIONS],
  '/auditors': [PERMISSIONS.VIEW_AUDITORS],
  '/certification-bodies': [PERMISSIONS.VIEW_BODIES],
  '/reports': [PERMISSIONS.VIEW_REPORTS],
  '/settings': [PERMISSIONS.MANAGE_SETTINGS],
};

// ---------------------------------------------------
// Custom Permission Overrides (runtime, set by super admin)
// ---------------------------------------------------
// Shape: { [role]: { [permission]: boolean } }
// - `true`  = grant (overrides a baseline deny)
// - `false` = revoke (overrides a baseline grant)
// - missing = fall through to baseline ROLE_PERMISSIONS
let CUSTOM_PERMISSION_OVERRIDES = {};

/**
 * Set the full override map. Called by AuthContext after fetching from DB.
 */
export function setCustomPermissionOverrides(overrides) {
  CUSTOM_PERMISSION_OVERRIDES = overrides || {};
}

export function getCustomPermissionOverrides() {
  return CUSTOM_PERMISSION_OVERRIDES;
}

// ---------------------------------------------------
// Helper Functions
// ---------------------------------------------------

/**
 * Check if a role has a specific permission.
 * Applies runtime overrides on top of the baseline ROLE_PERMISSIONS map.
 */
export function hasPermission(role, permission) {
  const override = CUSTOM_PERMISSION_OVERRIDES[role]?.[permission];
  if (typeof override === 'boolean') return override;
  const perms = ROLE_PERMISSIONS[role];
  return perms ? perms.includes(permission) : false;
}

/**
 * Check if a role has ANY of the given permissions.
 */
export function hasAnyPermission(role, permissions) {
  return permissions.some(p => hasPermission(role, p));
}

/**
 * Check if a role has ALL of the given permissions.
 */
export function hasAllPermissions(role, permissions) {
  return permissions.every(p => hasPermission(role, p));
}

/**
 * Get all effective permissions for a role (baseline ± overrides).
 */
export function getRolePermissions(role) {
  const baseline = new Set(ROLE_PERMISSIONS[role] || []);
  const overrides = CUSTOM_PERMISSION_OVERRIDES[role] || {};
  for (const [perm, enabled] of Object.entries(overrides)) {
    if (enabled) baseline.add(perm);
    else baseline.delete(perm);
  }
  return Array.from(baseline);
}

/**
 * Baseline (pre-override) permissions for a role. Used by the admin
 * override UI to show what's "default on" before any toggles.
 */
export function getBaselineRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Check if user can access a specific region's data.
 * Super admins can access all regions.
 * Other roles can only access their own region.
 */
export function canAccessRegion(userRole, userRegion, targetRegion) {
  if (userRole === ROLES.SUPER_ADMIN) return true;
  if (!targetRegion) return true; // no region restriction
  return userRegion === targetRegion;
}

/**
 * Check if a role can access a specific route.
 * Uses the ROUTE_PERMISSIONS map — user needs ANY of the listed permissions.
 */
export function canAccessRoute(role, path) {
  const required = ROUTE_PERMISSIONS[path];
  if (!required) return true; // no restriction defined
  return hasAnyPermission(role, required);
}

/**
 * Check if a role is at or above a given level in hierarchy.
 */
export function isRoleAtLeast(userRole, minimumRole) {
  const userIdx = ROLE_HIERARCHY.indexOf(userRole);
  const minIdx = ROLE_HIERARCHY.indexOf(minimumRole);
  if (userIdx === -1 || minIdx === -1) return false;
  return userIdx <= minIdx; // lower index = higher privilege
}

/**
 * Get accessible sidebar items for a role.
 */
export function getAccessibleRoutes(role) {
  return Object.entries(ROUTE_PERMISSIONS)
    .filter(([, perms]) => hasAnyPermission(role, perms))
    .map(([path]) => path);
}

/**
 * Get the roles that a given admin role can create.
 * Super Admin → Regional Admin, Auditor, Certification Body
 * Regional Admin → Auditor, Certification Body
 */
export function getCreatableRoles(role) {
  const map = {
    [ROLES.SUPER_ADMIN]: [ROLES.REGIONAL_ADMIN, ROLES.AUDITOR, ROLES.CERTIFICATION_BODY, ROLES.CLIENT, ROLES.REFERRAL],
    [ROLES.REGIONAL_ADMIN]: [ROLES.AUDITOR, ROLES.CERTIFICATION_BODY],
  };
  return map[role] || [];
}

// ---------------------------------------------------
// Display labels for client-role stakeholder variants
// ---------------------------------------------------
// Referral, Consultancy, and Investor users share the underlying `client` role
// but should NOT be shown as "Client" in user-facing surfaces (Profile/Settings,
// admin user list, etc). Map each stakeholder_type to its display label here.
export const STAKEHOLDER_DISPLAY_LABELS = {
  referral: 'Referral Partner',
  consultancy: 'Consultancy',
  investor: 'Investor',
};

/**
 * Returns the label to display for a user's role.
 * If the user is a `client` with a stakeholder_type that overrides the label
 * (referral / consultancy / investor), that label is used instead of "Client".
 *
 * @param {string} role - profiles.role (e.g. 'client', 'auditor')
 * @param {string} [stakeholderType] - profiles.stakeholder_type
 * @returns {string} the human-readable label
 */
export function getDisplayRoleLabel(role, stakeholderType) {
  if (role === ROLES.CLIENT && stakeholderType && STAKEHOLDER_DISPLAY_LABELS[stakeholderType]) {
    return STAKEHOLDER_DISPLAY_LABELS[stakeholderType];
  }
  return ROLE_LABELS[role] || role || '';
}
