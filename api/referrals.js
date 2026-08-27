import { createClient } from '@supabase/supabase-js';
import { verifySession, verifyAdmin } from './_verifyAdmin.js';
import { referralClientInviteEmail, partnerOutreachEmail } from './_emailTemplates.js';
import { getOutreachCopy } from './_outreachCopy.js';
import { ISO_CATALOG } from '../src/utils/isoCatalog.js';
import { APP_URL } from './_appUrl.js';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;

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
    total_commission: 0,
    unpaid_commission: 0,
    last_conversion_at: null,
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

  const registrationUrl = `${APP_URL}/checkout?ref=${encodeURIComponent(partner.referral_code)}`;
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

  const { referralId, standardSlug, existingCert } = req.body || {};
  if (!referralId) return res.status(400).json({ error: 'Missing referral reference' });

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
    .select('full_name, email, company_name, referral_code, email_signature')
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

  // ---- The attachment, if this standard has one ----
  //
  // A standard with no uploaded document sends the letter WITHOUT one rather
  // than with somebody else's. `attachmentName` is passed to the template only
  // when the bytes are actually in hand, so the letter can never claim "I have
  // attached a briefing note" over an email that carries no attachment.
  let attachment = null;
  const { data: asset } = await supabaseAdmin
    .from('outreach_assets')
    .select('file_name, storage_path')
    .eq('standard_slug', standardSlug)
    .maybeSingle();

  if (asset?.storage_path) {
    const { data: blob, error: dlErr } = await supabaseAdmin.storage
      .from('outreach-assets')
      .download(asset.storage_path);
    if (dlErr || !blob) {
      // Worth knowing about — it means the row and the bucket disagree — but
      // not worth failing the partner's send over. The letter still stands up
      // on its own without the brochure.
      console.error('send-outreach: attachment download failed', standardSlug, dlErr?.message);
    } else {
      const buf = Buffer.from(await blob.arrayBuffer());
      attachment = { filename: asset.file_name, content: buf.toString('base64') };
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

  const signature = partner.email_signature
    ? String(partner.email_signature).slice(0, SIGNATURE_MAX_LEN)
    : null;

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
    signature,
    partnerName: partner.full_name,
    attachmentName: attachment?.filename || null,
  });

  const resp = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: RESEND_FROM_EMAIL,
      to: [recipient],
      // Until the inbound reply path exists (the client's point 2), a reply
      // still has to reach a human, and the partner is that human.
      reply_to: partner.email || undefined,
      subject,
      html,
      text,
      ...(attachment ? { attachments: [attachment] } : {}),
    }),
  });

  if (!resp.ok) {
    const detail = await resp.text().catch(() => '');
    console.error('send-outreach: Resend failed', resp.status, detail);
    await supabaseAdmin.from('referral_invites').delete().eq('id', reservation.id);
    return res.status(502).json({ error: 'Could not send the email. Please try again.' });
  }

  return res.status(200).json({
    ok: true,
    sentTo: recipient,
    attached: Boolean(attachment),
  });
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
