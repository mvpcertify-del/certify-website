// ============================================================================
// The per-thread Reply-To address (phase33)
// ============================================================================
// A reply has to come back to the RIGHT partner's thread. The address it is
// sent to is what carries that answer: every conversation gets a random token,
// the token goes into the Reply-To address, and an inbound message is filed by
// reading the token back out of whatever it was addressed to.
//
// WHY NOT MATCH ON THE SENDER'S EMAIL INSTEAD:
// Because it does not work. A lead replies from a personal address, or from a
// shared inbox, or a colleague they forwarded it to replies instead — and none
// of those match the address that was written to. Worse, when the same company
// is a lead of TWO partners, the sender's address identifies the company but
// not which partner's thread it belongs to, which is precisely the case the
// client's "will not be displayed to other RPs" is about. A token has exactly
// one owner.
//
// WHY A SEPARATE DOMAIN, AND WHY support@certify.cx IS NOT TOUCHED:
// Receiving mail means pointing an MX record at a mail provider. If
// certify.cx's MX were repointed, wherever support@certify.cx delivers TODAY
// would stop receiving — and nobody has confirmed what that is. A subdomain
// (reply.certify.cx) has its own MX record and cannot affect the parent domain
// at all. The letter still DISPLAYS support@certify.cx to the reader; only the
// machine-readable Reply-To differs, which no recipient looks at.
//
// UNTIL THE DNS EXISTS, THIS IS ALL INERT. With no env var set, buildReplyTo()
// returns null and the callers fall back to the partner's own address — which
// is exactly the behaviour before this feature, so nothing regresses and no
// reply is lost while the record is being added.
// ============================================================================

import { randomBytes } from 'node:crypto';

// Two supported shapes, because inbound providers differ on what they accept:
//
//  INBOUND_REPLY_ADDRESS = 'partners@reply.certify.cx'
//      Plus-addressing: partners+<token>@reply.certify.cx. Use this when the
//      provider routes ONE named address rather than the whole domain.
//
//  INBOUND_REPLY_DOMAIN = 'reply.certify.cx'
//      Sub-addressing on a catch-all: p.<token>@reply.certify.cx. Use this
//      when the provider forwards every address on the domain.
//
// ADDRESS takes precedence: it is the more specific statement of intent.
const INBOUND_REPLY_ADDRESS = (process.env.INBOUND_REPLY_ADDRESS || '').trim();
const INBOUND_REPLY_DOMAIN = (process.env.INBOUND_REPLY_DOMAIN || '').trim();

// 16 bytes -> 32 hex characters. Unguessable by any practical means, which
// matters: anyone who knows a token can post into that thread by emailing it.
// It is a bearer secret, not an identifier, so it is never displayed anywhere.
const TOKEN_BYTES = 16;

export function newReplyToken() {
  return randomBytes(TOKEN_BYTES).toString('hex');
}

// Is inbound configured at all? Callers use this to decide whether to open a
// conversation, so no empty threads accumulate before the DNS exists.
export function inboundConfigured() {
  return Boolean(INBOUND_REPLY_ADDRESS || INBOUND_REPLY_DOMAIN);
}

// The address a reply to this thread should be sent to, or null when inbound
// is not configured.
export function buildReplyTo(token) {
  if (!token) return null;

  if (INBOUND_REPLY_ADDRESS) {
    const at = INBOUND_REPLY_ADDRESS.lastIndexOf('@');
    if (at <= 0) return null;
    const local = INBOUND_REPLY_ADDRESS.slice(0, at);
    const domain = INBOUND_REPLY_ADDRESS.slice(at + 1);
    return `${local}+${token}@${domain}`;
  }

  if (INBOUND_REPLY_DOMAIN) return `p.${token}@${INBOUND_REPLY_DOMAIN}`;

  return null;
}

// Pull a token out of one address. Handles both shapes above, and tolerates
// the display-name form ("Certify Partners" <p.abc@x>) that some providers
// hand back in the `to` field.
//
// Case-insensitive on the token because a few mail systems normalise the local
// part; the stored tokens are lowercase hex, so lowercasing here is safe and
// makes the comparison total.
const TOKEN_RE = /(?:\+|^p\.|\.)([0-9a-f]{32})(?=@|$)/i;

export function extractToken(address) {
  if (!address || typeof address !== 'string') return null;
  // Strip a display name and angle brackets if present.
  const angled = address.match(/<([^>]+)>/);
  const bare = (angled ? angled[1] : address).trim().toLowerCase();
  const local = bare.split('@')[0] || '';
  const m = local.match(TOKEN_RE) || bare.match(TOKEN_RE);
  return m ? m[1].toLowerCase() : null;
}

// Scan every recipient field a provider might populate and return the first
// token found.
//
// `to` is checked before `cc`, but both are checked: a lead who hits "Reply
// All" can easily land our address in Cc, and a thread that silently failed to
// match because of that would be indistinguishable from a lost reply.
export function extractTokenFromRecipients(...fields) {
  for (const field of fields) {
    if (!field) continue;
    const list = Array.isArray(field) ? field : [field];
    for (const entry of list) {
      // Providers variously send a string, {address}, {email}, or {value}.
      const addr = typeof entry === 'string'
        ? entry
        : entry?.address || entry?.email || entry?.value || '';
      // One field can hold a comma-separated list.
      for (const part of String(addr).split(',')) {
        const token = extractToken(part);
        if (token) return token;
      }
    }
  }
  return null;
}
