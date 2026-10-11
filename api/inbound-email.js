// ============================================================================
// Inbound email — a client's reply lands in the partner's dashboard (phase33)
// ============================================================================
// Client request (27 Aug), point 2:
//   "Replies from Clients will be directed to the notification dashboard of
//    the referral partner + Linked Country Admin + Super Admin. The reply from
//    client should be linked to the (Referral Partner) RP & will not be
//    displayed to other RPs."
//
// This is the receiver. A mail provider POSTs a parsed inbound message here;
// the thread is identified by the token in the address it was sent to, the
// message is filed, and three parties are notified.
//
// ---------------------------------------------------------------------------
// SETUP (the one part that is not code)
// ---------------------------------------------------------------------------
//  1. Add an MX record for a SUBDOMAIN — reply.certify.cx — pointing at the
//     inbound provider. A subdomain is used specifically so that certify.cx's
//     own MX is never touched and support@certify.cx keeps delivering wherever
//     it delivers today.
//  2. Point the provider's inbound webhook at:  {APP_URL}/api/inbound-email
//  3. Set INBOUND_WEBHOOK_SECRET to the provider's signing secret.
//  4. Set INBOUND_REPLY_DOMAIN=reply.certify.cx (or INBOUND_REPLY_ADDRESS if
//     the provider routes a single named address — see api/_replyAddress.js).
//
// Until step 4 is done, no letter carries a routable Reply-To, so nothing
// arrives here and replies continue to reach the partner's own mailbox. That
// is the pre-existing behaviour: nothing regresses while DNS is pending.
//
// ---------------------------------------------------------------------------
// WHY THE SIGNATURE CHECK IS NOT OPTIONAL
// ---------------------------------------------------------------------------
// This endpoint writes messages that Super Admins read, attributed to a named
// client. Unauthenticated, it is a public API for putting words in a
// customer's mouth inside someone else's admin panel. The request is rejected
// unless it is signed, and it is rejected outright when no secret is
// configured — failing closed, because a "temporarily open while we set it up"
// webhook is exactly the one that stays open.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { Webhook } from 'standardwebhooks';
import { extractTokenFromRecipients } from './_replyAddress.js';
import { appendMessage } from './_conversations.js';
import { notifyAdmins } from './_notifyAdmins.js';
import { sendViaResend } from './_resendClient.js';
import { adminAlertEmail } from './_emailTemplates.js';
import { APP_URL } from './_appUrl.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const INBOUND_WEBHOOK_SECRET = process.env.INBOUND_WEBHOOK_SECRET;

// Investor-campaign tracking events (phase39, 10-11 Oct) — email.opened/
// clicked/bounced/complained/delivered. This is a SEPARATE webhook
// subscription in Resend from the inbound-receiving one above (Resend signs
// each webhook endpoint with its own secret), so it needs its own secret
// even though both land on this same URL. Set it to whatever secret Resend
// shows when you add that second endpoint, pointed at
// {APP_URL}/api/inbound-email, subscribed to the email.* delivery events.
const RESEND_WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET;

// Used to pull the message body back (see fetchBody). The same key that sends.
const RESEND_API_KEY = process.env.RESEND_API_KEY;

// Vercel hands the body already parsed for application/json. Signature
// verification needs the EXACT bytes that were signed, so the raw stream is
// preferred and the re-serialised object is only a fallback.
async function readRawBody(req) {
  if (typeof req.body === 'string') return req.body;
  if (Buffer.isBuffer(req.body)) return req.body.toString('utf8');
  if (req.body && typeof req.body === 'object') return JSON.stringify(req.body);
  return await new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => { data += chunk; });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

// standard-webhooks names the headers `webhook-*`; Svix (which Resend uses)
// sends the same values as `svix-*`. Accept either rather than depending on
// which one the provider happens to emit.
function webhookHeaders(req) {
  const h = req.headers || {};
  return {
    'webhook-id': h['webhook-id'] || h['svix-id'],
    'webhook-timestamp': h['webhook-timestamp'] || h['svix-timestamp'],
    'webhook-signature': h['webhook-signature'] || h['svix-signature'],
  };
}

