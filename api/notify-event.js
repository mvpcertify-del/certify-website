// Lifecycle email + in-app notification dispatcher.
//
// Fired from the frontend at key milestones (payment confirmed, application
// received, audit scheduled, audit completed). The recipient is ALWAYS derived
// server-side from the application's client_id — the request body only carries
// the applicationId and the event name, never an email address, so a caller
// cannot redirect a notification to an arbitrary inbox.
//
// Auth model:
//   - client events  (payment_confirmed, application_received): the caller must
//     be the application's own client, or a staff member.
//   - staff events   (audit_scheduled, audit_completed, certificate_issued):
//     the caller must be staff (admin / auditor / certification body).
//
// Email failures are reported but the in-app notification is still attempted,
// so the customer sees the update in-app even if email delivery hiccups.

import { createClient } from '@supabase/supabase-js';
import { sendViaResend } from './_resendClient.js';
import { notifyAdmins } from './_notifyAdmins.js';
import {
  paymentConfirmationEmail,
  applicationReceivedEmail,
  auditScheduledEmail,
  auditCompletedEmail,
  certificateIssuedEmail,
  renewalReminderEmail,
} from './_emailTemplates.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const APP_PUBLIC_URL = (process.env.APP_PUBLIC_URL || '').replace(/\/$/, '');

const STAFF_ROLES = new Set(['super_admin', 'regional_admin', 'auditor', 'certification_body']);
const CLIENT_EVENTS = new Set(['payment_confirmed', 'application_received']);
const STAFF_EVENTS = new Set(['audit_scheduled', 'audit_completed', 'certificate_issued']);

async function authenticate(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7).trim() : null;
  if (!token) {
    const err = new Error('Missing Authorization bearer token');
    err.status = 401;
    throw err;
  }
  const { data: userData, error: userErr } = await supabaseAdmin.auth.getUser(token);
  if (userErr || !userData?.user) {
    const err = new Error('Invalid or expired token');
    err.status = 401;
    throw err;
  }
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, role')
    .eq('id', userData.user.id)
    .maybeSingle();
  return { id: userData.user.id, role: profile?.role || null };
}

