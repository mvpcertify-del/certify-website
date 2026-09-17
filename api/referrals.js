import { createClient } from '@supabase/supabase-js';
import { verifySession, verifyAdmin } from './_verifyAdmin.js';
import { COMPANY_PROFILE_SLUG } from './_assetSlugs.js';
import { referralClientInviteEmail, partnerOutreachEmail, referralPartnerRecruitEmail } from './_emailTemplates.js';
import { getOutreachCopy } from './_outreachCopy.js';
import { ensureConversation, appendMessage, discardConversation } from './_conversations.js';
import { ISO_CATALOG } from '../src/utils/isoCatalog.js';
import { APP_URL } from './_appUrl.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

// The client's 27 Aug instruction was explicit: partner mail goes out "using
// support@certify.cx being the communication introductory email with Clients".
// Both partner letters therefore send from the SUPPORT identity, not the
// generic noreply transactional one — mirroring api/_resendClient.js, which
// already resolves the same three-step fallback for business mail.
const PARTNER_FROM_EMAIL =
  process.env.RESEND_SUPPORT_FROM_EMAIL ||
  process.env.RESEND_FROM_EMAIL ||
  'Certify.cx Support <support@certify.cx>';

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
// A single letter may now carry two PDFs (the standard's brochure and the
// company profile). Each is capped at 3 MB on upload, so two of them is 6 MB
// raw — about 8 MB once base64 puts them on the wire, against a mail-server
// bounce threshold that is commonly 10 MB. This is the combined ceiling that
// keeps the total under it with room for the letter itself.
const MAX_TOTAL_ATTACHMENT_BYTES = 6 * 1024 * 1024;

const INVITE_DAILY_CAP = 20;
const INVITE_PER_RECIPIENT_CAP = 3;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// The rate a referral partner earns when no per-partner rate is agreed.
// Kept in step with REFERRAL_FLAT_COMMISSION_PERCENT in api/checkout.js, which
// is what actually writes the commission — this constant only labels the
// admin list, so a drift would mislead, not miscalculate.
const REFERRAL_FLAT_COMMISSION_PERCENT = 10;

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
    if (action === 'partner-list') return await listReferralPartners(req, res);
    if (action === 'mark-payout') return await markPayout(req, res);
    if (action === 'record') return await recordReferral(req, res);
    if (action === 'check-discount') return await checkDiscount(req, res);
    if (action === 'send-client-invite') return await sendClientInvite(req, res);
    if (action === 'send-outreach') return await sendOutreach(req, res);
    if (action === 'invite-partner') return await invitePartner(req, res);
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

