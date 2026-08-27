// ============================================================================
// Partner conversations — open a thread, file a message (phase33)
// ============================================================================
// Shared by everything that sends or receives partner mail: the proposal letter
// and the registration invite (api/referrals.js), the inbound webhook
// (api/inbound-email.js), and the reply box in the dashboard
// (api/partner-messages.js).
//
// It lives in one file because the alternative — each caller doing its own
// insert — is how a thread ends up with the wrong region stamped on it, which
// silently hands it to the wrong Country Admin.
//
// Everything here runs under the service role. The tables carry no write
// policy by design (see supabase/phase33_partner_inbox.sql).
// ============================================================================

import { newReplyToken, buildReplyTo, inboundConfigured } from './_replyAddress.js';

// Bound what we store from an inbound message. A mail body is attacker-chosen
// in both content and LENGTH, and a thread rendered in an admin's browser
// should not be able to carry a megabyte of anything. Long enough that a real
// business reply is never clipped.
const MAX_BODY_CHARS = 20000;
const MAX_SUBJECT_CHARS = 500;

const clip = (v, max) => (v == null ? null : String(v).slice(0, max));

// Find the partner's existing thread with this lead, or start one.
//
// Reused rather than created per letter: a partner who sends a proposal and
// then an invite to the same lead is having ONE conversation with them, and
// two threads would split the replies across two places. The token is
// therefore stable per (partner, lead) — which is also what lets a lead reply
// to the older letter months later and still land in the right thread.
//
// Returns { conversation, replyTo } or null when inbound is not configured —
// callers treat null as "send with the old Reply-To and do not open a thread",
// so no empty threads pile up before the DNS record exists.
export async function ensureConversation(supabaseAdmin, {
  referrerId,
  referralId = null,
  leadEmail,
  leadName = null,
  standardSlug = null,
  subject = null,
  region = null,
}) {
  if (!inboundConfigured()) return null;
  if (!referrerId || !leadEmail) return null;

  const email = String(leadEmail).trim().toLowerCase();

  const { data: existing } = await supabaseAdmin
    .from('partner_conversations')
    .select('id, reply_token, referrer_id, region')
    .eq('referrer_id', referrerId)
    .eq('lead_email', email)
    .order('last_message_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    // Refresh the region on every send so a partner who has since been moved
    // stops feeding threads to their old Country Admin. Only the columns that
    // can legitimately change are touched — never referrer_id.
    await supabaseAdmin
      .from('partner_conversations')
      .update({
        region: region ?? existing.region,
        last_message_at: new Date().toISOString(),
        ...(standardSlug ? { standard_slug: standardSlug } : {}),
        ...(subject ? { subject: clip(subject, MAX_SUBJECT_CHARS) } : {}),
      })
      .eq('id', existing.id);

    return { conversation: existing, replyTo: buildReplyTo(existing.reply_token), created: false };
  }

  const token = newReplyToken();
  const { data: created, error } = await supabaseAdmin
    .from('partner_conversations')
    .insert({
      referrer_id: referrerId,
      referral_id: referralId,
      lead_email: email,
      lead_name: leadName,
      standard_slug: standardSlug,
      subject: clip(subject, MAX_SUBJECT_CHARS),
      reply_token: token,
      region,
    })
    .select('id, reply_token, referrer_id, region')
    .single();

  if (error || !created) {
    // A thread is a convenience; the letter is the job. Failing the send
    // because the thread could not be opened would be the wrong trade.
    console.error('ensureConversation: insert failed', error?.message);
    return null;
  }

  // `created` lets the caller undo this if the send it was opened for then
  // fails: the thread has to exist BEFORE the letter goes out (its token is in
  // the Reply-To), so a failed send would otherwise leave an empty
  // conversation sitting in the partner's inbox for a letter nobody received.
  return { conversation: created, replyTo: buildReplyTo(created.reply_token), created: true };
}

// Undo a conversation that was opened for a send that then failed. Only ever
// called with `created: true` — an existing thread carries real history and
// must never be removed because one later letter bounced.
export async function discardConversation(supabaseAdmin, conversationId) {
  if (!conversationId) return;
  await supabaseAdmin
    .from('partner_conversations')
    .delete()
    .eq('id', conversationId)
    .then(() => {}, (e) => console.error('discardConversation failed', e?.message));
}

// File a message against a thread and move the thread to the top of the inbox.
//
// `has_unread` is set only by an INBOUND message: a partner's own sent mail is
// not news to them, and marking it unread would make the badge meaningless.
export async function appendMessage(supabaseAdmin, conversationId, {
  direction,
  fromEmail = null,
  fromName = null,
  toEmail = null,
  subject = null,
  bodyText = null,
  providerMessageId = null,
}) {
  if (!conversationId) return null;

  const { data, error } = await supabaseAdmin
    .from('partner_messages')
    .insert({
      conversation_id: conversationId,
      direction,
      from_email: fromEmail,
      from_name: clip(fromName, 200),
      to_email: toEmail,
      subject: clip(subject, MAX_SUBJECT_CHARS),
      body_text: clip(bodyText, MAX_BODY_CHARS),
      provider_message_id: providerMessageId,
    })
    .select('id')
    .single();

  if (error) {
    // 23505 is unique_violation — the provider redelivered a webhook it had
    // already delivered. That is a successful no-op, not a failure, and must
    // NOT be retried: returning an error here would have the provider send it
    // again, forever.
    if (error.code === '23505') return { duplicate: true };
    console.error('appendMessage: insert failed', error.message);
    return null;
  }

  await supabaseAdmin
    .from('partner_conversations')
    .update({
      last_message_at: new Date().toISOString(),
      ...(direction === 'inbound' ? { has_unread: true } : {}),
    })
    .eq('id', conversationId);

  return { id: data.id };
}
