// Transactional email templates for Certify.cx.
//
// Each function returns { subject, html, text }. Plain strings only — kept
// English-only in v1 because the Supabase Send Email Hook payload does not
// carry user locale. Follow-up: read profiles.preferred_locale in the hook
// and switch on it.
//
// Design follows the in-app brand: light surface, the client's official mark.

import { BRAND_MARK_URL, BRAND_MARK_ASPECT, BRAND_ACCENT_HEX } from './_brandAsset.js';
import {
  SENDER,
  SENDER_MARK_URL,
  SENDER_MARK_WIDTH,
  SENDER_MARK_HEIGHT,
  getOutreachCopy,
} from './_outreachCopy.js';

const BRAND_TEXT = 'Certify.cx';
const SUPPORT_EMAIL = 'support@certify.cx';

// Two greens, each for the job it is actually good at on a white card:
//
//   ACCENT (#3ECF8E, the dark-theme --color-accent) is a BUTTON FILL only. It
//   is light, so the dark button label sits on it at ~10:1 contrast.
//
//   ACCENT_ON_WHITE (#0e9f6e, the light-theme --color-accent, shared from
//   _brandAsset.js) is for anything drawn AS text on the white card — links,
//   the billing heading. #3ECF8E as text on white is roughly 1.9:1, which is
//   effectively unreadable; the deeper green roughly doubles that.
//
// This is the same constant the invoice/receipt PDFs use, so the documents and
// the emails that carry them can no longer drift apart (they previously used
// #0DA673 and #0da678 respectively — two different greens nobody chose).
const ACCENT = '#3ECF8E';
const ACCENT_ON_WHITE = BRAND_ACCENT_HEX;
const ACCENT_HOVER = '#2EB87A';
const TEXT_PRIMARY = '#1a1f36';
const TEXT_SECONDARY = '#5b6478';
const TEXT_TERTIARY = '#8a93a6';
const SURFACE_BG = '#f4f6fb';
const CARD_BG = '#ffffff';
const BORDER = '#e6e9f0';

// Branded wordmark — ONE flat colour, never two-tone.
//
// This used to paint the "C" and the ".cx" green against neutral "ertify".
// src/components/ui/BrandLogo.jsx abolished that treatment across the app
// ("Brand rule from the client: ONE colour, never multi-colour"); email was the
// last surface still doing it. The ™ stays grey, matching BrandLogo's default
// `tm="grey"` — that is a de-emphasis, not a second brand colour.
const wordmark = (size = 22) => `
  <span style="font-size:${size}px;font-weight:700;letter-spacing:-0.01em;color:${TEXT_PRIMARY};line-height:1;">Certify.cx<sup style="font-size:0.55em;vertical-align:super;margin-left:1px;font-weight:500;color:${TEXT_TERTIARY};">™</sup></span>`;

// The client's official mark, as a hosted PNG.
//
// This replaces an inline <svg> that reproduced a green-shield logo which was
// never the client's artwork. It is an <img> rather than inline SVG because
// inline SVG is not renderable in Outlook 2007-2019 (Word's rendering engine
// ignores it entirely) and is stripped by several webmail sanitisers — a hosted
// PNG is the only image treatment every major client draws.
//
// Most clients block remote images on first view, so the mark cannot be the
// only thing carrying the brand: the wordmark beside it is real text and always
// renders. Explicit width/height keep the header from reflowing while the image
// loads (and give Outlook the box it needs when images are off).
const logoMark = (size = 36) => `
  <img src="${BRAND_MARK_URL}" width="${size}" height="${Math.round(size / BRAND_MARK_ASPECT)}" alt="Certify.cx" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />`;

