// Transactional email templates for Certify.cx.
//
// Each function returns { subject, html, text }. Plain strings only — kept
// English-only in v1 because the Supabase Send Email Hook payload does not
// carry user locale. Follow-up: read profiles.preferred_locale in the hook
// and switch on it.
//
// Design follows the in-app brand: light surface, accent #3ECF8E.

const BRAND_TEXT = 'Certify.cx';
const SUPPORT_EMAIL = 'support@certify.cx';

// Match src/index.css --color-accent.
const ACCENT = '#3ECF8E';
const ACCENT_HOVER = '#2EB87A';
const TEXT_PRIMARY = '#1a1f36';
const TEXT_SECONDARY = '#5b6478';
const TEXT_TERTIARY = '#8a93a6';
const SURFACE_BG = '#f4f6fb';
const CARD_BG = '#ffffff';
const BORDER = '#e6e9f0';

// Branded wordmark: "C" and ".cx" in accent green, "ertify" in default text,
// with a small superscript trademark. Mirrors the JSX in Sidebar/AuthLayout.
const wordmark = (size = 22) => `
  <span style="font-size:${size}px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_PRIMARY};line-height:1;">
    <span style="color:${ACCENT};">C</span>ertify<span style="color:${ACCENT};">.cx</span><sup style="font-size:0.55em;vertical-align:super;margin-left:1px;font-weight:500;color:${ACCENT};opacity:0.75;">™</sup>
  </span>`;

// Inline shield logo matching public/favicon.svg.
const logoMark = (size = 36) => `
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 56 64" width="${size}" height="${Math.round(size * 64 / 56)}" fill="none" style="display:block;vertical-align:middle;">
    <path d="M28 2L4 13V32C4 46 14.5 57.5 28 62C41.5 57.5 52 46 52 32V13L28 2Z" fill="${ACCENT}" fill-opacity="0.18" stroke="${ACCENT}" stroke-width="2" stroke-linejoin="round"/>
    <path d="M28 8L10 17V32C10 43 17.5 52 28 56C38.5 52 46 43 46 32V17L28 8Z" fill="${ACCENT}" fill-opacity="0.08"/>
    <path d="M18 32L24.5 38.5L38 24" stroke="${ACCENT}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;

// `preheader` is the hidden inbox-preview line (so the preview is never blank);
// it defaults to the title. The card is fluid (width:100% capped at 560px) and
// the <style> media queries collapse padding / stack the button on phones.
const layout = ({ title, bodyHtml, preheader }) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<meta name="supported-color-schemes" content="light only">
<title>${title}</title>
<style>
  @media only screen and (max-width:600px) {
    .ccx-wrap { padding: 16px 0 !important; }
    .ccx-card { width: 100% !important; border-radius: 0 !important; border-left: 0 !important; border-right: 0 !important; }
    .ccx-body { padding: 26px 22px !important; }
    .ccx-head { padding: 22px 22px 18px !important; }
    .ccx-foot { padding: 20px 22px !important; }
    .ccx-h1 { font-size: 20px !important; }
    .ccx-btn { display: block !important; text-align: center !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${SURFACE_BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${TEXT_PRIMARY};-webkit-font-smoothing:antialiased;">
  <div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${SURFACE_BG};opacity:0;">${preheader || title}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${SURFACE_BG};">
    <tr><td align="center" class="ccx-wrap" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="ccx-card" style="max-width:560px;background:${CARD_BG};border-radius:16px;border:1px solid ${BORDER};box-shadow:0 4px 24px rgba(16,24,40,0.06);overflow:hidden;">
        <tr><td class="ccx-head" style="padding:28px 36px 24px;border-bottom:1px solid ${BORDER};">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">${logoMark(36)}</td>
              <td style="vertical-align:middle;">${wordmark(22)}</td>
            </tr>
          </table>
        </td></tr>
        <tr><td class="ccx-body" style="padding:36px;">${bodyHtml}</td></tr>
        <tr><td class="ccx-foot" style="padding:24px 36px;border-top:1px solid ${BORDER};background:#fafbfd;">
          <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_SECONDARY};">
            Need help? Reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};text-decoration:none;font-weight:500;">${SUPPORT_EMAIL}</a>.
          </p>
          <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:${TEXT_TERTIARY};">
            ${BRAND_TEXT}™ — ISO certification, simplified.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

// Escape user-supplied text before interpolating it into email HTML. Used for
// anything that can originate from an untrusted/unauthenticated request (e.g.
// the public consultation form and guest-checkout contact details feeding the
// admin alert), to prevent HTML/link injection into admin inboxes.
const escapeHtml = (v) => String(v == null ? '' : v)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;');

const button = (href, label) => `<a href="${href}" class="ccx-btn" style="display:inline-block;box-sizing:border-box;background:${ACCENT};color:#0a1f17;text-decoration:none;padding:13px 26px;border-radius:10px;font-weight:600;font-size:15px;letter-spacing:0.01em;border:1px solid ${ACCENT_HOVER};">${label}</a>`;

const linkFallback = (href) => `
  <p style="font-size:13px;line-height:1.5;color:${TEXT_TERTIARY};margin:0 0 6px;">Or paste this link into your browser:</p>
  <p style="font-size:13px;line-height:1.5;word-break:break-all;margin:0 0 28px;">
    <a href="${href}" style="color:${ACCENT};text-decoration:none;">${href}</a>
  </p>`;

const heading = (text) => `<h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;color:${TEXT_PRIMARY};letter-spacing:-0.01em;">${text}</h1>`;
const body = (text) => `<p style="margin:0 0 24px;font-size:15px;line-height:1.65;color:${TEXT_SECONDARY};">${text}</p>`;
const muted = (text) => `<p style="margin:0;font-size:13px;line-height:1.5;color:${TEXT_TERTIARY};">${text}</p>`;

