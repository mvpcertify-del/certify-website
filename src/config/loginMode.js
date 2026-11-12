// Login mode (client / boss, 12 Nov 2026): email one-time-code sign-in.
//
// When VITE_LOGIN_OTP_ENABLED is the string "true", people sign in with a
// six-digit code sent to their registered email instead of a password, and
// sign-up no longer asks for a password. The code is generated, expired,
// rate-limited and checked by Supabase Auth itself (signInWithOtp / verifyOtp);
// this app only asks for the address and then the code.
//
// Anything else (the default) keeps the password login. The switch is read at
// BUILD time, so turning it on or off is a Vercel environment change plus a
// redeploy. Google sign-in has been removed in both modes.

export const LOGIN_OTP_ENABLED = (import.meta.env || {}).VITE_LOGIN_OTP_ENABLED === 'true';

/** Length of the code Supabase sends (Auth > Providers > Email > OTP length). */
export const OTP_LENGTH = 6;

/** Seconds a person must wait before asking for another code. */
export const OTP_RESEND_SECONDS = 60;

/**
 * What a failed signInWithOtp() means for the page.
 *   rate_limited     a code was sent a moment ago; show the code box anyway
 *   unknown_account  no such address; treated as success so the page does not
 *                    reveal who has an account
 *   failed           anything else; ask the person to try again
 */
export function classifyOtpRequestError(error) {
  if (!error) return 'ok';
  const msg = String(error.message || '');
  if (error.status === 429 || /security purposes|rate limit|too many/i.test(msg)) return 'rate_limited';
  if (/signups? not allowed|user not found/i.test(msg)) return 'unknown_account';
  return 'failed';
}

/** Digits only, exactly OTP_LENGTH of them (spaces from copy-paste are ignored). */
export function normalizeOtp(input) {
  return String(input || '').replace(/\s+/g, '');
}

export function isValidOtp(input) {
  return new RegExp(`^\\d{${OTP_LENGTH}}$`).test(normalizeOtp(input));
}

/**
 * A throw-away password for accounts created in code-login mode. The signup API
 * still creates the Supabase user with a password; nobody ever needs to know it
 * because sign-in is by emailed code, so it is random and never shown or kept.
 */
export function randomPassword() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('') + 'Aa1!';
}