export default async function handler(req, res) {
  // GET = the daily Vercel Cron hitting this route for renewal reminders.
  if (req.method === 'GET') {
    return await handleRenewalCron(req, res);
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const caller = await authenticate(req);
    const { applicationId, event } = req.body || {};

    if (!applicationId || !event) {
      return res.status(400).json({ error: 'Missing applicationId or event' });
    }
    if (!CLIENT_EVENTS.has(event) && !STAFF_EVENTS.has(event)) {
      return res.status(400).json({ error: `Unknown event: ${event}` });
    }

    // ---- Load the application + its client's contact details ----
    const { data: application, error: appErr } = await supabaseAdmin
      .from('applications')
      .select('id, client_id, company_name, recommended_iso, selected_package, total_amount')
      .eq('id', applicationId)
      .maybeSingle();
    if (appErr || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const isStaff = STAFF_ROLES.has(caller.role);
    const isOwner = caller.id === application.client_id;

    if (STAFF_EVENTS.has(event) && !isStaff) {
      return res.status(403).json({ error: 'Staff access required for this event' });
    }
    if (CLIENT_EVENTS.has(event) && !isOwner && !isStaff) {
      return res.status(403).json({ error: 'Not authorized for this application' });
    }

    const { data: clientProfile } = await supabaseAdmin
      .from('profiles')
      .select('id, email, full_name, name, region')
      .eq('id', application.client_id)
      .maybeSingle();

    if (!clientProfile?.email) {
      return res.status(404).json({ error: 'Client email not found' });
    }

    const name = clientProfile.full_name || clientProfile.name || null;
    const companyName = application.company_name || null;
    const isoStandard = application.recommended_iso || null;
    const packageName = application.selected_package || null;
    const amount = application.total_amount != null ? application.total_amount : null;
    const dashboardUrl = `${APP_PUBLIC_URL}/dashboard`;

    // ---- Build the email for this event ----
    let email;
    let notifTitle;
    if (event === 'payment_confirmed') {
      email = paymentConfirmationEmail({ name, companyName, amount, isoStandard, packageName, dashboardUrl });
      notifTitle = 'Payment received';
    } else if (event === 'application_received') {
      email = applicationReceivedEmail({ name, companyName, isoStandard, dashboardUrl });
      notifTitle = 'Application received';
    } else if (event === 'audit_scheduled') {
      email = auditScheduledEmail({ name, companyName, isoStandard, dashboardUrl });
      notifTitle = 'Audit scheduled';
    } else if (event === 'audit_completed') {
      email = auditCompletedEmail({ name, companyName, isoStandard, dashboardUrl });
      notifTitle = 'Audit completed';
    } else if (event === 'certificate_issued') {
      // Look up the certificate number for the body, if one exists yet.
      const { data: cert } = await supabaseAdmin
        .from('certificates')
        .select('certificate_number')
        .eq('application_id', applicationId)
        .maybeSingle();
      email = certificateIssuedEmail({
        name, companyName, isoStandard,
        certificateNumber: cert?.certificate_number || null,
        dashboardUrl,
      });
      notifTitle = 'Certificate issued';
    }

    // ---- Send the email (report failure but don't abort the notification) ----
    let emailSent = false;
    let emailError = null;
    try {
      await sendViaResend({ to: clientProfile.email, subject: email.subject, html: email.html, text: email.text });
      emailSent = true;
    } catch (err) {
      emailError = err.message || 'email send failed';
      console.error(`notify-event(${event}): email failed`, emailError);
    }

    // ---- In-app notification for the client (best-effort) ----
    try {
      await supabaseAdmin.from('notifications').insert({
        user_id: application.client_id,
        type: 'system',
        title: notifTitle,
        message: email.subject,
      });
    } catch (err) {
      console.error(`notify-event(${event}): notification insert failed`, err?.message);
    }

    // Admin-side alerts (best-effort) for the events admins care about.
    if (event === 'payment_confirmed') {
      await notifyAdmins(supabaseAdmin, {
        title: 'Payment received',
        message: `${companyName || name || 'A client'} paid${amount ? ` $${amount}` : ''}${isoStandard ? ` for ${isoStandard}` : ''}.`,
        region: clientProfile.region || null,
      });
    } else if (event === 'application_received') {
      await notifyAdmins(supabaseAdmin, {
        title: 'New certification request',
        message: `${companyName || name || 'A client'} submitted a certification application${isoStandard ? ` for ${isoStandard}` : ''}.`,
        region: clientProfile.region || null,
      });
    }

    return res.status(200).json({ success: true, emailSent, ...(emailError ? { emailError } : {}) });
  } catch (err) {
    const status = err.status || 500;
    console.error('notify-event error:', err);
    return res.status(status).json({ error: err.message || 'Internal Server Error' });
  }
}

// Daily cron: email clients whose certificate expires within 30 days and that
// haven't been reminded yet. Idempotent via certificates.renewal_reminded_at.
// Authenticated by the CRON_SECRET that Vercel Cron sends as a Bearer token.
async function handleRenewalCron(req, res) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const now = new Date();
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + 30);

  const { data: certs, error } = await supabaseAdmin
    .from('certificates')
    .select('id, client_id, company_name, iso_standard, certificate_number, expires_at')
    .eq('status', 'active')
    .lte('expires_at', horizon.toISOString())
    .is('renewal_reminded_at', null);

  if (error) {
    console.error('renewal cron: query failed', error.message);
    return res.status(500).json({ error: error.message });
  }

  let reminded = 0;
  for (const cert of certs || []) {
    try {
      const { data: prof } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, name')
        .eq('id', cert.client_id)
        .maybeSingle();

      if (prof?.email) {
        const { subject, html, text } = renewalReminderEmail({
          name: prof.full_name || prof.name || null,
          companyName: cert.company_name,
          isoStandard: cert.iso_standard,
          certificateNumber: cert.certificate_number,
          expiresOn: cert.expires_at ? String(cert.expires_at).slice(0, 10) : null,
          dashboardUrl: `${APP_PUBLIC_URL}/dashboard`,
        });
        await sendViaResend({ to: prof.email, subject, html, text });
        await supabaseAdmin.from('notifications').insert({
          user_id: cert.client_id,
          type: 'system',
          title: 'Certificate renewal due',
          message: subject,
        });
      }

      // Mark as reminded even if the client had no email, so we don't re-scan it daily.
      await supabaseAdmin
        .from('certificates')
        .update({ renewal_reminded_at: now.toISOString() })
        .eq('id', cert.id);
      reminded++;
    } catch (e) {
      console.error('renewal cron: cert failed', cert.id, e?.message);
    }
  }

  return res.status(200).json({ success: true, reminded });
}