// Providers disagree on the shape of an address field: a bare string, an
// object with `address`, `email` or `value`, or an array of any of those.
// Normalise to { email, name }.
function firstAddress(field) {
  const list = Array.isArray(field) ? field : [field];
  for (const entry of list) {
    if (!entry) continue;
    if (typeof entry === 'string') {
      const angled = entry.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
      if (angled) return { email: angled[2].trim(), name: angled[1].replace(/^"|"$/g, '') || null };
      return { email: entry.trim(), name: null };
    }
    const email = entry.address || entry.email || entry.value || null;
    if (email) return { email: String(email).trim(), name: entry.name || null };
  }
  return { email: null, name: null };
}

// The payload envelope differs between providers and between provider
// versions, so the message is looked for in the two places it is ever put
// rather than assuming one.
function unwrap(payload) {
  return payload?.data && typeof payload.data === 'object' ? payload.data : payload;
}

// Fetch the message body.
//
// Resend's `email.received` webhook carries METADATA ONLY — from, to, cc,
// subject, and a list of attachments. The body is deliberately not in the
// payload (it keeps a large message from having to fit through a serverless
// function's request limit), and is retrieved separately by id:
//
//   GET https://api.resend.com/emails/receiving/{email_id}
//
// So a reply filed straight from the webhook would be an empty message with a
// subject line and nothing under it. This is the call that makes the inbox
// show what the client actually wrote.
//
// Best-effort: a failure here is logged and the message is still filed with
// whatever the webhook did carry. A reply that arrives with a subject and no
// body at least tells the partner someone answered; dropping it entirely
// because one HTTP call failed would be worse.
async function fetchBody(emailId) {
  if (!emailId || !RESEND_API_KEY) return null;
  try {
    const resp = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
      headers: { Authorization: `Bearer ${RESEND_API_KEY}` },
    });
    if (!resp.ok) {
      console.error('inbound-email: body fetch failed', resp.status, await resp.text().catch(() => ''));
      return null;
    }
    const full = await resp.json();
    // text/plain only. `html` is deliberately ignored — see the column comment
    // in phase33: it is a stranger's markup headed for an admin's screen.
    return full?.text || full?.data?.text || null;
  } catch (err) {
    console.error('inbound-email: body fetch threw', err?.message);
    return null;
  }
}

// Investor-campaign recipient events this endpoint tracks. Deliberately NOT
// in this list, because no sender-side webhook anywhere can report it: "landed
// in spam/junk". bounced/complained are the real, trackable proxy for
// deliverability health — see api/_investorCampaigns.js's header comment.
const CAMPAIGN_EVENT_STATUS = {
  'email.delivered': 'delivered',
  'email.opened': 'opened',
  'email.clicked': 'clicked',
  'email.bounced': 'bounced',
  'email.complained': 'complained',
};

