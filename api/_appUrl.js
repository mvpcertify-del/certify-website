// Public base URL for links we put in transactional email and SMS.
//
// This is DELIBERATELY not `process.env.APP_PUBLIC_URL` (9 Aug). That variable
// is set to https://app.certify.cx in the deployment — a hostname that has no
// working DNS/TLS — so every link we mailed out landed on a browser security
// warning ("Your connection is not private", NET::ERR_CERT_AUTHORITY_INVALID)
// instead of the app. It broke the "Open dashboard" button in admin alerts, the
// welcome mail, certificate-issued mail, referral links, and the redirect
// target of the email-verification link itself. Verified 8 Aug: certify.cx
// serves the app (the same screenshots show the client using
// https://certify.cx/dashboard), app.certify.cx does not resolve.
//
// So the default here is the live site — a fact about the business, not about
// whichever host a given deployment happens to sit behind — and it can only be
// overridden by a variable set on purpose for that job. If the app ever really
// does move to another hostname, set APP_URL there; do not resurrect
// APP_PUBLIC_URL, whose value has been wrong in production for weeks.
const FALLBACK = 'https://certify.cx';

function normalize(value) {
  const raw = String(value || '').trim().replace(/\/+$/, '');
  // A bare host ("certify.cx") in an env var would otherwise produce a
  // protocol-relative link that no mail client can open.
  if (!raw) return FALLBACK;
  if (/^https?:\/\//i.test(raw)) return raw;
  return `https://${raw}`;
}

export const APP_URL = normalize(process.env.APP_URL || FALLBACK);

// Convenience for the link every one of these emails ends up carrying.
export const DASHBOARD_URL = `${APP_URL}/dashboard`;
