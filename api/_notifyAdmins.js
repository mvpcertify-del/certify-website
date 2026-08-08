// Admin alert helper — in-app notification + email to the right admins.
//
// Targets: every super_admin, plus any regional_admin whose region matches the
// `region` passed in (super_admins always get everything; when no region is
// given, all admins are notified). Best-effort: this never throws, so a caller
// in a signup/payment path is never blocked by a notification hiccup.

import { sendViaResend } from './_resendClient.js';
import { sendWhatsApp } from './_notifyWhatsApp.js';
import { adminAlertEmail } from './_emailTemplates.js';

// An empty base built a relative "/dashboard" href, which is a dead link inside
// an email client — every other module that links into the app already falls
// back to the public site, so this one does too.
const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || 'https://certify.cx').replace(/\/$/, '');

// `details` is an optional [label, value] list shown as a summary box in the
// email (see adminAlertEmail). The in-app notification stays a single line —
// the notifications table has no room for structured fields.
export async function notifyAdmins(supabaseAdmin, { title, message, region = null, details = [] }) {
  try {
    const { data: admins } = await supabaseAdmin
      .from('profiles')
      .select('id, email, role, region, phone')
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
      details,
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

    // WhatsApp — best-effort, no-op until a provider is configured (see
    // _notifyWhatsApp.js). Only admins with a stored phone number are reached.
    await Promise.all(
      targets
        .filter((a) => a.phone)
        .map((a) => sendWhatsApp({ to: a.phone, text: `${title}: ${message}` }))
    );
  } catch (err) {
    console.error('notifyAdmins error:', err?.message);
  }
}
