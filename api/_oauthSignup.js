// Sign-up through an identity provider (LinkedIn).
//
// The browser never chooses its own role. After the provider round-trip the page tells the API which
// registration door the person came through (the stakeholder slug); this module decides, on the
// server, what role that earns. Only the four registrations that need nothing beyond a name and an
// email can be completed this way. Auditors (qualification files) and contractors (documents and an
// agreement, then admin approval) must keep using their own wizard, so they are NOT in this table.

/** Supabase provider ids that may create their own profile. */
export const OAUTH_PROVIDERS = ['linkedin_oidc'];

/** registration slug -> profiles.role */
export const OAUTH_STAKEHOLDER_ROLES = {
  client: 'client',
  consultancy: 'consultancy',
  referral: 'referral',
  'certification-body': 'certification_body',
};

/**
 * The role a person may give themselves on first provider sign-in, or null when this is not that case.
 * Allowed only for: the person editing their own profile, signed in through an allowed provider with a
 * confirmed email, whose profile has no role yet, through one of the four registrations above.
 */
export function oauthBootstrapRole({ isSelf, provider, emailConfirmed, targetRole, stakeholderType }) {
  if (!isSelf || !emailConfirmed || targetRole) return null;
  if (!OAUTH_PROVIDERS.includes(provider)) return null;
  return Object.prototype.hasOwnProperty.call(OAUTH_STAKEHOLDER_ROLES, stakeholderType)
    ? OAUTH_STAKEHOLDER_ROLES[stakeholderType]
    : null;
}
