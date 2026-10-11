// =============================================================================
// Investor email campaigns — business logic (phase39, client 10-11 Oct)
// =============================================================================
// Called from api/referrals.js's action dispatch (kept out of that file's own
// body so it stays readable) — not its own route, to stay inside the Vercel
// Hobby 12-function cap (see CLAUDE.md).
//
// Four admin actions (all super-admin only):
//   list-investor-campaigns    — campaigns + aggregate stats
//   get-investor-campaign      — one campaign + per-recipient breakdown
//   save-investor-campaign     — create or edit a DRAFT (id omitted = create)
//   send-investor-campaign     — the actual bulk send
//
// Plus one function the weekly cron calls directly (not an HTTP action):
//   draftWeeklyInvestorCampaign — AI-drafts new content, saves it as a draft
//   (ai_generated: true), notifies the Super Admin. Never sends on its own —
//   see api/notify-event.js and the client's explicit decision, 11 Oct.
//
// What this does NOT and CANNOT do: report whether a specific email landed in
// a recipient's spam folder. No sender-side API can see inside someone else's
// mailbox. bounced_at/complained_at are the real, trackable proxy for
// deliverability health.
// =============================================================================

import { verifyAdmin } from './_verifyAdmin.js';
import { investorCampaignEmail } from './_emailTemplates.js';
import { APP_URL } from './_appUrl.js';
import { newReplyToken, buildReplyTo } from './_replyAddress.js';

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL;
// Personal identity, not the generic business one — this is Midhat speaking
// to a fund directly (the template now signs it as him too, see
// investorCampaignEmail in _emailTemplates.js), same register
// investorOutreachEmail already uses for one-to-one fund outreach. A reply
// still reaches a person either way; this just matches who the letter reads
// as being from. Override via env if ceo@certify.cx ever needs to change
// without a code deploy.
const CAMPAIGN_FROM_EMAIL =
  process.env.RESEND_INVESTOR_FROM_EMAIL ||
  'Midhat Abu Ghazaleh <ceo@certify.cx>';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Shared guard: every action here is Super Admin only ------------------
async function requireSuperAdmin(req, res) {
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) {
    res.status(auth.status).json({ error: auth.error });
    return null;
  }
  return auth.caller;
}

// ---- Aggregate one campaign's recipient rows into counts -------------------
function summarize(recipients) {
  const s = {
    total: recipients.length,
    sent: 0, delivered: 0, opened: 0, clicked: 0,
    bounced: 0, complained: 0, failed: 0, queued: 0,
    replied: 0,
  };
  for (const r of recipients) {
    if (s[r.status] !== undefined) s[r.status] += 1;
    if (r.replied_at) s.replied += 1;
  }
  return s;
}

export async function listInvestorCampaigns(req, res, supabaseAdmin) {
  const caller = await requireSuperAdmin(req, res);
  if (!caller) return;

  const { data: campaigns, error } = await supabaseAdmin
    .from('investor_campaigns')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });

  const { data: recipients } = await supabaseAdmin
    .from('investor_campaign_recipients')
    .select('campaign_id, status, replied_at');

  const byCampaign = new Map();
  for (const r of recipients || []) {
    if (!byCampaign.has(r.campaign_id)) byCampaign.set(r.campaign_id, []);
    byCampaign.get(r.campaign_id).push(r);
  }

  return res.status(200).json({
    campaigns: (campaigns || []).map((c) => ({
      ...c,
      stats: summarize(byCampaign.get(c.id) || []),
    })),
  });
}

export async function getInvestorCampaign(req, res, supabaseAdmin) {
  const caller = await requireSuperAdmin(req, res);
  if (!caller) return;

  const { campaignId } = req.body || {};
  if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });

  const { data: campaign } = await supabaseAdmin
    .from('investor_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const { data: recipients } = await supabaseAdmin
    .from('investor_campaign_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .order('created_at', { ascending: true });

  return res.status(200).json({
    campaign,
    stats: summarize(recipients || []),
    recipients: recipients || [],
  });
}

export async function saveInvestorCampaign(req, res, supabaseAdmin) {
  const caller = await requireSuperAdmin(req, res);
  if (!caller) return;

  const subject = String(req.body?.subject || '').trim();
  const body = String(req.body?.body || '').trim();
  const campaignId = req.body?.campaignId || null;
  if (!subject || !body) {
    return res.status(400).json({ error: 'Subject and body are required' });
  }

  if (campaignId) {
    // The DB trigger (phase39) also enforces this; checking here first gives
    // a readable error instead of a raw Postgres exception reaching the UI.
    const { data: existing } = await supabaseAdmin
      .from('investor_campaigns')
      .select('sent_at')
      .eq('id', campaignId)
      .maybeSingle();
    if (!existing) return res.status(404).json({ error: 'Campaign not found' });
    if (existing.sent_at) {
      return res.status(409).json({ error: 'This campaign has already been sent and can no longer be edited' });
    }
    const { data, error } = await supabaseAdmin
      .from('investor_campaigns')
      .update({ subject, body })
      .eq('id', campaignId)
      .select('*')
      .single();
    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ campaign: data });
  }

  const { data, error } = await supabaseAdmin
    .from('investor_campaigns')
    .insert({ subject, body, created_by: caller.id })
    .select('*')
    .single();
  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json({ campaign: data });
}

