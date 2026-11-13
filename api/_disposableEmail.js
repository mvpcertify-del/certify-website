// Throw-away mailbox providers. Provider roles (certification bodies, auditors,
// consultants, contractors, affiliates) are vetted before they are listed to
// buyers, so a mailbox that disappears in ten minutes has no place there.
// Not exhaustive on purpose: it stops the common services, it is not a promise.

export const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org',
  'guerrillamail.biz', 'guerrillamail.de', 'sharklasers.com', 'grr.la', 'pokemail.net',
  '10minutemail.com', '10minutemail.net', '10minemail.com', 'tempmail.com',
  'temp-mail.org', 'temp-mail.io', 'tempmail.net', 'tempmailo.com', 'tempail.com',
  'throwawaymail.com', 'yopmail.com', 'yopmail.net', 'yopmail.fr', 'trashmail.com',
  'trashmail.net', 'trashmail.de', 'getnada.com', 'nada.email', 'dispostable.com',
  'maildrop.cc', 'mailnesia.com', 'mintemail.com', 'mytemp.email', 'fakeinbox.com',
  'emailondeck.com', 'spamgourmet.com', 'moakt.com', 'mohmal.com', 'burnermail.io',
  'discard.email', 'discardmail.com', 'spambox.us', 'mailcatch.com', 'mailnull.com',
  'inboxkitten.com', 'tmpmail.org', 'tmpmail.net', 'dropmail.me', 'emailfake.com',
  'fakemail.net', 'mail-temp.com', 'tempinbox.com', 'getairmail.com', 'anonbox.net',
  'harakirimail.com', 'mailforspam.com', 'throwam.com', 'tempr.email', 'linshiyouxiang.net',
  '1secmail.com', '1secmail.net', '1secmail.org', 'tmail.ws', 'trbvm.com',
]);

/** True when the address uses a known throw-away mailbox provider (or a subdomain of one). */
export function isDisposableEmail(email) {
  const at = String(email || '').lastIndexOf('@');
  if (at < 0) return false;
  const domain = String(email).slice(at + 1).trim().toLowerCase();
  if (!domain) return false;
  if (DISPOSABLE_DOMAINS.has(domain)) return true;
  const parts = domain.split('.');
  for (let i = 1; i < parts.length - 1; i += 1) {
    if (DISPOSABLE_DOMAINS.has(parts.slice(i).join('.'))) return true;
  }
  return false;
}
