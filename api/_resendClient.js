// Shared Resend sender for business/notification emails.
//
// Mirrors the inline pattern already used in send-welcome.js and
// auth-email-hook.js, centralized here so the new lifecycle emails
// (payment, application, audit, certificate) don't each re-implement it.
//
// Business emails send from the SUPPORT identity (support@certify.cx) so that
// customer replies land in the support inbox — this is what the marketing
// flow requires. The from-address is configurable; it falls back to the
// generic transactional from-address, then to a hardcoded support default.

const RESEND_API_KEY = process.env.RESEND_API_KEY;

const SUPPORT_FROM_EMAIL =
  process.env.RESEND_SUPPORT_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  'Certify.cx Support <support@certify.cx>';

/**
 * Send one email via the Resend HTTP API.
 * Throws on a missing API key or any non-2xx Resend response.
 *
 * @param {object} p
 * @param {string} p.to      recipient address
 * @param {string} p.subject email subject
 * @param {string} p.html    HTML body
 * @param {string} p.text    plain-text fallback
 * @param {string} [p.from]  optional override of the from-address
 * @param {Array<{filename: string, content: string}>} [p.attachments]
 *        optional file attachments; `content` must be base64-encoded.
 *        Used by the billing documents (invoice / payment receipt PDFs).
 */
export async function sendViaResend({ to, subject, html, text, from, attachments }) {
  if (!RESEND_API_KEY) {
    throw new Error('RESEND_API_KEY not configured');
  }
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || SUPPORT_FROM_EMAIL,
      to: [to],
      subject,
      html,
      text,
      // Omitted entirely when absent — Resend rejects an empty array.
      ...(attachments && attachments.length ? { attachments } : {}),
    }),
  });
  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    throw new Error(`Resend ${resp.status}: ${detail}`);
  }
  return resp.json();
}
