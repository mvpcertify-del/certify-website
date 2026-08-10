import { createClient } from '@supabase/supabase-js';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { sendViaResend } from './_resendClient.js';
import { certificateIssuedEmail } from './_emailTemplates.js';
// Was built from APP_PUBLIC_URL, which is set to a host with no valid
// certificate in the deployment — see api/_appUrl.js.
import { APP_URL as APP_PUBLIC_URL } from './_appUrl.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const CERT_VALIDITY_YEARS = 3;
const STAFF_ROLES = new Set(['super_admin', 'regional_admin', 'certification_body']);

// Verify the caller's JWT and return their profile. Throws on invalid auth.
async function authenticate(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;
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
  const { data: profile, error: profileErr } = await supabaseAdmin
    .from('profiles')
    .select('id, role, region')
    .eq('id', userData.user.id)
    .maybeSingle();
  if (profileErr || !profile) {
    const err = new Error('Profile not found');
    err.status = 401;
    throw err;
  }
  return profile;
}

// CCX-YYYY-XXXXXX  — year + 6 random uppercase alphanumerics.
function generateCertificateNumber() {
  const year = new Date().getFullYear();
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `CCX-${year}-${suffix}`;
}

// Render the certificate PDF with pdf-lib. Returns a Uint8Array.
async function buildCertificatePdf({ companyName, isoStandard, certificateNumber, issuedAt, expiresAt }) {
  const doc = await PDFDocument.create();
  // Landscape A4 (842 × 595 pt).
  const page = doc.addPage([842, 595]);
  const { width, height } = page.getSize();
  const helvetica = await doc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await doc.embedFont(StandardFonts.HelveticaBold);

  // Background.
  page.drawRectangle({ x: 0, y: 0, width, height, color: rgb(1, 1, 1) });

  // Outer border.
  page.drawRectangle({
    x: 24, y: 24, width: width - 48, height: height - 48,
    borderColor: rgb(0.09, 0.23, 0.37),
    borderWidth: 2,
  });

  // Inner accent border.
  page.drawRectangle({
    x: 36, y: 36, width: width - 72, height: height - 72,
    borderColor: rgb(0.24, 0.81, 0.56),
    borderWidth: 0.8,
  });

  const centerText = (text, font, size, y, color = rgb(0.09, 0.23, 0.37)) => {
    const textWidth = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (width - textWidth) / 2, y, size, font, color });
  };

  // Header.
  centerText('Certify.cx', helveticaBold, 18, height - 80, rgb(0.24, 0.81, 0.56));
  centerText('CERTIFICATE OF REGISTRATION', helveticaBold, 28, height - 130);

  // Body intro.
  centerText('This is to certify that the management system of', helvetica, 14, height - 190, rgb(0.4, 0.45, 0.55));

  // Company name (large).
  centerText(companyName, helveticaBold, 28, height - 240);

  centerText('has been assessed and registered to the requirements of', helvetica, 14, height - 290, rgb(0.4, 0.45, 0.55));

  // ISO standard (large).
  centerText(isoStandard, helveticaBold, 24, height - 335, rgb(0.24, 0.81, 0.56));

  // Dates.
  const issuedLine = `Issued: ${issuedAt.toISOString().slice(0, 10)}    ·    Valid until: ${expiresAt.toISOString().slice(0, 10)}`;
  centerText(issuedLine, helvetica, 12, height - 400, rgb(0.4, 0.45, 0.55));

  // Certificate number.
  centerText(`Certificate No. ${certificateNumber}`, helveticaBold, 12, height - 425, rgb(0.09, 0.23, 0.37));

  // Footer.
  centerText('Issued by Certify.cx — Independent certification platform', helvetica, 10, 72, rgb(0.55, 0.6, 0.7));
  centerText('Verify at https://certify.cx', helvetica, 10, 56, rgb(0.55, 0.6, 0.7));

  return await doc.save();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const caller = await authenticate(req);
    if (!STAFF_ROLES.has(caller.role)) {
      return res.status(403).json({ error: 'Only certification staff may issue certificates' });
    }

    const { applicationId } = req.body || {};
    if (!applicationId) {
      return res.status(400).json({ error: 'Missing applicationId' });
    }

    // ---- 1. Load the application (and its client's region for scoping) ----
    const { data: application, error: appErr } = await supabaseAdmin
      .from('applications')
      .select('id, client_id, recommended_iso, company_name, status, assigned_cb_id, profiles!applications_client_id_fkey(region)')
      .eq('id', applicationId)
      .maybeSingle();
    if (appErr || !application) {
      return res.status(404).json({ error: 'Application not found' });
    }
    if (application.status !== 'approved') {
      return res.status(400).json({ error: 'Application is not approved' });
    }

    // Regional-admin / CB scoping: must own the record.
    const clientRegion = application.profiles?.region;
    if (caller.role === 'regional_admin' && caller.region && clientRegion && caller.region !== clientRegion) {
      return res.status(403).json({ error: 'Application is outside your region' });
    }
    if (caller.role === 'certification_body' && application.assigned_cb_id && application.assigned_cb_id !== caller.id) {
      return res.status(403).json({ error: 'Application is not assigned to you' });
    }

    // ---- 2. Idempotency — return existing certificate if any ----
    const { data: existing } = await supabaseAdmin
      .from('certificates')
      .select('*')
      .eq('application_id', applicationId)
      .maybeSingle();
    if (existing) {
      return res.status(200).json({ certificate: existing, alreadyIssued: true });
    }

    // ---- 3. Generate the PDF ----
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt);
    expiresAt.setFullYear(expiresAt.getFullYear() + CERT_VALIDITY_YEARS);
    const certificateNumber = generateCertificateNumber();
    const companyName = application.company_name || 'Registered Organization';
    const isoStandard = application.recommended_iso || 'ISO Standard';

    const pdfBytes = await buildCertificatePdf({
      companyName,
      isoStandard,
      certificateNumber,
      issuedAt,
      expiresAt,
    });

    // ---- 4. Upload to private storage ----
    const storagePath = `${application.client_id}/${application.id}.pdf`;
    const { error: uploadErr } = await supabaseAdmin
      .storage
      .from('certificates')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });
    if (uploadErr) {
      console.error('Certificate upload error:', uploadErr);
      return res.status(500).json({ error: 'Failed to upload certificate PDF' });
    }

    // ---- 5. Insert DB row ----
    const { data: cert, error: insertErr } = await supabaseAdmin
      .from('certificates')
      .insert({
        application_id: applicationId,
        client_id: application.client_id,
        iso_standard: isoStandard,
        certificate_number: certificateNumber,
        company_name: companyName,
        issued_at: issuedAt.toISOString(),
        expires_at: expiresAt.toISOString(),
        storage_path: storagePath,
        status: 'active',
      })
      .select('*')
      .single();
    if (insertErr) {
      console.error('Certificate insert error:', insertErr);
      // Best-effort cleanup — the upload is now orphaned otherwise.
      await supabaseAdmin.storage.from('certificates').remove([storagePath]).catch(() => {});
      return res.status(500).json({ error: 'Failed to record certificate' });
    }

    // ---- 6. Email the client their certificate (best-effort, non-blocking) ----
    try {
      const { data: clientProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name, name')
        .eq('id', application.client_id)
        .maybeSingle();
      if (clientProfile?.email) {
        const { subject, html, text } = certificateIssuedEmail({
          name: clientProfile.full_name || clientProfile.name || null,
          companyName,
          isoStandard,
          certificateNumber,
          dashboardUrl: `${APP_PUBLIC_URL}/dashboard`,
        });
        await sendViaResend({ to: clientProfile.email, subject, html, text });
        await supabaseAdmin.from('notifications').insert({
          user_id: application.client_id,
          type: 'system',
          title: 'Certificate issued',
          message: subject,
        });
      }
    } catch (mailErr) {
      console.error('issue-certificate: notification failed (non-blocking):', mailErr?.message);
    }

    return res.status(200).json({ certificate: cert, alreadyIssued: false });
  } catch (err) {
    const status = err.status || 500;
    console.error('issue-certificate error:', err);
    return res.status(status).json({ error: err.message || 'Internal Server Error' });
  }
}