// ---- Admin: the Referral Partners list -------------------------------------
//
// Feeds /admin/referral-partners (the sidebar entry under Clients). One row per
// referral partner with their ledger rolled up: clients introduced, how many
// converted, commission earned and how much of it is still unpaid.
//
// Auth: verifyAdmin — a verified Bearer token. The older actions in this file
// trust a body-supplied `adminId`, which is forgeable; this one does not repeat
// that. A country admin is scoped to their own region like every other admin
// list view, and fails closed when their region is unset.
//
// Why the roll-up happens here rather than in a SQL view: the consultancy board
// reads consultancy_kpi (phase23) because it also needs contract state. The
// referral list needs no contract columns, and adding a view would mean running
// a migration against a live database just to render a read-only table. The
// referral ledger holds one row per introduced client, so the aggregate is
// cheap in memory and can never disagree with the ledger.
async function listReferralPartners(req, res) {
  const { caller, error, status } = await verifyAdmin(req);
  if (error) return res.status(status).json({ error });

  let query = supabaseAdmin
    .from('profiles')
    .select('id, full_name, company_name, email, country, region, referral_code, is_active, approval_status, created_at, commission_percent_override')
    .eq('role', 'referral')
    // Consultancy partners have their own screen (/admin/consultancies) and sat
    // on the referral role until phase 22, so without this they would be listed
    // on both. `.neq` alone would silently drop rows whose stakeholder_type is
    // NULL, because NULL <> 'consultancy' is NULL, not true — the same trap the
    // Main Dashboard counter documents.
    .or('stakeholder_type.is.null,stakeholder_type.neq.consultancy');

  if (caller.role === 'regional_admin') {
    query = query.eq('region', caller.region || '__no_region__');
  }

  const { data: partners, error: pErr } = await query;
  if (pErr) {
    console.error('listReferralPartners: profiles query failed:', pErr.message);
    return res.status(500).json({ error: 'Could not load referral partners.' });
  }

  const ids = (partners || []).map((p) => p.id);

  // `select('*')` on purpose: the columns this roll-up reads were added across
  // several migrations (payout_status/paid_at in phase20, application_id in
  // phase25). Naming them would make the whole screen 500 on an environment
  // that is one migration behind, instead of just showing a zero.
  let ledger = [];
  if (ids.length > 0) {
    const { data, error: rErr } = await supabaseAdmin
      .from('referrals')
      .select('*')
      .in('referrer_id', ids);
    if (rErr) {
      console.error('listReferralPartners: referrals query failed:', rErr.message);
      return res.status(500).json({ error: 'Could not load referral partners.' });
    }
    ledger = data || [];
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const byPartner = new Map(ids.map((id) => [id, {
    total_referrals: 0,
    converted: 0,
    pending: 0,
    converted_this_month: 0,
    // What the partner's clients PAID, as distinct from the partner's cut.
    // Added 12 Sep so an admin previewing a partner's dashboard sees the same
    // Sales figure the partner sees; the browser cannot compute it for someone
    // else, because referrals RLS is scoped to referrer_id = auth.uid().
    total_sales: 0,
    total_commission: 0,
    unpaid_commission: 0,
    last_conversion_at: null,
    notifications_total: 0,
    notifications_unread: 0,
  }]));

  for (const row of ledger) {
    const agg = byPartner.get(row.referrer_id);
    if (!agg) continue;

    agg.total_referrals += 1;

    if (row.status !== 'converted') {
      agg.pending += 1;
      continue;
    }

    agg.converted += 1;
    agg.total_sales += Number(row.payment_amount) || 0;

    const amount = Number(row.commission_amount) || 0;
    agg.total_commission += amount;
    // Anything not explicitly marked paid is still owed. Treating a missing
    // payout_status as paid would under-report what the platform owes.
    if (row.payout_status !== 'paid') agg.unpaid_commission += amount;

    if (row.converted_at) {
      const at = new Date(row.converted_at);
      if (!Number.isNaN(at.getTime())) {
        if (at >= monthStart) agg.converted_this_month += 1;
        if (!agg.last_conversion_at || at > new Date(agg.last_conversion_at)) {
          agg.last_conversion_at = row.converted_at;
        }
      }
    }
  }

  // Notification counts, for the same reason total_sales is here: an admin
  // previewing a partner's dashboard cannot read another user's notifications
  // from the browser, because the table is scoped to user_id = auth.uid().
  // Two columns over one indexed filter, aggregated in memory — cheaper than a
  // count query per partner, and this list is already one row per partner.
  if (ids.length > 0) {
    const { data: notes, error: nErr } = await supabaseAdmin
      .from('notifications')
      .select('user_id, read')
      .in('user_id', ids);
    if (nErr) {
      // Not worth failing the whole screen over: a partner row without its
      // notification counts is still a useful row.
      console.error('listReferralPartners: notifications query failed:', nErr.message);
    } else {
      for (const n of notes || []) {
        const agg = byPartner.get(n.user_id);
        if (!agg) continue;
        agg.notifications_total += 1;
        if (!n.read) agg.notifications_unread += 1;
      }
    }
  }

  const rows = (partners || []).map((p) => ({
    profile_id: p.id,
    full_name: p.full_name,
    company_name: p.company_name,
    email: p.email,
    country: p.country,
    region: p.region,
    referral_code: p.referral_code,
    is_active: p.is_active,
    approval_status: p.approval_status,
    joined_at: p.created_at,
    // An agreed per-partner rate wins over the flat rate, exactly as
    // getReferrerTier() in api/checkout.js resolves it when paying out.
    commission_percent: p.commission_percent_override != null
      ? Number(p.commission_percent_override)
      : REFERRAL_FLAT_COMMISSION_PERCENT,
    has_agreed_rate: p.commission_percent_override != null,
    ...byPartner.get(p.id),
  }));

  // Best earners first; a partner with no conversions yet sorts by how many
  // clients they have introduced, so an active newcomer is not buried.
  rows.sort((a, b) =>
    b.converted - a.converted ||
    b.total_commission - a.total_commission ||
    b.total_referrals - a.total_referrals
  );

  return res.status(200).json({
    partners: rows,
    defaultCommissionPercent: REFERRAL_FLAT_COMMISSION_PERCENT,
  });
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

// ---- Partner send caps, shared by BOTH partner letters ----------------------
//
// Returns a message when the send must be refused, or null when it may proceed.
//
// Shared on purpose. There are now two letters a partner can send — the phase27
// registration invite and the phase32 standard proposal — and they both leave
// over the same certify.cx domain. Counting them separately would hand each
// partner two independent daily allowances and double the volume one account
// can push before anything notices, which is precisely the failure the caps
// exist to prevent. `referral_invites` logs both (see its `kind` column), so a
// single pair of queries bounds the pair of letters.
async function checkSendCaps(referrerId, recipient) {
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { count: dailyCount } = await supabaseAdmin
    .from('referral_invites')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId)
    .gte('sent_at', dayAgo);
  if ((dailyCount || 0) >= INVITE_DAILY_CAP) {
    return `Daily email limit reached (${INVITE_DAILY_CAP}). Please try again tomorrow.`;
  }

  const { count: recipientCount } = await supabaseAdmin
    .from('referral_invites')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_id', referrerId)
    .eq('referred_email', recipient);
  if ((recipientCount || 0) >= INVITE_PER_RECIPIENT_CAP) {
    return `You have already emailed this contact ${INVITE_PER_RECIPIENT_CAP} times.`;
  }

  return null;
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
  const capError = await checkSendCaps(caller.id, recipient);
  if (capError) return res.status(429).json({ error: capError });

  // Partner's own details for the email body + reply-to.
  const { data: partner } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, company_name, referral_code, region')
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

  const registrationUrl = `${APP_URL}/checkout?ref=${encodeURIComponent(partner.referral_code)}`;

  const { subject, html, text } = referralClientInviteEmail({
    clientName: referral.referred_name,
    partnerName: partner.full_name,
    partnerCompany: partner.company_name,
    registrationUrl,
    discountCode: partner.referral_code,
    profileUrl: COMPANY_PROFILE_URL,
  });

  // The invite shares the proposal's thread with this lead, so a partner who
  // sends both is not left with two half-conversations in their inbox.
  const thread = await ensureConversation(supabaseAdmin, {
    referrerId: caller.id,
    referralId: referral.id,
    leadEmail: recipient,
    leadName: referral.referred_name || null,
    subject,
    region: partner.region || null,
  });

  // From is the SUPPORT identity on the Certify.cx domain (SPF/DKIM aligned,
  // stays out of spam). Reply-To is the thread address once inbound email is
  // configured, and the partner's own address until then — either way the
  // client's reply reaches a person.
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: PARTNER_FROM_EMAIL,
      to: [recipient],
      reply_to: thread?.replyTo || partner.email || undefined,
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
    if (thread?.created) await discardConversation(supabaseAdmin, thread.conversation.id);
    return res.status(502).json({ error: 'Could not send the email. Please try again.' });
  }

  if (thread?.conversation?.id) {
    await appendMessage(supabaseAdmin, thread.conversation.id, {
      direction: 'outbound',
      fromEmail: partner.email || null,
      fromName: partner.full_name || null,
      toEmail: recipient,
      subject,
      bodyText: text,
    });
  }

  return res.status(200).json({ ok: true, sentTo: recipient });
}