// A bordered label/value summary box (e.g. order details). `rows` is an array
// of [label, value] pairs; falsy values are skipped so callers can pass
// optional fields without conditionals. Returns '' when nothing survives, so we
// never render an empty bordered box.
const detailsBox = (rows) => {
  const filtered = rows.filter(([, value]) => value != null && value !== '');
  if (!filtered.length) return '';
  return `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;border:1px solid ${BORDER};border-radius:12px;overflow:hidden;">
    ${filtered.map(([label, value], i) => `
      <tr${i ? ` style="border-top:1px solid ${BORDER};"` : ''}>
        <td style="padding:12px 16px;font-size:13px;color:${TEXT_TERTIARY};background:#fafbfd;width:42%;vertical-align:top;">${label}</td>
        <td style="padding:12px 16px;font-size:14px;color:${TEXT_PRIMARY};font-weight:600;">${value}</td>
      </tr>`).join('')}
  </table>`;
};

// What-happens-next checklist used across the lifecycle emails.
const stepsList = (steps) => `
  <ul style="margin:0 0 8px;padding-left:20px;font-size:14px;line-height:1.8;color:${TEXT_SECONDARY};">
    ${steps.map((s) => `<li>${s}</li>`).join('')}
  </ul>`;

// ---- Certification lifecycle emails (sent from support@certify.cx) ----