// `preheader` is the hidden inbox-preview line (so the preview is never blank);
// it defaults to the title. The card is fluid (width:100% capped at 560px) and
// the <style> media queries collapse padding / stack the button on phones.
//
// `headerHtml` / `footerHtml` override the Certify.cx letterhead and footer.
// They exist for ONE caller: the referral partner's outreach letter, which the
// client wrote under their own WCA GLOBAL identity (see api/_outreachCopy.js).
// Everything else — every transactional email — omits them and gets the
// Certify.cx mark, which is what the client's brand rule requires. Passing them
// is a deliberate act, not a default.
const layout = ({ title, bodyHtml, preheader, headerHtml, footerHtml }) => `<!DOCTYPE html>
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
          ${headerHtml || `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">${logoMark(36)}</td>
              <td style="vertical-align:middle;">${wordmark(22)}</td>
            </tr>
          </table>`}
        </td></tr>
        <tr><td class="ccx-body" style="padding:36px;">${bodyHtml}</td></tr>
        <tr><td class="ccx-foot" style="padding:24px 36px;border-top:1px solid ${BORDER};background:#fafbfd;">
          ${footerHtml || `<p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_SECONDARY};">
            Need help? Reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT_ON_WHITE};text-decoration:none;font-weight:500;">${SUPPORT_EMAIL}</a>.
          </p>
          <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:${TEXT_TERTIARY};">
            ${BRAND_TEXT}™ — ISO certification, simplified.
          </p>`}
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
    <a href="${href}" style="color:${ACCENT_ON_WHITE};text-decoration:none;">${href}</a>
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
// `details` is an optional [label, value] list rendered in the same bordered
// summary box the payment and certificate emails use. Added 8 Aug: the new
// registration alert said only "<name> (<email>) just registered", which does
// not tell an admin what kind of account it is or which country it belongs to —
// the two things that decide who has to act on it. Falsy values drop out, so a
// caller can pass optional fields without conditionals.
export function adminAlertEmail({ title, message, actionUrl, details = [] }) {
  const subject = `[${BRAND_TEXT}] ${title}`;
  // title/message/details can carry user-supplied text (consultation form,
  // guest contact details, a self-chosen company name) — escape every one of
  // them before embedding in HTML.
  // Guarded: this helper sits inside signup and payment paths, and a caller
  // passing the wrong shape must degrade to "no details box", never throw and
  // cost the admins their alert entirely.
  const kept = (Array.isArray(details) ? details : [])
    .filter((row) => Array.isArray(row) && row[1] != null && row[1] !== '');
  const detailRows = kept.map(([label, value]) => [escapeHtml(label), escapeHtml(value)]);
  const html = layout({
    title: subject,
    bodyHtml: `
      ${heading(escapeHtml(title))}
      ${body(escapeHtml(message))}
      ${detailsBox(detailRows)}
      ${actionUrl ? `<p style="margin:0 0 28px;">${button(actionUrl, 'Open dashboard')}</p>` : ''}
      ${muted(`You're receiving this because you're an administrator on ${BRAND_TEXT}.`)}`,
  });
  const detailText = kept.length
    ? `\n\n${kept.map(([label, value]) => `${label}: ${value}`).join('\n')}`
    : '';
  const text = `[${BRAND_TEXT}] ${title}\n\n${message}${detailText}\n\n${actionUrl || ''}\n\n— ${BRAND_TEXT}`;
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
          <li>Reach out any time at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT_ON_WHITE};text-decoration:none;">${SUPPORT_EMAIL}</a>.</li>
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

// ---- Billing documents (invoice / payment receipt) --------------------------
//
// Used by api/_billing.js, which previously hand-rolled its own bare <div> of
// HTML with a hard-coded #0da678 heading and no logo at all — so the one class
// of email that is literally a financial document was the least branded thing
// we sent. It now goes through the same layout, header mark and footer as every
// other transactional email.
//
// `title` and `message` are composed server-side but interpolate admin-editable
// org settings and free-text payment methods, so they are escaped here rather
// than at the call site: a template that escapes its own inputs cannot be
// forgotten. The PDF itself rides along as an attachment.
export function billingDocumentEmail({ title, message, orgName, taxLabel, taxNumber }) {
  const org = escapeHtml(orgName || BRAND_TEXT);
  const taxLine = taxNumber
    ? `${org} &middot; ${escapeHtml(taxLabel || 'TRN')} ${escapeHtml(taxNumber)}`
    : org;

  const html = layout({
    title,
    preheader: message,
    bodyHtml: `
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.3;color:${ACCENT_ON_WHITE};letter-spacing:-0.01em;">${escapeHtml(title)}</h1>
      ${body(escapeHtml(message))}
      ${muted(`The document is attached to this email as a PDF. You can also view it any time from your ${org} dashboard under Billing.`)}
      <p style="margin:20px 0 0;font-size:12px;line-height:1.5;color:${TEXT_TERTIARY};">${taxLine}</p>`,
  });

  const text = `${title}\n\n${message}\n\nThe document is attached to this email as a PDF. You can also view it any time from your ${orgName || BRAND_TEXT} dashboard under Billing.\n\nQuestions? ${SUPPORT_EMAIL}\n\n— ${BRAND_TEXT}`;
  return { html, text };
}

// ---- Referral partner → their client invitation (phase27) -------------------
//
// Sent from a referral partner's dashboard to a client they added. Everything
// interpolated here is partner-supplied (client name, partner name)
// or partner-triggered (their code), so ALL of it is HTML-escaped — a partner
// is authenticated but still untrusted input as far as another person's inbox
// is concerned.
//
// The discount code is shown as a copyable code AND baked into the link, so the
// client can either click through (code pre-applied) or type it. `profileUrl`
// is optional — a company profile PDF or video link — and the row is dropped
// when absent so we never render a dangling "View: " with no link.
export function referralClientInviteEmail({
  clientName, partnerName, partnerCompany, registrationUrl, discountCode, profileUrl,
}) {
  const cName = escapeHtml(clientName || 'there');
  const pName = escapeHtml(partnerName || 'A Certify.cx partner');
  const pCompany = partnerCompany ? escapeHtml(partnerCompany) : '';
  const code = escapeHtml(discountCode || '');
  const fromLine = pCompany ? `${pName} (${pCompany})` : pName;

  const subject = `${pName} invites you to get ISO certified with ${BRAND_TEXT}`;

  const codeBox = code ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td align="center" style="padding:16px;border:1px dashed ${ACCENT_ON_WHITE};border-radius:12px;background:#f0fbf6;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${TEXT_TERTIARY};">Your discount code</p>
        <p style="margin:0;font-family:'SFMono-Regular',Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em;color:${ACCENT_ON_WHITE};">${code}</p>
      </td></tr>
    </table>` : '';

  const profileRow = profileUrl ? body(
    `Want to know more first? <a href="${escapeHtml(profileUrl)}" style="color:${ACCENT_ON_WHITE};text-decoration:none;font-weight:500;">View our company profile</a>.`
  ) : '';

  // Signs off with the partner's stored name. The partner-typed signature this
  // used to carry was removed on 6 Sep at the client's instruction — nothing a
  // partner types now goes out under the company's own domain.
  const signOff = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;border-top:1px solid ${BORDER};">
      <tr><td style="padding:18px 0 0;">
        <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_SECONDARY};">${fromLine}</p>
      </td></tr>
    </table>`;

  const html = layout({
    title: subject,
    preheader: `${pName} thinks ${BRAND_TEXT} can help you get ISO certified — with a discount.`,
    bodyHtml: `
      ${heading('Get ISO certified with Certify.cx')}
      ${body(`Hi ${cName}, ${fromLine} has invited you to <strong style="color:${TEXT_PRIMARY};">${BRAND_TEXT}</strong> — the online platform that takes your organisation from application to accredited ISO certificate, all in one place.`)}
      ${code ? body('Use the code below at checkout for a discount on your certification:') : ''}
      ${codeBox}
      <p style="margin:0 0 28px;">${button(registrationUrl, 'Start your certification')}</p>
      ${linkFallback(registrationUrl)}
      ${profileRow}
      ${signOff}`,
  });

  const text = [
    `Hi ${clientName || 'there'},`,
    ``,
    `${partnerName || 'A Certify.cx partner'}${partnerCompany ? ` (${partnerCompany})` : ''} has invited you to ${BRAND_TEXT} — the online platform for ISO certification.`,
    code ? `\nYour discount code: ${discountCode}` : '',
    ``,
    `Start here: ${registrationUrl}`,
    profileUrl ? `\nCompany profile: ${profileUrl}` : '',
    ``,
    `${partnerName || 'A Certify.cx partner'}${partnerCompany ? ` (${partnerCompany})` : ''}`,
    ``,
    `— ${BRAND_TEXT}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Super Admin -> prospect: recruit a new referral partner