// ---- Super Admin recruits a brand-new referral partner --------------------
//
// Client, 16-17 Sep: "How to access support@certify.cx so SA can send email
// with registration link to new referral Partners?" — answered that there is
// no inbox, only Cloudflare-forward-to-Gmail; then approved building this
// instead, so SA never has to touch a mailbox at all.
//
// Unlike sendClientInvite/sendOutreach (a referral PARTNER emailing their own
// LEAD), this is an ADMIN emailing a PROSPECT who does not exist in the
// system yet — there is no referral row to own, so auth is verifyAdmin
// (super admin only, matching who asked for this), not verifySession +
// partnerActive.
//
// Reuses referral_invites for the audit trail AND the rate limit (see
// checkSendCaps above it) — referrer_id is nullable-in-spirit-but-not-in-
// schema, so the admin's own profile id fills it; `kind: 'partner_recruit'`
// keeps this cleanly distinguishable from the phase27/phase32 partner-sent
// rows sharing the same table.
async function invitePartner(req, res) {
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status).json({ error: auth.error });
  const caller = auth.caller;

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const recipient = String(req.body?.email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(recipient)) {
    return res.status(400).json({ error: 'Enter a valid email address' });
  }
  // Optional; shown in the email if given. Never trusted as markup — the
  // template HTML-escapes it like every other admin-typed field.
  const name = String(req.body?.name || '').trim().slice(0, 120) || null;
  const note = String(req.body?.note || '').trim().slice(0, 500) || null;

  // Same two caps send-client-invite and send-outreach already share — one
  // admin blasting hundreds of these still goes out over certify.cx's shared
  // reputation, so it is bounded the same way.
  const capError = await checkSendCaps(caller.id, recipient);
  if (capError) return res.status(429).json({ error: capError });

  const { data: reservation, error: reserveErr } = await supabaseAdmin
    .from('referral_invites')
    .insert({ referrer_id: caller.id, referred_email: recipient, kind: 'partner_recruit' })
    .select('id')
    .single();
  if (reserveErr) {
    console.error('invite-partner: reservation failed', reserveErr?.message);
    return res.status(500).json({ error: 'Could not send the invite. Please try again.' });
  }

  const registerUrl = `${APP_URL}/register/referral`;
  const { subject, html, text } = referralPartnerRecruitEmail({ name, note, registerUrl });

  // From the BUSINESS identity (support@certify.cx), same as every other
  // partner-facing letter in this file — this is exactly the address the
  // client asked to send these from.
  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: PARTNER_FROM_EMAIL,
      to: [recipient],
      reply_to: 'support@certify.cx',
      subject,
      html,
      text,
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('invite-partner: Resend failed', resp.status, detail);
    // Release the reservation so a transient failure does not permanently eat
    // one of the admin's daily/per-recipient allowance.
    await supabaseAdmin.from('referral_invites').delete().eq('id', reservation.id);
    return res.status(502).json({ error: 'Could not send the email. Please try again.' });
  }

  return res.status(200).json({ ok: true, sentTo: recipient });
}

