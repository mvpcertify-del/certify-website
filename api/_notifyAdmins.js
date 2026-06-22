// Admin alert helper — in-app notification + email to the right admins.
//
// Targets: every super_admin, plus any regional_admin whose region matches the
// `region` passed in (super_admins always get everything; when no region is
// given, all admins are notified). Best-effort: this never throws, so a caller
// in a signup/payment path is never blocked by a notification hiccup.

import { sendViaResend } from './_resendClient.js';
import { adminAlertEmail } from './_emailTemplates.js';

const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');

export async function notifyAdmins(supabaseAdmin, { title, message, region = null }) {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, region')
      .in('role', ['super_admin', 'regional_admin']);

    if (!admins?.length) return;

    const targets = admins.filter(
      (a) => a.role === 'super_admin' || !region || a.region === region
    );
    if (!targets.length) return;

    // In-app notifications (one row per admin).
    await supabaseAdmin
      .from('notifications')
      .insert(targets.map((a) => ({ user_id: a.id, type: 'system', title, message })))
      .then(() => {}, (e) => console.error('notifyAdmins: insert failed', e?.message));

    // Emails — parallel, swallow individual failures.
    const { subject, html, text } = adminAlertEmail({
      title,
      message,
      actionUrl: `${APP_PUBLIC_URL}/dashboard`,
    });
    await Promise.all(
      targets
        .filter((a) => a.email)
        .map((a) =>
          sendViaResend({ to: a.email, subject, html, text }).catch((e) =>
            console.error('notifyAdmins: email failed', a.email, e?.message)
          )
        )
    );
  } catch (err) {
    console.error('notifyAdmins error:', err?.message);
  }
}
