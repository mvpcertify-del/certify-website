// Welcome email endpoint.
//
// Called by a Postgres trigger on auth.users.email_confirmed_at via pg_net.
// Authenticates with a shared secret in the x-internal-token header, because
// pg_net cannot mint JWTs. Idempotent: profiles.welcome_sent_at gates resends.

import { createClient } from '@supabase/supabase-js';
import { welcomeEmail } from './_emailTemplates.js';
import { DASHBOARD_URL } from './_appUrl.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const INTERNAL_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;

async function sendViaResend({ to, subject, html, text }) {
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: RESEND_FROM_EMAIL, to: [to], subject, html, text }),
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

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL || !INTERNAL_SECRET) {
    console.error('send-welcome: missing env vars');
    return res.status(500).json({ error: 'Server email not configured' });
  }

  const provided = req.headers['x-internal-token'];
  if (!provided || provided !== INTERNAL_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { user_id } = req.body || {};
  if (!user_id) {
    return res.status(400).json({ error: 'Missing user_id' });
  }

  try {
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, role, stakeholder_type, approval_status, welcome_sent_at')
      .eq('id', user_id)
      .maybeSingle();

    if (error) {
      console.error('send-welcome: profile lookup failed', error);
      return res.status(500).json({ error: error.message });
    }
    if (!profile) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Idempotency: never send twice.
    if (profile.welcome_sent_at) {
      return res.status(200).json({ skipped: 'already_sent' });
    }

    // Stakeholders pending admin approval should not get the welcome email
    // yet — they'll be greeted on approval (separate follow-up email).
    if (profile.approval_status === 'pending') {
      return res.status(200).json({ skipped: 'pending_approval' });
    }

    const { subject, html, text } = welcomeEmail({
      name: profile.full_name,
      role: profile.role,
      dashboardUrl: DASHBOARD_URL,
    });

    await sendViaResend({ to: profile.email, subject, html, text });

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({ welcome_sent_at: new Date().toISOString() })
      .eq('id', user_id);

    if (updateError) {
      // The email already shipped; log but don't fail loudly.
      console.error('send-welcome: failed to set welcome_sent_at', updateError);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-welcome: error', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
