// Shared helper: generate a Supabase verify link via the admin API and email
// it through Resend ourselves. Bypasses Supabase's GoTrue email rate limit
// (currently throttled to 2/h on this project after a historical bounce-rate
// flag — see plan Phase 6).
//
// Used by both /api/create-user (initial signup) and /api/resend-verification
// (manual resend when the first send failed).

import { verifyEmail } from './_emailTemplates.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || '';

/**
 * Generate a verify/magic link for `email` and email it via Resend.
 *
 * @param {object} args
 * @param {object} args.supabaseAdmin  Service-role Supabase client.
 * @param {string} args.email          User's email address.
 * @param {string} [args.password]     Required when type='signup' (initial
 *                                     create). Omit for resend where the
 *                                     user already exists.
 * @param {string} [args.name]         Display name (used in greeting).
 * @param {'signup'|'magiclink'} [args.linkType]  Defaults to 'signup' if a
 *   password is supplied, 'magiclink' otherwise. Use 'magiclink' for resend
 *   on an already-created (but unconfirmed) user.
 * @param {string} [args.redirectPath]  Path the verify link lands on after it
 *   confirms + signs the user in. Defaults to '/login'. Pass '/client/dashboard'
 *   for the pay-first flow so a paid buyer goes straight to their dashboard.
 * @returns {Promise<{ ok: true } | { ok: false, reason: string, detail?: string }>}
 */
export async function sendVerificationEmail({ supabaseAdmin, email, password, name, linkType, redirectPath }) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return { ok: false, reason: 'config', detail: 'RESEND_API_KEY or RESEND_FROM_EMAIL not set' };
  }

  const type = linkType || (password ? 'signup' : 'magiclink');
  const safePath = `/${String(redirectPath || 'login').replace(/^\/+/, '')}`;
  const linkOpts = {
    type,
    email,
    options: {
      redirectTo: `${APP_PUBLIC_URL.replace(/\/$/, '')}${safePath}`,
    },
  };
  if (type === 'signup') {
    linkOpts.password = password;
  }

  // 1. Ask Supabase for a verify link without triggering its email path.
  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink(linkOpts);

  if (linkError) {
    return { ok: false, reason: 'generate_link', detail: linkError.message };
  }

  const verifyUrl = linkData?.properties?.action_link;
  if (!verifyUrl) {
    return { ok: false, reason: 'generate_link', detail: 'No action_link in generateLink response' };
  }

  // 2. Send the email through Resend.
  const { subject, html, text } = verifyEmail({ name: name || null, verifyUrl });
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [email],
      subject,
      html,
      text,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    return { ok: false, reason: 'resend', detail: `${resp.status} ${detail}` };
  }

  return { ok: true };
}
