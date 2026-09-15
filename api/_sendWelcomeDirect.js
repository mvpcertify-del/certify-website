// Shared "welcome, direct" sender.
//
// Email verification was removed for everyone (client, 25 Jul). New users are
// created already-confirmed and are never sent a "verify your email" link, so
// the welcome email — which used to ride on the email_confirmed_at trigger —
// no longer has a transition to fire on. Both places a profile can first come
// into existence with a role call this directly instead, so a new user is
// welcomed exactly once regardless of how they signed up:
//   - api/create-user.js   (email + password self-signup, and admin-created users)
//   - api/user.js           (Google OAuth bootstrap — see isOAuthRoleBootstrap)
//
// Best-effort: never blocks account creation or the caller's own response.
//
// System identity (RESEND_FROM_EMAIL / noreply@certify.cx) — this is an
// automated email, not something a human wrote, so it does not use the
// business identity in _resendClient.js.

import { welcomeEmail } from './_emailTemplates.js';
import { DASHBOARD_URL } from './_appUrl.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

export async function sendWelcomeDirect({ email, name, role }) {
  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) return;
  try {
    const { subject, html, text } = welcomeEmail({
      name: name || null,
      role: role || 'client',
      dashboardUrl: DASHBOARD_URL,
    });
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [email], subject, html, text }),
    });
  } catch (e) {
    console.error('sendWelcomeDirect: welcome email failed (non-blocking):', e?.message);
  }
}
