import { createClient } from '@supabase/supabase-js';
import { verifySession } from './_verifyAdmin.js';
import { referralClientInviteEmail } from './_emailTemplates.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL || 'https://certify.cx';

// An optional company-profile PDF / video link included in the invite. The
// client asked for it but has not supplied the asset yet, so the email drops
// the row gracefully when this is unset — no code change needed once they do.
const COMPANY_PROFILE_URL = process.env.COMPANY_PROFILE_URL || null;

// Sending on a partner's behalf through the shared mail.certify.cx domain means
// one partner blasting spam can get the WHOLE platform's mail (verification
// included) flagged. Two independent caps bound that:
//   - a per-partner DAILY cap, and
//   - a per-RECIPIENT lifetime cap, so the recipient is attacker-chosen but a
//     given address can only ever be mailed a couple of times.
// A real partner onboarding a handful of leads never touches either.
const INVITE_DAILY_CAP = 20;
const INVITE_PER_RECIPIENT_CAP = 3;

// Signatures are appended to outbound email; bound the length server-side. The
// browser also caps it, but the browser is not a security control.
const SIGNATURE_MAX_LEN = 600;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// A partner can only act once their account is live. A pending/rejected partner
// must not be able to send branded mail.
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
    if (action === 'list') return await listReferrals(req, res);
    if (action === 'mark-payout') return await markPayout(req, res);
    if (action === 'record') return await recordReferral(req, res);
    if (action === 'check-discount') return await checkDiscount(req, res);
    if (action === 'send-client-invite') return await sendClientInvite(req, res);
    if (action === 'save-signature') return await saveSignature(req, res);
    return res.status(400).json({ error: 'Unknown action' });
  } catch (error) {
    // Log the detail server-side; never hand the raw Postgres/PostgREST text to
    // the caller — combined with a crafted input it is a schema-probing leak.
    console.error(`Referrals action "${action}" error:`, error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}

async function listReferrals(req, res) {
  const { adminId } = req.body;
  if (!adminId) return res.status(400).json({ error: 'Missing adminId' });

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', adminId)
    .maybeSingle();

  if (!profile || profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { data: referrals, error } = await supabaseAdmin
    .from('referrals')
    .select('*')
    .eq('status', 'converted')
    .order('converted_at', { ascending: false });

  if (error) throw error;

  const referrerIds = [...new Set(referrals.map(r => r.referrer_id))];
  let referrerMap = {};
  if (referrerIds.length > 0) {
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, email:id')
      .in('id', referrerIds);

    for (const rid of referrerIds) {
      const { data: u } = await supabaseAdmin.auth.admin.getUserById(rid);
      if (u?.user) {
        const prof = profiles?.find(p => p.id === rid);
        referrerMap[rid] = {
          name: prof?.full_name || 'Unknown',
          email: u.user.email,
        };
      }
    }
  }

  const enriched = referrals.map(r => ({
    ...r,
    referrer_name: referrerMap[r.referrer_id]?.name || 'Unknown',
    referrer_email: referrerMap[r.referrer_id]?.email || 'Unknown',
  }));

  return res.status(200).json({ referrals: enriched });
}

async function markPayout(req, res) {
  const { adminId, referralId, payoutStatus } = req.body;
  if (!adminId || !referralId) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', adminId)
    .maybeSingle();

  if (!profile || profile.role !== 'super_admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const { error } = await supabaseAdmin
    .from('referrals')
    .update({
      payout_status: payoutStatus || 'paid',
      paid_at: payoutStatus === 'paid' ? new Date().toISOString() : null,
    })
    .eq('id', referralId);

  if (error) throw error;

  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('referrer_id, commission_amount')
    .eq('id', referralId)
    .maybeSingle();

  if (referral && payoutStatus === 'paid') {
    await supabaseAdmin.from('notifications').insert({
      user_id: referral.referrer_id,
      title: 'Payout Sent!',
      message: `Your referral commission of $${parseFloat(referral.commission_amount).toFixed(2)} has been paid out. Check your bank account.`,
      type: 'payout',
    });
  }

  return res.status(200).json({ success: true });
}

async function recordReferral(req, res) {
  const { referralCode, referredId, referredEmail } = req.body;

  if (!referralCode || !referredEmail) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const { data: users, error: listError } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000 });
  if (listError) throw listError;

  const referrer = users.users.find(u => u.id.startsWith(referralCode));
  if (!referrer) {
    return res.status(404).json({ error: 'Invalid referral code' });
  }

  if (referrer.id === referredId) {
    return res.status(400).json({ error: 'Self-referral not allowed' });
  }

  const { data: existing } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referrer_id', referrer.id)
    .eq('referred_email', referredEmail)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ success: true, message: 'Referral already recorded' });
  }

  const { error: insertError } = await supabaseAdmin
    .from('referrals')
    .insert({
      referrer_id: referrer.id,
      referred_id: referredId || null,
      referred_email: referredEmail,
      status: referredId ? 'signed_up' : 'pending',
    });

  if (insertError) throw insertError;

  return res.status(200).json({ success: true });
}

async function checkDiscount(req, res) {
  const { clientId } = req.body;
  if (!clientId) return res.status(400).json({ error: 'Missing clientId' });

  const { data: userMeta } = await supabaseAdmin.auth.admin.getUserById(clientId);
  const clientEmail = userMeta?.user?.email;

  if (!clientEmail) {
    return res.status(200).json({ hasDiscount: false });
  }

  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_id')
    .eq('referred_email', clientEmail)
    .in('status', ['pending', 'signed_up'])
    .maybeSingle();

  return res.status(200).json({ hasDiscount: !!referral });
}