export function paymentConfirmationEmail({ name, companyName, amount, isoStandard, packageName, dashboardUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Payment received — your ${BRAND_TEXT} certification is underway`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Payment received — thank you!')}
      ${body(`${greeting} we've received your payment and your ISO certification process has started. Here are your order details:`)}
      ${detailsBox([
        ['Company', companyName],
        ['Standard', isoStandard],
        ['Package', packageName],
        ['Amount paid', amount ? `$${amount}` : null],
      ])}
      <p style="margin:0 0 28px;">${button(dashboardUrl, 'View your dashboard')}</p>
      <div style="border-top:1px solid ${BORDER};padding-top:24px;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;color:${TEXT_PRIMARY};">What happens next</p>
        ${stepsList([
          'Our team reviews your application and assigns your certification body.',
          'Your audit is scheduled — you\'ll get an email when it\'s booked.',
          'After a successful audit, your certificate is issued and emailed to you.',
        ])}
      </div>`,
  });
  const text = `${greeting}\n\nWe've received your payment and your ${BRAND_TEXT} certification has started.\n\nCompany: ${companyName || '-'}\nStandard: ${isoStandard || '-'}\nPackage: ${packageName || '-'}\n${amount ? `Amount paid: $${amount}\n` : ''}\nView your dashboard: ${dashboardUrl}\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function applicationReceivedEmail({ name, companyName, isoStandard, dashboardUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `We've received your ${BRAND_TEXT} application`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Your application has been received')}
      ${body(`${greeting} thanks for submitting your details${companyName ? ` for <strong style="color:${TEXT_PRIMARY};">${companyName}</strong>` : ''}. Your certification application is now in our queue${isoStandard ? ` for <strong style="color:${TEXT_PRIMARY};">${isoStandard}</strong>` : ''}.`)}
      ${body('Our team will review it and get your audit scheduled. You can track the status any time from your dashboard.')}
      <p style="margin:0 0 28px;">${button(dashboardUrl, 'Track your application')}</p>
      ${muted('We\'ll email you at each step — application review, audit scheduling, and certificate issuance.')}`,
  });
  const text = `${greeting}\n\nWe've received your ${BRAND_TEXT} application${companyName ? ` for ${companyName}` : ''}${isoStandard ? ` (${isoStandard})` : ''}.\n\nTrack it from your dashboard: ${dashboardUrl}\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function auditScheduledEmail({ name, companyName, isoStandard, dashboardUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Your ${BRAND_TEXT} audit has been scheduled`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Your audit is scheduled')}
      ${body(`${greeting} good news — the audit${isoStandard ? ` for your <strong style="color:${TEXT_PRIMARY};">${isoStandard}</strong> certification` : ''}${companyName ? ` (${companyName})` : ''} has been scheduled.`)}
      ${body('Your assigned auditor will be in touch with the details. Please make sure your documentation is up to date in your dashboard before the audit.')}
      <p style="margin:0 0 28px;">${button(dashboardUrl, 'Review your documents')}</p>
      ${muted('Need to reschedule or have a question? Just reply to this email.')}`,
  });
  const text = `${greeting}\n\nYour ${BRAND_TEXT} audit${isoStandard ? ` for ${isoStandard}` : ''} has been scheduled. Your auditor will be in touch.\n\nReview your documents: ${dashboardUrl}\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function auditCompletedEmail({ name, companyName, isoStandard, dashboardUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Your ${BRAND_TEXT} audit is complete`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Audit complete — final review underway')}
      ${body(`${greeting} your audit${isoStandard ? ` for <strong style="color:${TEXT_PRIMARY};">${isoStandard}</strong>` : ''}${companyName ? ` (${companyName})` : ''} has been completed.`)}
      ${body('The certification body is now carrying out the final review of your file. We\'ll email you as soon as a decision is made and your certificate is ready.')}
      <p style="margin:0 0 28px;">${button(dashboardUrl, 'View status')}</p>`,
  });
  const text = `${greeting}\n\nYour ${BRAND_TEXT} audit${isoStandard ? ` for ${isoStandard}` : ''} is complete and is now in final review.\n\nView status: ${dashboardUrl}\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function renewalReminderEmail({ name, companyName, isoStandard, certificateNumber, expiresOn, dashboardUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Your ${BRAND_TEXT} certificate is due for renewal`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Time to renew your certificate')}
      ${body(`${greeting} your ${BRAND_TEXT} certificate is approaching its expiry date. Renew now to keep your certification valid without interruption.`)}
      ${detailsBox([
        ['Company', companyName],
        ['Standard', isoStandard],
        ['Certificate No.', certificateNumber],
        ['Expires on', expiresOn],
      ])}
      <p style="margin:0 0 28px;">${button(dashboardUrl, 'Start your renewal')}</p>
      ${muted('If you have already renewed, you can ignore this reminder.')}`,
  });
  const text = `${greeting}\n\nYour ${BRAND_TEXT} certificate is due for renewal.\n\nCompany: ${companyName || '-'}\nStandard: ${isoStandard || '-'}\nCertificate No.: ${certificateNumber || '-'}\nExpires on: ${expiresOn || '-'}\n\nRenew from your dashboard: ${dashboardUrl}\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

