// Manual "resend verification email" endpoint.
//
// Used when /api/create-user successfully created the user but the
// verification email send failed (Resend outage, transient network, etc.).
// The user is already in auth.users with email_confirmed_at = NULL, so we
// just need to regenerate the link and re-send.
//
// We rate-limit by checking how recently the same email tried — to keep this
// endpoint from being abused as an enumeration / spam vector. Cheap in-memory
// limit per server instance is enough for now (request volume is tiny).

import { createClient } from '@supabase/supabase-js';
import { sendVerificationEmail } from './_sendVerificationEmail.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// In-memory cooldown: 60 seconds between resends per email per instance.
const recentSends = new Map();
const COOLDOWN_MS = 60 * 1000;

function isOnCooldown(email) {
  const last = recentSends.get(email);
  if (!last) return false;
  return Date.now() - last < COOLDOWN_MS;
}

function markSent(email) {
  recentSends.set(email, Date.now());
  // Crude bounded growth: clear oldest if map is huge.
  if (recentSends.size > 1000) {
    const firstKey = recentSends.keys().next().value;
    recentSends.delete(firstKey);
  }
}

export async function resendVerification(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: 'Missing email' });
    }

    if (isOnCooldown(email)) {
      return res.status(429).json({ error: 'Please wait a minute before requesting another email' });
    }

    // Look up the profile to greet the user by name. We always return 200
    // regardless of whether the email exists, to avoid email enumeration.
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('full_name, email')
      .eq('email', email)
      .maybeSingle();

    if (!profile) {
      markSent(email);
      return res.status(200).json({ success: true });
    }

    // For an already-created user, use 'magiclink' (no password needed).
    // Clicking the link confirms the email AND signs them in.
    const sendResult = await sendVerificationEmail({
      supabaseAdmin,
      email,
      name: profile.full_name,
      linkType: 'magiclink',
    });

    if (!sendResult.ok) {
      console.error('resend-verification: send failed', sendResult);
      return res.status(500).json({ error: 'Failed to send verification email' });
    }

    markSent(email);
    return res.status(200).json({ success: true });
  } catch (err) {
    console.error('resend-verification: error', err);
    return res.status(500).json({ error: err.message || 'Internal Server Error' });
  }
}
