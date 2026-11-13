// Welcome email endpoint.
// Called by the Postgres email-confirmation trigger via pg_net.
// Authentication uses the x-internal-token shared secret.

import { createClient } from '@supabase/supabase-js';
import { sendWelcomeDirect } from './_sendWelcomeDirect.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const WELCOME_FROM_EMAIL =
  process.env.WELCOME_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;
const INTERNAL_SECRET = process.env.INTERNAL_WEBHOOK_SECRET;

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!RESEND_API_KEY || !WELCOME_FROM_EMAIL || !INTERNAL_SECRET) {
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

    if (profile.welcome_sent_at) {
      return res.status(200).json({ skipped: 'already_sent' });
    }

    if (profile.approval_status === 'pending') {
      return res.status(200).json({ skipped: 'pending_approval' });
    }

    const welcomeSent = await sendWelcomeDirect({
      supabaseAdmin,
      userId: profile.id,
      email: profile.email,
      name: profile.full_name,
      role: profile.role,
      stakeholderType: profile.stakeholder_type,
    });

    if (!welcomeSent) {
      return res.status(409).json({
        error: 'Welcome email was not sent. It may already be claimed or require investigation.',
      });
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('send-welcome: error', err);
    return res.status(500).json({
      error: err.message || 'Internal Server Error',
    });
  }
}