// Sends with bounded concurrency — 150 recipients sent one-at-a-time could
// run past a serverless function's time limit; fully parallel could trip
// Resend's own rate limit. A small fixed-size pool is the middle ground.
async function sendWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let next = 0;
  async function runOne() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, runOne));
  return results;
}

export async function sendInvestorCampaign(req, res, supabaseAdmin) {
  const caller = await requireSuperAdmin(req, res);
  if (!caller) return;

  if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
    return res.status(503).json({ error: 'Email is not configured on the server' });
  }

  const { campaignId } = req.body || {};
  if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });

  const { data: campaign } = await supabaseAdmin
    .from('investor_campaigns')
    .select('*')
    .eq('id', campaignId)
    .maybeSingle();
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });
  if (campaign.sent_at) {
    return res.status(409).json({ error: 'This campaign has already been sent' });
  }

  // Every active fund with a usable email, excluding anyone who unsubscribed
  // from a previous campaign — checked fresh at send time, not cached from
  // whenever the campaign was drafted.
  const { data: investors, error: invErr } = await supabaseAdmin
    .from('investors')
    .select('id, fund_name, contact_email')
    .eq('is_active', true)
    .is('unsubscribed_at', null)
    .not('contact_email', 'is', null);
  if (invErr) return res.status(500).json({ error: invErr.message });

  const recipients = (investors || []).filter((inv) => EMAIL_RE.test(inv.contact_email || ''));
  if (!recipients.length) {
    return res.status(400).json({ error: 'No active investors with a valid, subscribed email address' });
  }

  // Reserve the recipient rows BEFORE sending (same ordering reasoning as
  // referral_invites in api/referrals.js) — a row exists the moment a send is
  // attempted, so a crash mid-batch still leaves an accurate partial record
  // rather than silently sending to people twice on retry.
  const { data: reserved, error: reserveErr } = await supabaseAdmin
    .from('investor_campaign_recipients')
    .insert(recipients.map((inv) => ({
      campaign_id: campaignId,
      investor_id: inv.id,
      email: inv.contact_email.trim().toLowerCase(),
      fund_name: inv.fund_name,
      status: 'queued',
      // null when inbound isn't configured — buildReplyTo() then returns
      // null too and the send just omits Reply-To, same fail-open behaviour
      // the phase33 partner-reply system already has.
      reply_token: newReplyToken(),
    })))
    .select('id, investor_id, email, reply_token');
  if (reserveErr) return res.status(500).json({ error: reserveErr.message });

  const results = await sendWithConcurrency(reserved, 8, async (row) => {
    const unsubscribeUrl = `${APP_URL}/api/inbound-email?unsubscribe=${row.investor_id}`;
    try {
      const { subject, html, text } = investorCampaignEmail({
        subject: campaign.subject,
        body: campaign.body,
        unsubscribeUrl,
      });
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: CAMPAIGN_FROM_EMAIL,
          to: [row.email],
          subject,
          html,
          text,
          // Routes a reply through reply.certify.cx so inbound-email.js can
          // match it straight back to this row by token — see the
          // reply_token column comment in phase39. Omitted (not an empty
          // string) when inbound isn't configured; Resend rejects a blank
          // reply_to.
          ...(buildReplyTo(row.reply_token) ? { reply_to: buildReplyTo(row.reply_token) } : {}),
          // Echoed back on every Resend webhook event for this message — the
          // primary way api/inbound-email.js matches an open/click/bounce
          // event to this exact row without parsing the message id.
          tags: [
            { name: 'campaign_id', value: campaignId },
            { name: 'recipient_id', value: row.id },
          ],
        }),
      });
      const json = await resp.json().catch(() => ({}));
      if (!resp.ok) {
        await supabaseAdmin.from('investor_campaign_recipients')
          .update({ status: 'failed' }).eq('id', row.id);
        return { ok: false, email: row.email, detail: json };
      }
      await supabaseAdmin.from('investor_campaign_recipients')
        .update({ status: 'sent', sent_at: new Date().toISOString(), resend_message_id: json.id || null })
        .eq('id', row.id);
      return { ok: true, email: row.email };
    } catch (err) {
      await supabaseAdmin.from('investor_campaign_recipients')
        .update({ status: 'failed' }).eq('id', row.id);
      return { ok: false, email: row.email, detail: err.message };
    }
  });

  const sentCount = results.filter((r) => r.ok).length;

  await supabaseAdmin
    .from('investor_campaigns')
    .update({ sent_at: new Date().toISOString() })
    .eq('id', campaignId);

  return res.status(200).json({
    ok: true,
    attempted: recipients.length,
    sent: sentCount,
    failed: recipients.length - sentCount,
  });
}