// ---- Referral partner sends the standard proposal to one of their leads -----
//
// The client's 27 Aug request: a partner picks a lead they have already added,
// picks the standard they want to pitch, and the platform sends the proposal
// letter with that standard's briefing document attached.
//
// Auth and ownership are identical to sendClientInvite and for the same
// reasons: the caller is identified by their Bearer JWT, never by a body field,
// and the referral row must be theirs. A partner cannot mail an arbitrary
// address, and cannot mail another partner's lead.
//
// What differs from the invite: a standard, an optional "they already hold X"
// line, and a file attachment.
async function sendOutreach(req, res) {
  const auth = await verifySession(req);
  if (auth.error) return res.status(auth.status).json({ error: 'Please sign in again' });
  const caller = auth.caller;

  if (!partnerActive(caller)) {
    return res.status(403).json({ error: 'Only approved referral partners can send proposals' });
  }

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const { referralId, standardSlug, existingCert, include } = req.body || {};
  if (!referralId) return res.status(400).json({ error: 'Missing referral reference' });

  // Which of the three items the partner ticked (client, 6 Sep: "the above 3
  // items will be available & just to be ticked & system will send directly").
  //
  // The ready email template is item 1 and is not optional — it IS the letter,
  // and an email with no body is not a thing to offer. Items 2 and 3 are the
  // two attachments. Both default to the pre-6-Sep behaviour so an older
  // client build, or a retry from a stale tab, sends exactly what it used to.
  const wantBrochure = include?.brochure !== false;
  const wantCompanyProfile = include?.companyProfile === true;

  // The slug must satisfy BOTH catalogues: ISO_CATALOG (it is a standard the
  // site actually sells, so the call-to-action link resolves) and the outreach
  // copy (there is a paragraph written for it). Checking one and not the other
  // yields either a letter with a hole in it or a button leading to a 404.
  const iso = standardSlug ? ISO_CATALOG[standardSlug] : null;
  const copy = getOutreachCopy(standardSlug);
  if (!iso || !copy) return res.status(400).json({ error: 'Please choose a standard' });

  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_id, referred_email, referred_name, referred_company')
    .eq('id', referralId)
    .maybeSingle();

  if (!referral || referral.referrer_id !== caller.id) {
    return res.status(404).json({ error: 'Referral not found' });
  }

  const recipient = String(referral.referred_email || '').trim().toLowerCase();
  if (!EMAIL_RE.test(recipient)) {
    return res.status(400).json({ error: 'This referral has no valid email address' });
  }

  const capError = await checkSendCaps(caller.id, recipient);
  if (capError) return res.status(429).json({ error: capError });

  const { data: partner } = await supabaseAdmin
    .from('profiles')
    .select('full_name, email, company_name, referral_code, region')
    .eq('id', caller.id)
    .maybeSingle();

  if (!partner?.referral_code) {
    return res.status(400).json({ error: 'Your referral code is not ready yet. Please refresh and try again.' });
  }

  // Free text typed by the partner ("ISO 9001"), so it is bounded and stripped
  // of newlines before it reaches a mail header-adjacent context. The template
  // HTML-escapes it as well; this is the length and shape guard, that is the
  // markup guard.
  const heldCert = existingCert
    ? String(existingCert).replace(/[\r\n]+/g, ' ').trim().slice(0, 60)
    : null;

  // ---- The attachments, in the order the recipient should meet them ----
  //
  // Up to two files now: the standard's own briefing note, and the company
  // profile the client asked for on 6 Sep. `attachmentNames` is handed to the
  // template ONLY for files whose bytes are actually in hand, which is what
  // stops the letter claiming "I have attached our company profile" over an
  // email that carries no such thing. That invariant predates this change and
  // is the reason the list is built here rather than from what was ticked.
  //
  // A missing or unreadable file is NOT fatal, exactly as before: a good letter
  // with nothing attached beats no letter at all, and beats a letter that lies
  // about its own contents.
  // Company profile first, brochure second — the order the letter names them
  // in, and the order a stranger should meet them: who we are, then what we are
  // proposing. Mail clients list attachments in the order they are sent.
  const wanted = [];
  if (wantCompanyProfile) wanted.push(COMPANY_PROFILE_SLUG);
  if (wantBrochure) wanted.push(standardSlug);

  const attachments = [];
  let attachmentBytes = 0;

  if (wanted.length) {
    const { data: assetRows } = await supabaseAdmin
      .from('outreach_assets')
      .select('standard_slug, file_name, storage_path')
      .in('standard_slug', wanted);

    const bySlug = new Map((assetRows || []).map(r => [r.standard_slug, r]));

    // Sequential, not Promise.all: two 3 MB downloads plus their base64 strings
    // already sit in one serverless function's memory at once, and fetching
    // them in parallel doubles the peak for no useful latency win on a send
    // that is already waiting on Resend.
    for (const slug of wanted) {
      const row = bySlug.get(slug);
      if (!row?.storage_path) continue;

      const { data: blob, error: dlErr } = await supabaseAdmin.storage
        .from('outreach-assets')
        .download(row.storage_path);

      if (dlErr || !blob) {
        // Worth knowing about — it means the row and the bucket disagree — but
        // not worth failing the partner's send over.
        console.error('send-outreach: attachment download failed', slug, dlErr?.message);
        continue;
      }

      const buf = Buffer.from(await blob.arrayBuffer());

      // Refuse rather than silently drop. Mail servers commonly bounce a
      // message over 10 MB and base64 inflates by a third, so two files at the
      // 3 MB per-file ceiling is already ~8 MB on the wire. A bounce is
      // invisible to the partner — they see "sent" and hear nothing back — so
      // the failure has to happen here, in front of them, naming the fix.
      if (attachmentBytes + buf.length > MAX_TOTAL_ATTACHMENT_BYTES) {
        return res.status(413).json({
          error: 'The selected attachments are too large to email together. '
            + 'Send them separately, or ask your administrator to upload a smaller PDF.',
        });
      }

      attachmentBytes += buf.length;
      attachments.push({ filename: row.file_name, content: buf.toString('base64') });
    }
  }

  // ---- RESERVE, then send ----
  // Same ordering as the invite, for the same reason: logging first means a
  // race can only over-count (stricter), while send-then-log lets concurrent
  // requests all read count<cap and all send.
  const { data: reservation, error: reserveErr } = await supabaseAdmin
    .from('referral_invites')
    .insert({
      referrer_id: caller.id,
      referral_id: referral.id,
      referred_email: recipient,
      kind: 'outreach',
      standard_slug: standardSlug,
    })
    .select('id')
    .single();
  if (reserveErr) {
    console.error('send-outreach: reservation failed', reserveErr?.message);
    return res.status(500).json({ error: 'Could not send the proposal. Please try again.' });
  }

  // The call to action lands on the standard's own page — which names the price
  // and carries the payment gateway — with the partner's code attached, so a
  // sale that starts from this letter is credited to the partner who sent it.
  const ctaUrl = `${APP_URL}/iso/${iso.slug}?ref=${encodeURIComponent(partner.referral_code)}`;

  const { subject, html, text } = partnerOutreachEmail({
    clientName: referral.referred_name,
    // The letter addresses an ORGANIZATION, so the company name leads and the
    // contact's name is the fallback — "a proposal for Acme Ltd" reads as
    // business correspondence; "a proposal for John Smith" reads as spam.
    orgName: referral.referred_company || referral.referred_name,
    standardSlug: iso.slug,
    standardCode: iso.code,
    existingCert: heldCert,
    ctaUrl,
    partnerName: partner.full_name,
    attachmentNames: attachments.map(a => a.filename),
    // The client asked on 6 Sep that the proposal carry the partner's discount
    // code, as the invitation letter already did. Without it a cold lead who
    // reads the proposal and buys is credited to nobody.
    discountCode: partner.referral_code,
  });

  // Open (or re-use) the thread this letter belongs to, so the client's reply
  // comes back into the dashboard rather than into the partner's own mailbox.
  // Returns null until inbound email is configured — in which case the letter
  // still goes out, with the partner as Reply-To exactly as before.
  const thread = await ensureConversation(supabaseAdmin, {
    referrerId: caller.id,
    referralId: referral.id,
    leadEmail: recipient,
    leadName: referral.referred_company || referral.referred_name || null,
    standardSlug: iso.slug,
    subject,
    region: partner.region || null,
  });

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: PARTNER_FROM_EMAIL,
      to: [recipient],
      // The thread address when inbound is live; the partner's own address
      // otherwise, so a reply always reaches a human either way.
      reply_to: thread?.replyTo || partner.email || undefined,
      subject,
      html,
      text,
      // Spread in only when non-empty: Resend rejects an empty array.
      ...(attachments.length ? { attachments } : {}),
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('send-outreach: Resend failed', resp.status, detail);
    await supabaseAdmin.from('referral_invites').delete().eq('id', reservation.id);
    // Only a thread opened FOR this send is removed. One that already existed
    // holds real history and stays.
    if (thread?.created) await discardConversation(supabaseAdmin, thread.conversation.id);
    return res.status(502).json({ error: 'Could not send the email. Please try again.' });
  }

  // Filed after a confirmed send, so the thread shows what actually went out.
  if (thread?.conversation?.id) {
    await appendMessage(supabaseAdmin, thread.conversation.id, {
      direction: 'outbound',
      fromEmail: partner.email || null,
      fromName: partner.full_name || null,
      toEmail: recipient,
      subject,
      bodyText: text,
    });
  }

  return res.status(200).json({
    ok: true,
    sentTo: recipient,
    attached: attachments.length > 0,
    attachedCount: attachments.length,
    threaded: Boolean(thread),
  });
}

// The `save-signature` action that used to live here was removed on 6 Sep at
// the client's instruction: no role, existing or new, edits an email signature
// any more. Partner mail signs off with profiles.full_name — the name the
// company already holds on the signed partner agreement.