// ---------------------------------------------------------------------------
// NOT the same email as referralClientInviteEmail above: that one is a
// PARTNER inviting their own LEAD to buy a certification. This one is an
// ADMIN inviting a PROSPECT to become a partner in the first place — the
// registration link goes to /register/referral, not a checkout page, and
// there is no discount code because the recipient isn't a customer yet.
//
// Client, 16-17 Sep: approved building an in-app "Invite Referral Partner"
// action after being told support@certify.cx has no inbox of its own to
// compose from — see api/referrals.js's invitePartner().
export function referralPartnerRecruitEmail({ name, note, registerUrl }) {
  const greetName = escapeHtml(name || 'there');
  const noteHtml = note ? body(escapeHtml(note)) : '';
  const subject = `You're invited to become a ${BRAND_TEXT} Referral Partner`;

  const html = layout({
    title: subject,
    preheader: `Earn commission referring clients to ${BRAND_TEXT} — takes a minute to sign up.`,
    bodyHtml: `
      ${heading('Become a Certify.cx Referral Partner')}
      ${body(`Hi ${greetName}, the ${BRAND_TEXT} team would like to invite you to join our Referral Partner program. Introduce prospective clients for ISO certification and training, and earn a commission on every deal that closes.`)}
      ${noteHtml}
      <p style="margin:0 0 28px;">${button(registerUrl, 'Register as a Referral Partner')}</p>
      ${linkFallback(registerUrl)}
      ${muted('Registration takes a couple of minutes — no cost to join.')}`,
  });

  const text = [
    `Hi ${name || 'there'},`,
    ``,
    `The ${BRAND_TEXT} team would like to invite you to join our Referral Partner program. Introduce prospective clients for ISO certification and training, and earn a commission on every deal that closes.`,
    note ? `\n${note}` : '',
    ``,
    `Register here: ${registerUrl}`,
    ``,
    `— ${BRAND_TEXT}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Super Admin -> prospect: recruit any OTHER stakeholder type
// ---------------------------------------------------------------------------
// Sibling to referralPartnerRecruitEmail above, which stays untouched — the
// client already tested and approved that exact copy, and this file does not
// risk drifting wording they signed off on. This one covers the other five
// stakeholder types the client asked to extend the same "Invite" button to
// (16-17 Sep): client, auditor, certification-body, consultancy, investor.
// See api/referrals.js's invitePartner(), which picks this vs. the referral
// one based on `stakeholderType`.
const STAKEHOLDER_INVITE_COPY = {
  client: {
    heading: 'Get ISO certified with Certify.cx',
    pitch: 'the Certify.cx team would like to invite you to start your ISO certification journey — apply online, get audited, and receive your accredited certificate, all from one platform.',
    cta: 'Start your certification',
  },
  auditor: {
    heading: 'Join Certify.cx as a Lead Auditor',
    pitch: 'the Certify.cx team would like to invite you to join our network of certified auditors, conducting ISO compliance audits for our client base.',
    cta: 'Register as an Auditor',
  },
  'certification-body': {
    heading: 'Join Certify.cx as a Certification Body',
    pitch: 'the Certify.cx team would like to invite you to partner with us as an accredited Certification Body, issuing certificates to clients through our platform.',
    cta: 'Register as a Certification Body',
  },
  consultancy: {
    heading: 'Join Certify.cx as a Consultancy Partner',
    pitch: 'the Certify.cx team would like to invite you to join as a Consultancy Partner, guiding your clients through ISO certification on our platform and earning commission on every deal that closes.',
    cta: 'Register as a Consultancy Partner',
  },
  investor: {
    heading: 'An investment opportunity with Certify.cx',
    pitch: 'the Certify.cx team would like to invite you to learn more about investing in Certify.cx — our platform for accredited ISO certification.',
    cta: 'Register as an Investor',
  },
};

export function stakeholderInviteEmail({ type, name, note, registerUrl }) {
  const copy = STAKEHOLDER_INVITE_COPY[type] || STAKEHOLDER_INVITE_COPY.client;
  const greetName = escapeHtml(name || 'there');
  const noteHtml = note ? body(escapeHtml(note)) : '';
  const subject = copy.heading;

  const html = layout({
    title: subject,
    preheader: `${BRAND_TEXT} would like to invite you — takes a minute to sign up.`,
    bodyHtml: `
      ${heading(copy.heading)}
      ${body(`Hi ${greetName}, ${copy.pitch}`)}
      ${noteHtml}
      <p style="margin:0 0 28px;">${button(registerUrl, copy.cta)}</p>
      ${linkFallback(registerUrl)}
      ${muted('Registration takes a couple of minutes — no cost to join.')}`,
  });

  const text = [
    `Hi ${name || 'there'},`,
    ``,
    copy.pitch.charAt(0).toUpperCase() + copy.pitch.slice(1),
    note ? `\n${note}` : '',
    ``,
    `Register here: ${registerUrl}`,
    ``,
    `— ${BRAND_TEXT}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Midhat -> Middle East prospect: bilingual ISO 9001:2026 outreach (demo)
// ---------------------------------------------------------------------------
// Client, 16-17 Sep: "for the Middle East, we will need to have Arabic at the
// top & English below, with my name & title in Arabic & English inviting
// them to start the Certification for ISO 9001:2026. Create one demo & send
// it to me... along with some attachments or links to attachments in the
// footer body of the email."
//
// Arabic block first (dir="rtl", right-aligned), a divider, then the same
// message in English (dir="ltr") — NOT the whole email mirrored RTL, since an
// Arabic reader wants the Arabic on top and an English-only reader further
// down still reads their half left-to-right rather than a right-aligned
// English paragraph, which would look broken rather than bilingual.
//
// Footer carries LINKS only (the website and the ISO 9001 page's own
// buy/checkout button), no file attachment — decided 17 Sep rather than
// hosting/attaching a PDF for a first demo.
//
// This is a ONE-OFF outreach letter, signed personally, not a system email:
// callers should pass a `from` that resolves to a real reachable identity
// (midhat@certify.cx once that mailbox exists; support@certify.cx with a
// personal display name until then) — this function only builds the content.
export function iso9001MiddleEastInviteEmail({ name, companyName, registerUrl, websiteUrl }) {
  // Strip line breaks before anything else: `name`/`companyName` are typed
  // into an admin form and this value ends up in an email Subject header —
  // a bare newline there is a header-injection vector even before HTML is
  // in the picture.
  const cleanName = name ? String(name).replace(/[\r\n]+/g, ' ').trim() : '';
  const cleanCompany = companyName ? String(companyName).replace(/[\r\n]+/g, ' ').trim() : '';

  const greetArabic = escapeHtml(cleanName || 'عزيزي');
  const greetEnglish = escapeHtml(cleanName || 'there');
  const companyArabic = cleanCompany ? escapeHtml(cleanCompany) : '';
  const companyEnglish = cleanCompany ? escapeHtml(cleanCompany) : '';

  // Real Resend Subject header: plain text, so cleanName (not HTML-escaped)
  // is correct here — escaping would show literal "&amp;" etc. in the
  // recipient's inbox subject line.
  const subject = cleanName
    ? `${cleanName} — Start Your ISO 9001:2026 Certification with Certify.cx`
    : 'Start Your ISO 9001:2026 Certification with Certify.cx';
  // The SAME text also lands inside the HTML <title> tag via layout() below —
  // that context needs HTML-escaping, or an admin-typed name containing
  // "</title><script>" would break out of it. escapeHtml on the whole
  // subject (rather than re-deriving it from the raw name) keeps this from
  // silently drifting out of sync with the line above.
  const htmlTitle = escapeHtml(subject);

  const arabicBlock = `
    <div dir="rtl" style="text-align:right;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.4;color:${TEXT_PRIMARY};">ابدأوا رحلة اعتماد الأيزو 9001:2026 مع Certify.cx</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.9;color:${TEXT_SECONDARY};">
        عزيزي ${greetArabic}${companyArabic ? ` من ${companyArabic}` : ''}،<br>
        يسرّني دعوتكم لبدء إجراءات الحصول على شهادة الأيزو ISO 9001:2026 لإدارة الجودة من خلال منصة Certify.cx — من التقديم إلى التدقيق وحتى استلام الشهادة المعتمدة، في مكان واحد.
      </p>
      <p style="margin:0 0 6px;font-size:14px;line-height:1.7;color:${TEXT_PRIMARY};font-weight:600;">مدحت أبو غزالة</p>
      <p style="margin:0 0 26px;font-size:13px;line-height:1.6;color:${TEXT_TERTIARY};">المؤسس والرئيس التنفيذي — Certify.cx</p>
    </div>`;

  const englishBlock = `
    <div dir="ltr" style="text-align:left;">
      <h1 style="margin:0 0 16px;font-size:22px;font-weight:700;line-height:1.35;color:${TEXT_PRIMARY};letter-spacing:-0.01em;">Start Your ISO 9001:2026 Certification</h1>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.65;color:${TEXT_SECONDARY};">
        Hi ${greetEnglish}${companyEnglish ? ` at ${companyEnglish}` : ''},<br>
        I'd like to personally invite you to begin your ISO 9001:2026 Quality Management certification through Certify.cx — from application to audit to your accredited certificate, all on one platform.
      </p>
      <p style="margin:0 0 4px;font-size:14px;line-height:1.6;color:${TEXT_PRIMARY};font-weight:600;">Midhat Abu Ghazaleh</p>
      <p style="margin:0 0 28px;font-size:13px;line-height:1.5;color:${TEXT_TERTIARY};">Founder &amp; CEO — Certify.cx</p>
    </div>`;

  const html = layout({
    title: htmlTitle,
    preheader: 'Start your ISO 9001:2026 certification with Certify.cx — a personal invitation.',
    bodyHtml: `
      ${arabicBlock}
      <hr style="border:none;border-top:1px solid ${BORDER};margin:0 0 26px;">
      ${englishBlock}
      <p style="margin:0 0 28px;">${button(registerUrl, 'Start Certification / ابدأ الاعتماد')}</p>
      ${linkFallback(registerUrl)}`,
    footerHtml: `
      <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${TEXT_SECONDARY};">
        <a href="${escapeHtml(websiteUrl || 'https://certify.cx')}" style="color:${ACCENT_ON_WHITE};text-decoration:none;font-weight:500;">${escapeHtml(websiteUrl || 'https://certify.cx')}</a>
        &nbsp;·&nbsp;
        <a href="${escapeHtml(registerUrl)}" style="color:${ACCENT_ON_WHITE};text-decoration:none;font-weight:500;">Start certification / بدء الاعتماد</a>
      </p>
      <p style="margin:0;font-size:13px;line-height:1.6;color:${TEXT_SECONDARY};">
        Need help? Reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT_ON_WHITE};text-decoration:none;font-weight:500;">${SUPPORT_EMAIL}</a>.
      </p>
      <p style="margin:8px 0 0;font-size:12px;line-height:1.5;color:${TEXT_TERTIARY};">
        ${BRAND_TEXT}™ — ISO certification, simplified.
      </p>`,
  });

  const text = [
    `[Arabic]`,
    `عزيزي ${cleanName || 'عزيزي'}${cleanCompany ? ` من ${cleanCompany}` : ''}،`,
    `يسرّني دعوتكم لبدء إجراءات الحصول على شهادة الأيزو ISO 9001:2026 لإدارة الجودة من خلال منصة Certify.cx.`,
    `مدحت أبو غزالة — المؤسس والرئيس التنفيذي`,
    ``,
    `[English]`,
    `Hi ${cleanName || 'there'}${cleanCompany ? ` at ${cleanCompany}` : ''},`,
    `I'd like to personally invite you to begin your ISO 9001:2026 Quality Management certification through Certify.cx.`,
    `Midhat Abu Ghazaleh — Founder & CEO`,
    ``,
    `Start certification: ${registerUrl}`,
    `Website: ${websiteUrl || 'https://certify.cx'}`,
    ``,
    `— ${BRAND_TEXT}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Midhat -> investment fund: outreach letter (demo)
// ---------------------------------------------------------------------------
// Client, 10 Oct: wanted this sent "by prompting Sara AI" — Sara (api/ai-chat.js)
// is a visitor-facing support chatbot with no email-sending capability and no
// access to the investors list, so that path doesn't exist. This is the actual
// deliverable instead: a real, sendable template, content-only for now (no
// bulk-send action wired up — that's a separate feature decision).
//
// Deliberately does NOT invent traction numbers, revenue, or user counts —
// nothing here is sourced from real figures, so none are claimed. The letter
// introduces the platform and invites a conversation; it is not a pitch deck.
export function investorOutreachEmail({ contactName, fundName, replyUrl }) {
  const greetName = escapeHtml(contactName || 'there');
  const fundLine = fundName ? body(`I'm reaching out from ${escapeHtml(fundName)}'s network as a fund we'd value hearing from.`) : '';
  const subject = fundName
    ? `Certify.cx — an introduction for ${fundName}`
    : 'Certify.cx — an introduction';

  const html = layout({
    title: subject,
    preheader: 'Certify.cx — ISO certification, simplified. An introduction and an invitation to talk.',
    bodyHtml: `
      ${heading('A quick introduction from Certify.cx')}
      ${body(`Hi ${greetName}, I'm Midhat Abu Ghazaleh, Founder &amp; CEO of <strong style="color:${TEXT_PRIMARY};">${BRAND_TEXT}</strong> — a platform that takes a business from ISO certification application through audit to an accredited certificate, all in one place.`)}
      ${fundLine}
      ${body(`We're building out the next stage of the business and I wanted to open a conversation with investors we respect. If this is of interest, I'd welcome a short call to share more and hear your thoughts.`)}
      <p style="margin:0 0 28px;">${button(replyUrl || 'https://certify.cx', "Learn more about Certify.cx")}</p>
      ${replyUrl ? linkFallback(replyUrl) : ''}
      ${muted('Reply directly to this email — it reaches me.')}`,
    footerHtml: `
      <p style="margin:0 0 4px;font-size:13px;line-height:1.6;color:${TEXT_SECONDARY};font-weight:600;">Midhat Abu Ghazaleh</p>
      <p style="margin:0 0 14px;font-size:13px;line-height:1.5;color:${TEXT_TERTIARY};">Founder &amp; CEO — ${BRAND_TEXT}</p>
      <p style="margin:0;font-size:12px;line-height:1.5;color:${TEXT_TERTIARY};">
        ${BRAND_TEXT}™ — ISO certification, simplified.
      </p>`,
  });

  const text = [
    `Hi ${contactName || 'there'},`,
    ``,
    `I'm Midhat Abu Ghazaleh, Founder & CEO of ${BRAND_TEXT} — a platform that takes a business from ISO certification application through audit to an accredited certificate, all in one place.`,
    fundName ? `I'm reaching out from ${fundName}'s network as a fund we'd value hearing from.` : '',
    ``,
    `We're building out the next stage of the business and I wanted to open a conversation with investors we respect. If this is of interest, I'd welcome a short call to share more and hear your thoughts.`,
    ``,
    replyUrl ? `Learn more: ${replyUrl}` : '',
    `Reply directly to this email — it reaches me.`,
    ``,
    `Midhat Abu Ghazaleh`,
    `Founder & CEO — ${BRAND_TEXT}`,
  ].filter(Boolean).join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Referral partner -> lead: the standard proposal letter (phase32)
// ---------------------------------------------------------------------------
// The client sent a real letter one of their partners had written to a
// university, and asked for it to become a button in every partner's
// dashboard. This renders that letter.
//
// It is NOT the phase27 invite. The invite says "here is a registration link
// and your discount code"; this one makes a case for ONE named standard and
// carries that standard's briefing document as a file attachment. A partner
// working a lead may well send this first and the invite later.
//
// THREE THINGS ARE DELIBERATE HERE AND SHOULD NOT BE "TIDIED UP":
//
//  1. The letterhead and footer are WCA GLOBAL, not Certify.cx. That is the
//     identity the client wrote the sample under. The footer still names
//     Certify.cx as the sending platform, because the mail leaves the
//     certify.cx domain and a recipient is entitled to see who actually sent
//     it — hiding that is what gets a domain reported rather than replied to.
//
//  2. Every interpolated value is escapeHtml'd. `orgName`, `clientName` and
//     `existingCert` are typed by a partner into a form. None of it is
//     trusted markup.
//
//  3. The call to action points at the standard's own page on Certify.cx with
//     the partner's referral code attached — NOT at wca-global.com, which is
//     where the sample pointed. The sample's link led to a brochure site with
//     nothing to buy; this one lands on the page that names the price and
//     carries the payment gateway, and the ?ref= is what credits the sale to
//     the partner who sent the letter. The wca-global.com link is kept too,
//     lower down, because the client's copy asks for it.
export function partnerOutreachEmail({
  clientName,
  orgName,
  standardSlug,
  standardCode,
  existingCert,
  ctaUrl,
  partnerName,
  attachmentNames = [],
  discountCode,
}) {
  const copy = getOutreachCopy(standardSlug);
  const title = copy?.title || '';
  const pitch = copy?.pitch || '';

  const org = escapeHtml(orgName || 'your organization');
  const code = escapeHtml(standardCode || '');
  const named = title ? `${code} &ndash; ${escapeHtml(title)}` : code;

  // "Dear Sir/ Madam," is the sample's own salutation and stays the default:
  // these leads are cold, and a wrong first name reads worse than none.
  const salutation = clientName
    ? `Dear ${escapeHtml(clientName)},`
    : 'Dear Sir/ Madam,';

  // The opening differs on one fact: whether this organization already holds a
  // certification worth congratulating. The sample assumed it always does
  // ("commend you for the successful acquisition of ISO 9001") — untrue for
  // most leads, and an opening line that congratulates someone on something
  // they never did is worse than no opening line at all.
  const opening = existingCert
    ? `${body(`On behalf of <strong style="color:${TEXT_PRIMARY};">${escapeHtml(SENDER.name)}</strong>, I would like to sincerely commend ${org} for the successful acquisition of ${escapeHtml(existingCert)} certification. This is a significant achievement and demonstrates the organization&rsquo;s commitment to quality management, continuous improvement, and excellence in service delivery.`)}
       ${body(`Building on this achievement, we would like to encourage ${org} to consider implementing and pursuing ${named}.`)}`
    : body(`On behalf of <strong style="color:${TEXT_PRIMARY};">${escapeHtml(SENDER.name)}</strong>, I would like to introduce ${named}, and to encourage ${org} to consider implementing and pursuing it.`);

  // Names the files the message ACTUALLY carries — the array is built from
  // bytes in hand, never from what the sender ticked (api/referrals.js). One
  // file keeps the original sentence; two get a sentence that names both, so a
  // recipient is never told about a briefing note and then handed two PDFs with
  // no explanation of the second.
  const attachedList = Array.isArray(attachmentNames) ? attachmentNames.filter(Boolean) : [];
  const namesHtml = attachedList
    .map(n => `<em>${escapeHtml(n)}</em>`)
    .join(' and ');
  const attachmentRow = attachedList.length === 0
    ? ''
    : attachedList.length === 1
      ? body(`I have attached a short briefing note on ${code} &mdash; ${namesHtml} &mdash; which sets out the requirements and the certification route in more detail.`)
      : body(`I have attached ${namesHtml}, which together set out who we are and what the ${code} requirements and certification route involve.`);

  // The partner's own code, so a lead who reads this letter and buys is
  // credited to the partner who sent it (client, 6 Sep). The call-to-action
  // link already carries ?ref=, but a recipient who reaches the site any other
  // way — searching for it, or forwarding the mail to a colleague who then
  // types the address — would otherwise arrive with no attribution at all.
  const dCode = discountCode ? escapeHtml(discountCode) : '';
  const codeBox = dCode ? `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px;">
      <tr><td align="center" style="padding:16px;border:1px dashed ${ACCENT_ON_WHITE};border-radius:12px;background:#f0fbf6;">
        <p style="margin:0 0 6px;font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:${TEXT_TERTIARY};">Your discount code</p>
        <p style="margin:0;font-family:'SFMono-Regular',Consolas,monospace;font-size:24px;font-weight:700;letter-spacing:0.1em;color:${ACCENT_ON_WHITE};">${dCode}</p>
      </td></tr>
    </table>` : '';

  // The partner's stored name, full stop. The editable signature this used to
  // prefer was removed on 6 Sep at the client's instruction.
  const signatureBlock = `<p style="margin:0 0 4px;font-size:14px;line-height:1.7;color:${TEXT_SECONDARY};">${escapeHtml(partnerName || '')}</p>`;

  const headerHtml = `<table role="presentation" cellpadding="0" cellspacing="0" border="0">
    <tr><td style="vertical-align:middle;">
      <img src="${SENDER_MARK_URL}" width="${SENDER_MARK_WIDTH}" height="${SENDER_MARK_HEIGHT}" alt="${escapeHtml(SENDER.name)}" style="display:block;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;" />
    </td></tr>
  </table>`;

  const footerHtml = `
    <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXT_SECONDARY};font-style:italic;">${escapeHtml(SENDER.taglineA)}</p>
    <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:${TEXT_SECONDARY};font-style:italic;">${escapeHtml(SENDER.taglineB)}</p>
    <p style="margin:6px 0 0;font-size:12px;line-height:1.6;color:${TEXT_SECONDARY};font-style:italic;">${escapeHtml(SENDER.taglineC)}</p>
    <p style="margin:14px 0 0;font-size:12px;line-height:1.5;color:${TEXT_TERTIARY};">
      Sent via ${BRAND_TEXT} on behalf of ${escapeHtml(SENDER.name)}. Reply to this email to reach us, or write to
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT_ON_WHITE};text-decoration:none;">${SUPPORT_EMAIL}</a>.
    </p>`;

  // The Subject HEADER is plain text and must stay raw — an escaped one would
  // show "&#39;" in the recipient's inbox. The <title> and the hidden preheader
  // are HTML and must not, because `orgName` is free text typed by a partner.
  const subject = `Proposal to Consider ${standardCode} Certification for ${orgName || 'your organization'}`;

  const html = layout({
    title: escapeHtml(subject),
    preheader: escapeHtml(`${standardCode} certification for ${orgName || 'your organization'} — a short proposal from ${SENDER.name}.`),
    headerHtml,
    footerHtml,
    bodyHtml: `
      ${body(salutation)}
      ${body('I hope this email finds you well.')}
      ${opening}
      ${pitch ? body(escapeHtml(pitch)) : ''}
      ${body(`As ${escapeHtml(SENDER.name)}, we would be pleased to support ${org} throughout this process. Our team can provide guidance on the ${code} implementation process, assess your current systems against the standard, identify any gaps, and support you in preparing for certification.`)}
      ${body(`We would also be glad to prepare and share a proposal and quotation for the ${code} certification process for your consideration, based on your specific requirements and scope.`)}
      ${attachmentRow}
      ${body('We would appreciate an opportunity to engage with the Management or the relevant team to discuss this further and explore how we can support you in taking this important next step.')}
      ${dCode ? body('Quote the code below at checkout for a discount on your certification:') : ''}
      ${codeBox}
      <p style="margin:0 0 12px;">${button(ctaUrl, `View ${standardCode} details &amp; pricing`)}</p>
      ${linkFallback(ctaUrl)}
      ${body(`You can also read more about us at <a href="${SENDER.siteUrl}" style="color:${ACCENT_ON_WHITE};text-decoration:none;font-weight:500;">${escapeHtml(SENDER.site)}</a>.`)}
      ${body(`Thank you for your commitment to quality and organizational excellence. We look forward to the opportunity to work with ${org}.`)}
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:28px 0 0;border-top:1px solid ${BORDER};">
        <tr><td style="padding:18px 0 0;">
          <p style="margin:0 0 10px;font-size:14px;line-height:1.7;color:${TEXT_SECONDARY};">Kind regards,</p>
          ${signatureBlock}
          <p style="margin:10px 0 0;font-size:13px;font-weight:700;color:${TEXT_PRIMARY};">${escapeHtml(SENDER.name)}</p>
        </td></tr>
      </table>`,
  });

  const text = [
    clientName ? `Dear ${clientName},` : 'Dear Sir/ Madam,',
    ``,
    `I hope this email finds you well.`,
    ``,
    existingCert
      ? `On behalf of ${SENDER.name}, I would like to sincerely commend ${orgName || 'your organization'} for the successful acquisition of ${existingCert} certification. This is a significant achievement and demonstrates the organization's commitment to quality management, continuous improvement, and excellence in service delivery.\n\nBuilding on this achievement, we would like to encourage ${orgName || 'your organization'} to consider implementing and pursuing ${standardCode}${title ? ` - ${title}` : ''}.`
      : `On behalf of ${SENDER.name}, I would like to introduce ${standardCode}${title ? ` - ${title}` : ''}, and to encourage ${orgName || 'your organization'} to consider implementing and pursuing it.`,
    ``,
    pitch,
    ``,
    `As ${SENDER.name}, we would be pleased to support ${orgName || 'your organization'} throughout this process. Our team can provide guidance on the ${standardCode} implementation process, assess your current systems against the standard, identify any gaps, and support you in preparing for certification.`,
    ``,
    `We would also be glad to prepare and share a proposal and quotation for the ${standardCode} certification process for your consideration, based on your specific requirements and scope.`,
    ...(attachedList.length === 0
      ? []
      : attachedList.length === 1
        ? [``, `I have attached a short briefing note on ${standardCode} (${attachedList[0]}) which sets out the requirements and the certification route in more detail.`]
        : [``, `I have attached ${attachedList.join(' and ')}, which together set out who we are and what the ${standardCode} requirements and certification route involve.`]),
    ``,
    `We would appreciate an opportunity to engage with the Management or the relevant team to discuss this further and explore how we can support you in taking this important next step.`,
    ``,
    ...(discountCode ? [`Your discount code: ${discountCode}`, ``] : []),
    `Details and pricing: ${ctaUrl}`,
    `More about us: ${SENDER.siteUrl}`,
    ``,
    `Thank you for your commitment to quality and organizational excellence. We look forward to the opportunity to work with ${orgName || 'your organization'}.`,
    ``,
    `Kind regards,`,
    ...(partnerName ? [partnerName] : []),
    SENDER.name,
    ``,
    SENDER.taglineA,
    SENDER.taglineB,
    SENDER.taglineC,
    ``,
    `Sent via ${BRAND_TEXT} on behalf of ${SENDER.name}. Reply to this email to reach us, or write to ${SUPPORT_EMAIL}.`,
    // Blank strings above are intentional paragraph breaks, so this array is
    // joined as-is — no .filter(Boolean), which would collapse the letter into
    // one unreadable block.
  ].join('\n');

  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Referral partner -> lead: a reply typed in the dashboard (phase33)
// ---------------------------------------------------------------------------
// Deliberately plain. The proposal letter is a designed piece of marketing; a
// reply in an ongoing conversation is correspondence, and wrapping a two-line
// answer in a branded card with a call-to-action button reads as an automated
// blast rather than a person replying.
//
// So: the same envelope as the rest of the platform's mail, the partner's
// words, their name, and nothing else. `bodyText` is typed by the partner
// and escaped before it becomes HTML; newlines are preserved with white-space
// rather than by building <br> tags out of user input.
export function partnerReplyEmail({ bodyText, partnerName }) {
  const safeBody = escapeHtml(bodyText || '');

  const signatureBlock = partnerName
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 0;border-top:1px solid ${BORDER};">
        <tr><td style="padding:18px 0 0;">
          <p style="margin:0;font-size:13px;line-height:1.7;color:${TEXT_SECONDARY};">${escapeHtml(partnerName)}</p>
        </td></tr>
      </table>`
    : '';

  // The subject is chosen by the caller (it continues the original thread), so
  // the title here is only what a browser tab or an accessibility tree reads.
  const html = layout({
    title: 'Reply',
    preheader: (bodyText || '').slice(0, 140),
    bodyHtml: `
      <p style="margin:0;font-size:15px;line-height:1.7;color:${TEXT_SECONDARY};white-space:pre-line;">${safeBody}</p>
      ${signatureBlock}`,
  });

  const text = [
    bodyText || '',
    ...(partnerName ? ['', partnerName] : []),
  ].join('\n');

  return { html, text };
}

// ---------------------------------------------------------------------------
// Investor campaigns (phase39, client 10-11 Oct)
// ---------------------------------------------------------------------------
// `body` is admin-authored PLAIN TEXT, same contract as contract_templates.body
// (phase29) — split on blank lines into paragraphs, never interpreted as HTML,
// so nothing typed in the campaign composer can inject markup. escapeHtml runs
// on each paragraph before it is wrapped.
//
// `unsubscribeUrl` is REQUIRED, not optional — this is a recurring marketing
// send to an external list, and every regime it could be regulated under
// (CAN-SPAM, PECR/GDPR, ...) requires a working opt-out on every send. Throws
// rather than silently omitting it, so a caller can't accidentally ship a
// non-compliant email by forgetting the argument.
//
// Design, 11 Oct: the plain-paragraphs-in-a-box version read as an internal
// notice, not something a VC fund expects from a company courting them.
// Re-styled as an investor-relations update: a small "INVESTOR UPDATE"
// eyebrow above the subject as the headline, generous paragraph spacing, one
// deliberate CTA (gives Resend's click-tracking something real to track, not
// decoration), and closed with Midhat's own signature rather than a generic
// "the team" sign-off — the same personal register investorOutreachEmail
// already uses for one-to-one fund outreach, kept consistent here for the
// recurring version.
export function investorCampaignEmail({ subject, body: bodyText, unsubscribeUrl, ctaUrl }) {
  if (!unsubscribeUrl) {
    throw new Error('investorCampaignEmail: unsubscribeUrl is required on every send');
  }
  const safeSubject = escapeHtml(subject || '');
  const paragraphs = String(bodyText || '')
    .split(/\n{2,}/)
    .map((block) => escapeHtml(block).replace(/\n/g, '<br>'))
    .filter(Boolean);
  const bodyHtml = paragraphs.map((p) => body(p)).join('');
  const resolvedCtaUrl = escapeHtml(ctaUrl || 'https://certify.cx');

  const headerHtml = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td style="vertical-align:middle;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              <td style="padding-right:12px;vertical-align:middle;">${logoMark(36)}</td>
              <td style="vertical-align:middle;">${wordmark(22)}</td>
            </tr>
          </table>
        </td>
        <td align="right" style="vertical-align:middle;">
          <span style="font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:${TEXT_TERTIARY};">Investor Update</span>
        </td>
      </tr>
    </table>`;

  const html = layout({
    title: safeSubject,
    preheader: paragraphs[0]?.replace(/<br>/g, ' ').slice(0, 140),
    headerHtml,
    bodyHtml: `
      ${heading(safeSubject)}
      ${bodyHtml}
      <p style="margin:8px 0 28px;">${button(resolvedCtaUrl, 'Visit Certify.cx')}</p>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 0;border-top:1px solid ${BORDER};">
        <tr><td style="padding:22px 0 0;">
          <p style="margin:0 0 2px;font-size:14px;line-height:1.6;color:${TEXT_PRIMARY};font-weight:600;">Midhat Abu Ghazaleh</p>
          <p style="margin:0;font-size:13px;line-height:1.5;color:${TEXT_TERTIARY};">Founder &amp; CEO — ${BRAND_TEXT}</p>
        </td></tr>
      </table>`,
    footerHtml: `
      <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:${TEXT_SECONDARY};">
        Reach us at <a href="mailto:${SUPPORT_EMAIL}" style="color:${ACCENT_ON_WHITE};text-decoration:none;font-weight:500;">${SUPPORT_EMAIL}</a>.
      </p>
      <p style="margin:0;font-size:12px;line-height:1.6;color:${TEXT_TERTIARY};">
        ${BRAND_TEXT}™ — ISO certification, simplified. ·
        <a href="${escapeHtml(unsubscribeUrl)}" style="color:${TEXT_TERTIARY};text-decoration:underline;">Unsubscribe</a>
      </p>`,
  });

  const text = [
    String(bodyText || ''),
    ``,
    `Visit Certify.cx: ${ctaUrl || 'https://certify.cx'}`,
    ``,
    `Midhat Abu Ghazaleh`,
    `Founder & CEO — ${BRAND_TEXT}`,
    ``,
    `Unsubscribe: ${unsubscribeUrl}`,
  ].join('\n');

  return { subject, html, text };
}