// Internal alert sent to admins (super + regional) when something needs their
// attention — a new registration/lead, a payment, or a new certification
// request. Plain, no-frills, links straight to the dashboard.
export function adminAlertEmail({ title, message, actionUrl }) {
  const subject = `[${BRAND_TEXT}] ${title}`;
  // title/message can carry user-supplied text (consultation form, guest
  // contact details) — escape before embedding in HTML.
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading(escapeHtml(title))}
      ${body(escapeHtml(message))}
      ${actionUrl ? `<p style="margin:0 0 28px;">${button(actionUrl, 'Open dashboard')}</p>` : ''}
      ${muted(`You're receiving this because you're an administrator on ${BRAND_TEXT}.`)}`,
  });
  const text = `[${BRAND_TEXT}] ${title}\n\n${message}\n\n${actionUrl || ''}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function certificateIssuedEmail({ name, companyName, isoStandard, certificateNumber, dashboardUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `🎉 Your ${BRAND_TEXT} certificate has been issued`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Congratulations — you\'re certified!')}
      ${body(`${greeting} your ${BRAND_TEXT} certification is complete. Here are the details:`)}
      ${detailsBox([
        ['Company', companyName],
        ['Standard', isoStandard],
        ['Certificate No.', certificateNumber],
      ])}
      ${body('Your certificate is available to download from your dashboard.')}
      <p style="margin:0 0 28px;">${button(dashboardUrl, 'Download your certificate')}</p>
      ${muted('Keep this certificate number for your records. We\'ll remind you before it\'s due for renewal.')}`,
  });
  const text = `${greeting}\n\nCongratulations! Your ${BRAND_TEXT} certificate has been issued.\n\nCompany: ${companyName || '-'}\nStandard: ${isoStandard || '-'}\nCertificate No.: ${certificateNumber || '-'}\n\nDownload it from your dashboard: ${dashboardUrl}\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function verifyEmail({ name, verifyUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Confirm your ${BRAND_TEXT} email`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Confirm your email address')}
      ${body(`${greeting} thanks for joining <strong style="color:${TEXT_PRIMARY};">${BRAND_TEXT}</strong>. Please confirm your email to activate your account and get started with your ISO certification.`)}
      <p style="margin:0 0 28px;">${button(verifyUrl, 'Confirm email')}</p>
      ${linkFallback(verifyUrl)}
      ${muted(`If you didn't sign up for ${BRAND_TEXT}, you can safely ignore this email.`)}`,
  });
  const text = `${greeting}\n\nThanks for joining ${BRAND_TEXT}. Confirm your email to activate your account:\n${verifyUrl}\n\nIf you didn't sign up, ignore this email.\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function welcomeEmail({ name, role, dashboardUrl }) {
  const greetingHeading = name ? `Welcome to ${BRAND_TEXT}, ${name}!` : `Welcome to ${BRAND_TEXT}!`;
  const subject = `Welcome to ${BRAND_TEXT}`;
  const roleLine = role === 'client'
    ? 'Your account is active. Head to your dashboard to start a certification application whenever you\'re ready.'
    : 'Your account is active. Sign in to access your dashboard.';
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading(greetingHeading)}
      ${body(`Your email is confirmed and you're all set. ${roleLine}`)}
      <p style="margin:0 0 32px;">${button(dashboardUrl, 'Open dashboard')}</p>
      <div style="border-top:1px solid ${BORDER};padding-top:24px;margin-bottom:8px;">
        <p style="margin:0 0 12px;font-size:14px;font-weight:600;line-height:1.5;color:${TEXT_PRIMARY};">A few things you can do next</p>
        <ul style="margin:0 0 0;padding-left:20px;font-size:14px;line-height:1.8;color:${TEXT_SECONDARY};">
          <li>Complete your profile and company details.</li>
          <li>Explore the ISO standards we support.</li>
          <li>Reach out any time at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT};text-decoration:none;">${SUPPORT_EMAIL}</a>.</li>
        </ul>
      </div>`,
  });
  const text = `${greetingHeading}\n\nYour email is confirmed and you're all set. ${roleLine}\n\nOpen your dashboard: ${dashboardUrl}\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function recoveryEmail({ name, resetUrl }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Reset your ${BRAND_TEXT} password`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Reset your password')}
      ${body(`${greeting} we received a request to reset your <strong style="color:${TEXT_PRIMARY};">${BRAND_TEXT}</strong> password. Click below to choose a new one.`)}
      <p style="margin:0 0 28px;">${button(resetUrl, 'Reset password')}</p>
      ${linkFallback(resetUrl)}
      ${muted("If you didn't request this, you can safely ignore this email — your password won't change.")}`,
  });
  const text = `${greeting}\n\nReset your ${BRAND_TEXT} password:\n${resetUrl}\n\nIf you didn't request this, ignore this email.\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function magicLinkEmail({ name, link }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Your ${BRAND_TEXT} sign-in link`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Sign in to your account')}
      ${body(`${greeting} click below to sign in to <strong style="color:${TEXT_PRIMARY};">${BRAND_TEXT}</strong>. This link expires in one hour.`)}
      <p style="margin:0 0 28px;">${button(link, 'Sign in')}</p>
      ${linkFallback(link)}
      ${muted("If you didn't request this link, you can safely ignore this email.")}`,
  });
  const text = `${greeting}\n\nSign in to ${BRAND_TEXT}: ${link}\n\nIf you didn't request this, ignore this email.\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function inviteEmail({ name, link }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `You're invited to ${BRAND_TEXT}`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading(`You're invited to ${BRAND_TEXT}`)}
      ${body(`${greeting} you've been invited to join <strong style="color:${TEXT_PRIMARY};">${BRAND_TEXT}</strong>. Accept the invitation to set up your account.`)}
      <p style="margin:0 0 28px;">${button(link, 'Accept invitation')}</p>
      ${linkFallback(link)}`,
  });
  const text = `${greeting}\n\nYou're invited to ${BRAND_TEXT}. Accept the invitation:\n${link}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}

export function emailChangeEmail({ name, link }) {
  const greeting = name ? `Hi ${name},` : 'Hello,';
  const subject = `Confirm your new ${BRAND_TEXT} email`;
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading('Confirm your new email')}
      ${body(`${greeting} confirm your new email address to finish updating your <strong style="color:${TEXT_PRIMARY};">${BRAND_TEXT}</strong> account.`)}
      <p style="margin:0 0 28px;">${button(link, 'Confirm new email')}</p>
      ${linkFallback(link)}`,
  });
  const text = `${greeting}\n\nConfirm your new ${BRAND_TEXT} email: ${link}\n\n— ${BRAND_TEXT}`;
  return { subject, html, text };
}
