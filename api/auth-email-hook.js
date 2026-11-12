// Supabase Auth "Send Email Hook" receiver.
//
// Supabase fires this endpoint for every transactional auth email (signup,
// recovery, magiclink, invite, email_change). We verify the standard-webhooks
// signature, render the appropriate template, and send via Resend.
//
// Configured in: Supabase Dashboard → Authentication → Hooks → Send Email Hook
//   URL: ${APP_PUBLIC_URL}/api/auth-email-hook
//   Secret: stored in env as SUPABASE_AUTH_HOOK_SECRET (format: v1,whsec_...)

import { Webhook } from 'standardwebhooks';
import {
  verifyEmail,
  recoveryEmail,
  magicLinkEmail,
  loginOtpEmail,
  inviteEmail,
  emailChangeEmail,
} from './_emailTemplates.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const HOOK_SECRET = process.env.SUPABASE_AUTH_HOOK_SECRET;

// Vercel serverless: read raw body for signature verification.
async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function buildVerifyUrl({ site_url, token_hash, email_action_type, redirect_to }) {
  const base = (site_url || '').replace(/\/$/, '');
  const params = new URLSearchParams({
    token_hash,
    type: email_action_type,
    ...(redirect_to ? { redirect_to } : {}),
  });
  return `${base}/auth/v1/verify?${params.toString()}`;
}

export function pickTemplate(action, { name, url, code, email }) {
  switch (action) {
    case 'signup':
      return verifyEmail({ name, verifyUrl: url });
    case 'recovery':
      return recoveryEmail({ name, resetUrl: url });
    case 'magiclink':
      // signInWithOtp() on an existing user arrives here with the six-digit
      // code in email_data.token. The login page asks for that code, so send
      // the code (not a link) whenever Supabase provides one.
      return code ? loginOtpEmail({ name, code, email }) : magicLinkEmail({ name, link: url });
    case 'invite':
      return inviteEmail({ name, link: url });
    case 'email_change':
    case 'email_change_new':
    case 'email_change_current':
      return emailChangeEmail({ name, link: url });
    default:
      // Unknown action — fall back to the verify template so the user still
      // gets something usable rather than nothing.
      return verifyEmail({ name, verifyUrl: url });
  }
}

async function sendViaResend({ to, subject, html, text }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Resend ${resp.status}: ${detail}`);
  }
  return resp.json();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !HOOK_SECRET) {
    console.error('auth-email-hook: missing env vars (RESEND_API_KEY, RESEND_FROM_EMAIL, or SUPABASE_AUTH_HOOK_SECRET)');
    return res.status(500).json({ error: 'Server email not configured' });
  }

  let payload;
  try {
    const raw = await readRawBody(req);
    const headers = {
      'webhook-id': req.headers['webhook-id'],
      'webhook-timestamp': req.headers['webhook-timestamp'],
      'webhook-signature': req.headers['webhook-signature'],
    };
    // standardwebhooks expects the secret without the "v1,whsec_" framing
    // that Supabase shows in the dashboard. Strip it if present.
    const secret = HOOK_SECRET.trim().replace(/^v1,whsec_/, '');
    const wh = new Webhook(secret);
    payload = wh.verify(raw, headers);
  } catch (err) {
    console.error('auth-email-hook: signature verification failed', err?.message);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  try {
    const { user, email_data } = payload;
    if (!user?.email || !email_data) {
      return res.status(400).json({ error: 'Malformed payload' });
    }

    const url = buildVerifyUrl(email_data);
    const name = user.user_metadata?.name || user.user_metadata?.full_name || null;
    const { subject, html, text } = pickTemplate(email_data.email_action_type, { name, url, code: email_data.token, email: user.email });

    await sendViaResend({ to: user.email, subject, html, text });
    return res.status(200).json({});
  } catch (err) {
    console.error('auth-email-hook: send failed', err);
    return res.status(500).json({ error: err.message || 'Send failed' });
  }
}

// Vercel: receive raw body so signature verification works.
export const config = { api: { bodyParser: false } };