// ---- Referral partner sends an invite email to a client they added ----------
//
// Auth: the caller's Bearer JWT (verifySession), NOT a body-supplied id. The
// older actions in this file trust `adminId` from the body, which is
// forgeable; this one does not repeat that mistake.
//
// Ownership: the partner may only email a referral row that is theirs
// (referrer_id = caller.id). They cannot email an arbitrary address, and they
// cannot email another partner's client.
//
// Rate limit: capped per partner per day (referral_invites), because the send
// goes out over the shared mail.certify.cx domain.
async function sendClientInvite(req, res) {
  const auth = await verifySession(req);
  if (auth.error) return res.status(auth.status).json({ error: 'Please sign in again' });
  const caller = auth.caller;

  // Only an ACTIVE referral/consultancy partner may send these. A pending or
  // rejected account must not be able to emit branded mail.
  if (!partnerActive(caller)) {
    return res.status(403).json({ error: 'Only approved referral partners can send client invites' });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const { referralId } = req.body || {};
  if (!referralId) return res.status(400).json({ error: 'Missing referral reference' });

  // The referral row must exist AND belong to this partner.
  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_id, referred_email, referred_name')
    .eq('id', referralId)
    .maybeSingle();

  if (!referral || referral.referrer_id !== caller.id) {
    return res.status(404).json({ error: 'Referral not found' });
  }

  const recipient = String(referral.referred_email || '').trim().toLowerCase();
  // Validate server-side — the address was inserted from the browser with only
  // a client-side regex, and it is about to be handed to the mail provider.
  if (!EMAIL_RE.test(recipient)) {
    return res.status(400).json({ error: 'This referral has no valid email address' });
  }

  // ---- Two caps, checked before anything is sent ----
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count: dailyCount } = await supabaseAdmin
    .from('referral_invites')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', caller.id)
    .gte('sent_at', dayAgo);
  if ((dailyCount || 0) >= INVITE_DAILY_CAP) {
    return res.status(429).json({ error: `Daily invite limit reached (${INVITE_DAILY_CAP}). Please try again tomorrow.` });
  }

  const { count: recipientCount } = await supabaseAdmin
    .from('referral_invites')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', caller.id)
    .eq('referred_email', recipient);
  if ((recipientCount || 0) >= INVITE_PER_RECIPIENT_CAP) {
    return res.status(429).json({ error: `This client has already been invited ${INVITE_PER_RECIPIENT_CAP} times.` });
  }

  // Partner's own details for the email body + reply-to.
  const { data: partner } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, company_name, referral_code, email_signature')
    .eq('id', caller.id)
    .maybeSingle();

  if (!partner?.referral_code) {
    return res.status(400).json({ error: 'Your referral code is not ready yet. Please refresh and try again.' });
  }

  // ---- RESERVE, then send ----
  // Insert the log row BEFORE sending. If two requests race, they both add a
  // row and the next check sees the higher count — a send-then-log order lets
  // 100 concurrent requests all read count<cap and all send. Worst case here
  // is an over-count (a reserved row whose email later fails), which is the
  // safe direction: it can only make the cap stricter, never looser.
  const { data: reservation, error: reserveErr } = await supabaseAdmin
    .from('referral_invites')
    .insert({ referrer_id: caller.id, referral_id: referral.id, referred_email: recipient })
    .select('id')
    .single();
  if (reserveErr) {
    console.error('send-client-invite: reservation failed', reserveErr?.message);
    return res.status(500).json({ error: 'Could not send the invite. Please try again.' });
  }

  const registrationUrl = `${APP_PUBLIC_URL}/checkout?ref=${encodeURIComponent(partner.referral_code)}`;
  const signature = partner.email_signature
    ? String(partner.email_signature).slice(0, SIGNATURE_MAX_LEN)
    : null;

  const { subject, html, text } = referralClientInviteEmail({
    clientName: referral.referred_name,
    partnerName: partner.full_name,
    partnerCompany: partner.company_name,
    registrationUrl,
    discountCode: partner.referral_code,
    profileUrl: COMPANY_PROFILE_URL,
    signature,
  });

  // From is the Certify.cx domain (SPF/DKIM aligned, stays out of spam);
  // Reply-To is the partner, so the client's reply reaches them directly.
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [recipient],
      reply_to: partner.email || undefined,
      subject,
      html,
      text,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('send-client-invite: Resend failed', resp.status, detail);
    // Release the reservation so a genuine failure does not permanently consume
    // one of the client's few allowed invites.
    await supabaseAdmin.from('referral_invites').delete().eq('id', reservation.id);
    return res.status(502).json({ error: 'Could not send the email. Please try again.' });
  }

  return res.status(200).json({ ok: true, sentTo: recipient });
}

// ---- Referral partner saves their email signature ---------------------------
// Was a direct browser write to profiles, which — because Postgres RLS is
// row-level, not column-level — would have let a partner set role /
// approval_status / referral_code in the same update if the profiles UPDATE
// policy is the usual `id = auth.uid()`. Routed through the service role so the
// ONLY column the partner can touch is email_signature.
async function saveSignature(req, res) {
  const auth = await verifySession(req);
  if (auth.error) return res.status(auth.status).json({ error: 'Please sign in again' });
  const caller = auth.caller;

  if (caller.role !== 'referral' && caller.role !== 'consultancy') {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const raw = req.body?.signature;
  if (raw != null && typeof raw !== 'string') {
    return res.status(400).json({ error: 'Invalid signature' });
  }
  const signature = raw ? raw.slice(0, SIGNATURE_MAX_LEN) : null;

  const { error } = await supabaseAdmin
    .from('profiles')
    .update({ email_signature: signature })
    .eq('id', caller.id);
  if (error) {
    console.error('save-signature error:', error.message);
    return res.status(500).json({ error: 'Could not save your signature. Please try again.' });
  }

  return res.status(200).json({ ok: true });
}
