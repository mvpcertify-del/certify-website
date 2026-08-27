// ============================================================================
// Partner inbox writes — mark a thread read, reply to a client (phase33)
// ============================================================================
// Reading the inbox does NOT come through here: the browser selects
// partner_conversations / partner_messages directly and the RLS policies from
// phase33 decide what comes back. That keeps one copy of the visibility rule,
// in the database, rather than a second one here that could drift from it.
//
// Writes cannot work that way. Both tables carry no write policy on purpose,
// so every mutation runs here under the service role after an explicit
// ownership check.
//
// WHO MAY REPLY: the owning partner, and only them. The client's request is
// that a reply "should be linked to the (Referral Partner) RP" — an admin
// answering a client from the partner's thread would break exactly that link,
// and the client on the far end would have no idea the person had changed.
// Admins read; the partner speaks.
// ============================================================================

import { createClient } from '@supabase/supabase-js';
import { verifySession } from './_verifyAdmin.js';
import { appendMessage } from './_conversations.js';
import { buildReplyTo } from './_replyAddress.js';
import { partnerReplyEmail } from './_emailTemplates.js';
import { sendViaResend } from './_resendClient.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Long enough for a real business reply, short enough that the endpoint cannot
// be used to mail a novel to a stranger from the company's domain.
const MAX_REPLY_CHARS = 5000;

const SIGNATURE_MAX_LEN = 600;

const partnerActive = (caller) =>
  (caller.role === 'referral' || caller.role === 'consultancy') &&
  caller.approval_status !== 'pending' &&
  caller.approval_status !== 'rejected';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const action = req.body?.action;

  try {
    if (action === 'mark-read') return await markRead(req, res);
    if (action === 'reply') return await reply(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    console.error(`partner-messages action "${action}" error:`, error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

// Load a thread and confirm the caller owns it. Returns the conversation, or
// null after sending the response.
async function loadOwnThread(req, res, conversationId) {
  const auth = await verifySession(req);
  if (auth.error) { res.status(auth.status).json({ error: 'Please sign in again' }); return null; }
  const caller = auth.caller;

  if (!conversationId) { res.status(400).json({ error: 'Missing conversation' }); return null; }

  const { data: conversation } = await supabaseAdmin
    .from('partner_conversations')
    .select('id, referrer_id, lead_email, lead_name, subject, reply_token')
    .eq('id', conversationId)
    .maybeSingle();

  // Same 404 for "does not exist" and "is not yours": a distinct 403 would
  // confirm the existence of another partner's thread to anyone who guessed an
  // id, which is the disclosure the client asked to prevent.
  if (!conversation || conversation.referrer_id !== caller.id) {
    res.status(404).json({ error: 'Conversation not found' });
    return null;
  }

  return { caller, conversation };
}

// ---- Clear the unread badge --------------------------------------------
async function markRead(req, res) {
  const ctx = await loadOwnThread(req, res, req.body?.conversationId);
  if (!ctx) return;

  const { error } = await supabaseAdmin
    .from('partner_conversations')
    .update({ has_unread: false })
    .eq('id', ctx.conversation.id);

  if (error) {
    console.error('partner-messages mark-read error:', error.message);
    return res.status(500).json({ error: 'Could not update the conversation.' });
  }

  return res.status(200).json({ ok: true });
}

// ---- Reply to the client from the dashboard ----------------------------
async function reply(req, res) {
  const ctx = await loadOwnThread(req, res, req.body?.conversationId);
  if (!ctx) return;
  const { caller, conversation } = ctx;

  if (!partnerActive(caller)) {
    return res.status(403).json({ error: 'Only approved referral partners can reply' });
  }

  const bodyText = String(req.body?.body || '').trim().slice(0, MAX_REPLY_CHARS);
  if (!bodyText) return res.status(400).json({ error: 'Write a message first' });

  const { data: partner } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, email_signature')
    .eq('id', caller.id)
    .maybeSingle();

  const signature = partner?.email_signature
    ? String(partner.email_signature).slice(0, SIGNATURE_MAX_LEN)
    : null;

  // "Re:" is added once, not stacked — a thread replied to five times should
  // not read "Re: Re: Re: Re: Re:".
  const base = conversation.subject || 'Your enquiry';
  const subject = /^re:/i.test(base) ? base : `Re: ${base}`;

  const { html, text } = partnerReplyEmail({
    bodyText,
    signature,
    partnerName: partner?.full_name,
  });

  // Reply-To stays the thread address so the NEXT reply comes back here too,
  // rather than escaping to the partner's personal mailbox after one round.
  const replyTo = buildReplyTo(conversation.reply_token);

  let sent;
  try {
    sent = await sendViaResend({
      to: conversation.lead_email,
      subject,
      html,
      text,
      ...(replyTo ? { replyTo } : {}),
    });
  } catch (err) {
    console.error('partner-messages reply: send failed', err?.message);
    return res.status(502).json({ error: 'Could not send the reply. Please try again.' });
  }

  await appendMessage(supabaseAdmin, conversation.id, {
    direction: 'outbound',
    fromEmail: partner?.email || null,
    fromName: partner?.full_name || null,
    toEmail: conversation.lead_email,
    subject,
    bodyText,
    providerMessageId: sent?.id || null,
  });

  return res.status(200).json({ ok: true });
}