// ---- Weekly AI draft (called by the Monday cron, never by an HTTP action) -
//
// Writes a DRAFT only (sent_at stays null) and notifies the Super Admin it's
// ready to review — explicit client decision, 11 Oct: no AI-written content
// reaches real investors without a human reading it first. The admin reviews
// and edits it like any other draft, then sends it from the Investors ->
// Campaigns screen same as a hand-written one.
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const CAMPAIGN_DRAFT_PROMPT = `You write a single short, professional investor-update email on behalf of Midhat Abu Ghazaleh, Founder & CEO of Certify.cx, an ISO certification management platform. The recipient is a venture capital fund being kept warm for a future conversation, not a customer.

Rules:
- 120-180 words in the body. Plain, confident, not salesy. No exclamation marks, no emoji, no invented metrics, revenue figures, user counts or growth percentages - you have none, and must not make any up.
- Open with a brief, genuine line about the business (product focus, who it serves), then one piece of real, generic context (e.g. ongoing platform development, expanding standards coverage) phrased honestly without specific numbers.
- Close by inviting a short call or reply, signed "Midhat Abu Ghazaleh, Founder & CEO".
- Body is PLAIN TEXT paragraphs separated by a single blank line - no markdown, no HTML, no bullet points, no links (a Learn More button and unsubscribe link are added automatically).
- Subject: under 60 characters, no emoji, not clickbait.
- Must read as a DIFFERENT email from previous weeks, not a repeat of the same wording.

Reply with ONLY a JSON object, no other text: {"subject": "...", "body": "..."}`;

export async function draftWeeklyInvestorCampaign(supabaseAdmin) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('draftWeeklyInvestorCampaign: GEMINI_API_KEY not configured');
    return null;
  }

  // Recent subjects, so the model is explicitly told what not to repeat
  // rather than relying on "be different" alone.
  const { data: recent } = await supabaseAdmin
    .from('investor_campaigns')
    .select('subject')
    .order('created_at', { ascending: false })
    .limit(5);
  const recentLine = (recent || []).length
    ? `\n\nSubjects already used recently (write something distinct from these): ${recent.map((r) => `"${r.subject}"`).join(', ')}`
    : '';

  let subject;
  let body;
  try {
    const resp = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: CAMPAIGN_DRAFT_PROMPT + recentLine }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 512 },
      }),
    });
    if (!resp.ok) throw new Error(`Gemini ${resp.status}: ${await resp.text().catch(() => '')}`);
    const json = await resp.json();
    const raw = json?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // The model is asked for bare JSON but sometimes wraps it in a ```json
    // fence anyway — strip that before parsing rather than failing on it.
    const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    const parsed = JSON.parse(cleaned);
    subject = String(parsed.subject || '').trim();
    body = String(parsed.body || '').trim();
    if (!subject || !body) throw new Error('Gemini response missing subject/body');
  } catch (err) {
    console.error('draftWeeklyInvestorCampaign: generation failed', err?.message);
    return null;
  }

  const { data: campaign, error } = await supabaseAdmin
    .from('investor_campaigns')
    .insert({ subject, body, ai_generated: true })
    .select('*')
    .single();
  if (error) {
    console.error('draftWeeklyInvestorCampaign: save failed', error.message);
    return null;
  }
  return campaign;
}
