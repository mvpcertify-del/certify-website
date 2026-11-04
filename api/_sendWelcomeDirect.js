// Shared, database-guarded welcome email sender.

import { welcomeEmail } from './_emailTemplates.js';
import { DASHBOARD_URL } from './_appUrl.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const WELCOME_FROM_EMAIL =
  process.env.WELCOME_FROM_EMAIL || process.env.RESEND_FROM_EMAIL;

export async function sendWelcomeDirect({
  supabaseAdmin,
  userId,
  email,
  name,
  role,
  stakeholderType,
}) {
  if (!supabaseAdmin || !userId || !email || !RESEND_API_KEY || !WELCOME_FROM_EMAIL) {
    console.error('Welcome email skipped: missing required configuration or user data.');
    return false;
  }

  let claimed = false;

  try {
    const { data: claimResult, error: claimError } = await supabaseAdmin.rpc(
      'claim_welcome_email',
      { p_user_id: userId }
    );

    if (claimError) {
      console.error('Welcome email claim failed:', claimError.message);
      return false;
    }

    claimed = claimResult === true;

    if (!claimed) {
      return false;
    }

    const { subject, html, text } = welcomeEmail({
      name: name || null,
      role: role || 'client',
      stakeholderType: stakeholderType || null,
      dashboardUrl: DASHBOARD_URL,
    });

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: WELCOME_FROM_EMAIL,
        to: [email],
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => '');
      throw new Error(`Resend ${response.status}: ${details.slice(0, 500)}`);
    }

    const { error: updateError } = await supabaseAdmin
      .from('profiles')
      .update({
        welcome_sent_at: new Date().toISOString(),
        welcome_sending_at: null,
      })
      .eq('id', userId);

    if (updateError) {
      // Keep the claim until its timeout rather than immediately risking a duplicate.
      console.error('Welcome email sent, but timestamp update failed:', updateError.message);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Welcome email failed:', error?.message || 'Unknown error');

    if (claimed) {
      const { error: releaseError } = await supabaseAdmin.rpc(
        'release_welcome_email',
        { p_user_id: userId }
      );

      if (releaseError) {
        console.error('Welcome email claim release failed:', releaseError.message);
      }
    }

    return false;
  }
}