export default async function handler(req, res) {
  // Unsubscribe link from an investor campaign email (phase39) — a plain GET,
  // no signature: the link itself (an unguessable investor uuid) is the only
  // credential a one-click unsubscribe needs, same as every bulk-mail sender.
  //
  // Parsed off req.url directly rather than req.query: the local dev shim
  // (vite.config.js's vercelApiPlugin) never populates req.query, only real
  // Vercel does, and this has to work identically in both.
  if (req.method === 'GET') {
    const unsubscribeId = new URL(req.url, 'http://localhost').searchParams.get('unsubscribe');
    if (unsubscribeId) {
      const { error } = await supabaseAdmin
        .from('investors')
        .update({ unsubscribed_at: new Date().toISOString() })
        .eq('id', unsubscribeId);
      res.statusCode = error ? 500 : 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.end(error
        ? '<p>Something went wrong. Please email support@certify.cx to be removed.</p>'
        : '<p>You have been unsubscribed from Certify.cx investor updates.</p>');
    }
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  if (!INBOUND_WEBHOOK_SECRET && !RESEND_WEBHOOK_SECRET) {
    console.error('inbound-email: neither INBOUND_WEBHOOK_SECRET nor RESEND_WEBHOOK_SECRET is set — refusing');
    return res.status(503).json({ error: 'Inbound email is not configured' });
  }

  // Two independent webhook subscriptions land on this one URL (see the
  // RESEND_WEBHOOK_SECRET comment above), each signed with its own secret —
  // try whichever is configured rather than assuming which one sent this
  // request.
  let payload;
  let verifyErr;
  const raw = await readRawBody(req);
  for (const secret of [INBOUND_WEBHOOK_SECRET, RESEND_WEBHOOK_SECRET]) {
    if (!secret) continue;
    try {
      payload = new Webhook(secret.replace(/^v1,whsec_/, '')).verify(raw, webhookHeaders(req));
      verifyErr = null;
      break;
    } catch (err) {
      verifyErr = err;
    }
  }
  if (!payload) {
    console.error('inbound-email: signature verification failed', verifyErr?.message);
    return res.status(401).json({ error: 'Invalid signature' });
  }

  // Investor-campaign tracking events — handled and returned here, before the
  // inbound-reply logic below (which assumes a received message, not a
  // delivery event) ever sees them.
  const campaignEventType = payload?.type;
  if (campaignEventType && CAMPAIGN_EVENT_STATUS[campaignEventType]) {
    return handleCampaignEvent(req, res, payload);
  }

  try {
    const msg = unwrap(payload);

    // Providers also emit delivery/bounce events on the same webhook. Anything
    // that is not a received message is acknowledged and ignored — a non-2xx
    // here would have the provider retry an event we will never want.
    const eventType = payload?.type || payload?.event || '';
    if (eventType && !/received|inbound/i.test(eventType)) {
      return res.status(200).json({ ok: true, ignored: eventType });
    }

    const token = extractTokenFromRecipients(msg?.to, msg?.cc, msg?.envelope?.to, msg?.recipient);
    const from = firstAddress(msg?.from);
    const to = firstAddress(msg?.to);

    let conversation = null;

    if (token) {
      const { data } = await supabaseAdmin
        .from('partner_conversations')
        .select('id, referrer_id, region, lead_email, lead_name, subject')
        .eq('reply_token', token)
        .maybeSingle();
      conversation = data || null;
    }

    // Same token, but it's a reply to an investor campaign (phase39), not a
    // referral-partner lead — checked before the conversation fallback below,
    // same priority order as the partner_conversations check just above: an
    // exact token match is never a guess, so it always wins over one.
    if (!conversation && token) {
      const { data: byToken } = await supabaseAdmin
        .from('investor_campaign_recipients')
        .select('id, replied_at')
        .eq('reply_token', token)
        .maybeSingle();
      if (byToken && !byToken.replied_at) {
        await supabaseAdmin
          .from('investor_campaign_recipients')
          .update({ replied_at: new Date().toISOString() })
          .eq('id', byToken.id);
      }
      if (byToken) {
        return res.status(200).json({ ok: true, matched: true, kind: 'investor_campaign_reply' });
      }
    }

    // Last resort: no token in any recipient field, but the sender is a lead
    // we have written to. This covers a reply composed fresh rather than
    // hit-reply (the address is then whatever they typed) and forwards that
    // lose the original headers.
    //
    // It is deliberately narrow — the most recent thread for that exact lead
    // address — and it is the ONLY path here that can guess. When the same
    // lead belongs to two partners it will pick the more recent thread, which
    // is a guess; the token path never guesses, which is why the address is
    // built the way it is.
    if (!conversation && from.email) {
      const { data } = await supabaseAdmin
        .from('partner_conversations')
        .select('id, referrer_id, region, lead_email, lead_name, subject')
        .eq('lead_email', from.email.toLowerCase())
        .order('last_message_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      conversation = data || null;
      if (conversation) {
        console.warn('inbound-email: matched by sender address, no token present', from.email);
      }
    }

    // Not a referral-partner lead reply — check whether it's a reply to an
    // investor campaign instead (phase39), matched the same "last resort" way:
    // most recent send to that exact address. There is no per-thread token
    // here (campaign mail doesn't route through reply.certify.cx), so this
    // is the only signal available; same guess-when-ambiguous trade-off as
    // the partner_conversations fallback just above.
    if (!conversation && from.email) {
      const { data: recipientRow } = await supabaseAdmin
        .from('investor_campaign_recipients')
        .select('id, replied_at')
        .eq('email', from.email.toLowerCase())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (recipientRow && !recipientRow.replied_at) {
        await supabaseAdmin
          .from('investor_campaign_recipients')
          .update({ replied_at: new Date().toISOString() })
          .eq('id', recipientRow.id);
      }
      if (recipientRow) {
        return res.status(200).json({ ok: true, matched: true, kind: 'investor_campaign_reply' });
      }
    }

    if (!conversation) {
      // Nothing to attach it to. Acknowledged so the provider stops retrying,
      // and logged loudly because a run of these means the Reply-To is not
      // surviving the round trip.
      console.warn('inbound-email: unmatched message', {
        from: from.email, to: to.email, subject: msg?.subject,
      });
      return res.status(200).json({ ok: true, matched: false });
    }

    // Some providers put the body in the webhook; Resend does not, and needs a
    // second call for it. Both are handled — the payload is checked first so
    // no needless request is made when the text is already here.
    const emailId = msg?.email_id || msg?.emailId || msg?.id || null;
    const bodyText = msg?.text || msg?.plain || msg?.body_plain || await fetchBody(emailId);

    const appended = await appendMessage(supabaseAdmin, conversation.id, {
      direction: 'inbound',
      fromEmail: from.email,
      fromName: from.name,
      toEmail: to.email,
      subject: msg?.subject || conversation.subject,
      bodyText,
      // The provider's own id for this message, which is what makes a
      // redelivery a no-op rather than a duplicate reply.
      providerMessageId: emailId || msg?.message_id || msg?.messageId || payload?.id || null,
    });

    // A redelivery of something already filed. Acknowledged without notifying
    // anyone a second time.
    if (appended?.duplicate) {
      return res.status(200).json({ ok: true, duplicate: true });
    }

    // The message could not be stored. Notifying now would tell three people to
    // go and read a reply that is not in the inbox. 500 instead, so the
    // provider redelivers and we get another chance at the real thing.
    if (!appended?.id) {
      console.error('inbound-email: could not store message for thread', conversation.id);
      return res.status(500).json({ error: 'Could not store the message' });
    }

    await notifyEveryone(conversation, from, msg?.subject, bodyText);

    return res.status(200).json({ ok: true, matched: true });
  } catch (err) {
    // A real failure on our side. 500 asks the provider to retry, which is
    // right: the message exists and we want it.
    console.error('inbound-email error:', err);
    return res.status(500).json({ error: 'Could not process the message' });
  }
}

// Investor-campaign delivery/engagement event (phase39) — matched to the
// recipient row primarily by the tags echoed back on the webhook payload
// (set at send time in api/_investorCampaigns.js), falling back to the
// Resend message id for an older payload shape that carries tags
// differently. Status only ever moves forward (see the column comment on
// investor_campaign_recipients in phase39) — an out-of-order delivery of a
// webhook retry can't downgrade a row from 'opened' back to 'delivered'.
const STATUS_RANK = ['queued', 'sent', 'delivered', 'opened', 'clicked'];
async function handleCampaignEvent(req, res, payload) {
  try {
    const data = unwrap(payload);
    const tags = Array.isArray(data?.tags) ? data.tags : [];
    const tag = (name) => tags.find((t) => t?.name === name)?.value || null;
    const recipientId = tag('recipient_id');
    const emailId = data?.email_id || data?.id || null;
    const newStatus = CAMPAIGN_EVENT_STATUS[payload.type];
    const now = new Date().toISOString();

    const { data: row } = recipientId
      ? await supabaseAdmin.from('investor_campaign_recipients').select('*').eq('id', recipientId).maybeSingle()
      : emailId
        ? await supabaseAdmin.from('investor_campaign_recipients').select('*').eq('resend_message_id', emailId).maybeSingle()
        : { data: null };

    if (!row) {
      console.warn('inbound-email: campaign event unmatched', payload.type, recipientId || emailId);
      return res.status(200).json({ ok: true, matched: false });
    }

    const updates = {};
    if (newStatus === 'bounced') {
      updates.status = 'bounced';
      updates.bounced_at = now;
      updates.bounce_reason = data?.bounce?.message || data?.reason || null;
    } else if (newStatus === 'complained') {
      updates.status = 'complained';
      updates.complained_at = now;
    } else {
      // delivered/opened/clicked only ever move status forward.
      const currentRank = STATUS_RANK.indexOf(row.status);
      const newRank = STATUS_RANK.indexOf(newStatus);
      if (newRank > currentRank) updates.status = newStatus;
      if (newStatus === 'delivered') updates.delivered_at = updates.delivered_at || row.delivered_at || now;
      if (newStatus === 'opened') updates.opened_at = row.opened_at || now;
      if (newStatus === 'clicked') updates.first_clicked_at = row.first_clicked_at || now;
    }

    if (Object.keys(updates).length) {
      await supabaseAdmin.from('investor_campaign_recipients').update(updates).eq('id', row.id);
    }
    return res.status(200).json({ ok: true, matched: true });
  } catch (err) {
    console.error('inbound-email: campaign event error', err?.message);
    // 200, not 500 — a malformed/unexpected event payload must not make
    // Resend retry forever; the worst case is one missed tracking update.
    return res.status(200).json({ ok: false, error: err.message });
  }
}

// The three parties the client named: the owning partner, their Country Admin,
// and Super Admin. notifyAdmins already implements "every super_admin plus the
// regional_admin for this region", so only the partner is handled here.
async function notifyEveryone(conversation, from, subject, bodyText) {
  const who = from.name || from.email || 'A client';
  const title = 'New reply from a client';
  const line = subject ? `${who} replied: "${String(subject).slice(0, 120)}"` : `${who} replied to your email.`;

  const { data: partner } = await supabaseAdmin
    .from('profiles')
    .select('id, email, full_name')
    .eq('id', conversation.referrer_id)
    .maybeSingle();

  // In-app, for the partner.
  if (partner?.id) {
    await supabaseAdmin
      .from('notifications')
      .insert({ user_id: partner.id, type: 'system', title, message: line })
      .then(() => {}, (e) => console.error('inbound-email: partner notification failed', e?.message));
  }

  // Email, for the partner. Best-effort: the reply is already safely filed and
  // visible in the dashboard, so a mail hiccup must not fail the webhook and
  // trigger a redelivery of a message we have already stored.
  if (partner?.email) {
    const { subject: s, html, text } = adminAlertEmail({
      title,
      message: line,
      actionUrl: `${APP_URL}/messages`,
      details: [
        ['From', from.email || '—'],
        ['Subject', subject || '—'],
        ['Message', (bodyText || '').slice(0, 600) || '—'],
      ],
    });
    await sendViaResend({ to: partner.email, subject: s, html, text })
      .catch((e) => console.error('inbound-email: partner email failed', e?.message));
  }

  // Country Admin + Super Admin.
  await notifyAdmins(supabaseAdmin, {
    title,
    message: `${line} (partner: ${partner?.full_name || partner?.email || conversation.referrer_id})`,
    region: conversation.region || null,
    details: [
      ['Partner', partner?.full_name || partner?.email || '—'],
      ['Client', from.email || '—'],
      ['Subject', subject || '—'],
    ],
  });
}
