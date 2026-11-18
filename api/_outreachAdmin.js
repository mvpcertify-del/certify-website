// Super Admin actions for the cold-outreach system, and the public unsubscribe call.
//
// No new serverless function (the Hobby plan allows 12): api/notify-event.js hands every action that starts with
// "outreach-" to this file, which checks the caller is a Super Admin itself. Nothing here can send to a lead:
// the only thing that sends is the hourly job, and only when the system has been tested and approved live.

import { verifyAdmin, getAdmin } from './_verifyAdmin.js';
import { createMailer, outreachMailConfig } from './_outreachMail.js';
import {
  getSettings, importLeads, renderEmail, liveBlockers, suppress, unsubscribeByToken, sendStep,
} from './_outreachEngine.js';
import { effectiveDailyCap, projectSchedule, resolveSchedule } from './_outreachSchedule.js';
import { APP_URL } from './_appUrl.js';

const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;
const STATUSES = ['new', 'in_sequence', 'completed', 'replied', 'unsubscribed', 'bounced', 'stopped', 'needs_timezone'];
const SAMPLE = { institution_name: 'Sample University', contact_name: 'Dr. Sample', unsubscribe_token: '0'.repeat(32) };

// Preview and test emails use a real lead's name when one is chosen, but always a harmless unsubscribe token.
async function previewLead(db, id) {
  if (!id) return SAMPLE;
  const { data } = await db.from('outreach_leads').select('institution_name, contact_name').eq('id', id).maybeSingle();
  return data ? { ...SAMPLE, institution_name: data.institution_name, contact_name: data.contact_name } : SAMPLE;
}

const fail = (status, message) => Object.assign(new Error(message), { status });

async function overview(db, body) {
  const { migrated, settings } = await getSettings(db);
  if (!migrated) return { migrated: false };
  const cfg = outreachMailConfig();
  const mail = { configured: cfg.configured };

  const { data: all } = await db.from('outreach_leads').select('status').limit(10000);
  const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
  for (const r of all || []) counts[r.status] = (counts[r.status] || 0) + 1;

  let q = db.from('outreach_leads')
    .select('id, email, institution_name, contact_name, country, timezone, status, step, next_send_at, first_sent_at, last_sent_at')
    .order('created_at', { ascending: false }).limit(150);
  if (STATUSES.includes(body.status)) q = q.eq('status', body.status);
  const search = String(body.q || '').trim().slice(0, 80).replace(/[%,()]/g, ' ');
  if (search) q = q.or(`email.ilike.%${search}%,institution_name.ilike.%${search}%`);
  const { data: leads } = await q;

  const { data: events } = await db.from('outreach_events')
    .select('id, type, step, detail, created_at, lead:outreach_leads(institution_name, email)')
    .order('created_at', { ascending: false }).limit(60);

  const since = new Date(Date.now() - 86400000).toISOString();
  const { data: sentRows } = await db.from('outreach_events').select('id').eq('type', 'sent').gte('created_at', since);

  // Every email actually sent, grouped by lead: which email number went out, and when.
  const { data: sentEv } = await db.from('outreach_events').select('lead_id, step, created_at')
    .eq('type', 'sent').order('created_at', { ascending: true }).limit(5000);
  const sentMap = {};
  for (const e of sentEv || []) { (sentMap[e.lead_id] ||= {})[e.step] = e.created_at; }
  const { data: sentLeads } = await db.from('outreach_leads')
    .select('id, email, institution_name, country, status, step, last_sent_at')
    .not('first_sent_at', 'is', null).order('last_sent_at', { ascending: false }).limit(200);
  const sentLog = (sentLeads || []).map((l) => ({ ...l, sent: sentMap[l.id] || {} }));

  const { data: supp } = await db.from('outreach_suppressions').select('email').limit(10000);

  // Who gets which email when, in the recipient's own time.
  const { data: inPlay } = await db.from('outreach_leads')
    .select('id, email, institution_name, country, timezone, status, step, next_send_at, created_at')
    .in('status', ['new', 'in_sequence']).limit(1500);
  const cap = effectiveDailyCap(settings);
  const schedule = projectSchedule(inPlay || [], new Date(), cap).slice(0, 200);
  const sendWhy = [];
  if (!cfg.configured) sendWhy.push('the outreach mailbox is not connected');
  if (!settings.calendly_url) sendWhy.push('the Calendly link is not set');
  if (!settings.test_sent_at) sendWhy.push('send a test email first');

  return {
    migrated: true,
    settings: {
      mode: settings.mode, daily_cap: settings.daily_cap, hourly_cap: settings.hourly_cap, calendly_url: settings.calendly_url || '',
      test_recipient: settings.test_recipient || '', test_sent_at: settings.test_sent_at, live_approved_at: settings.live_approved_at,
      warmup_started_at: settings.warmup_started_at, last_reply_check_at: settings.last_reply_check_at,
    },
    mailbox: { configured: cfg.configured, user: cfg.user || null, host: cfg.host || null },
    blockers: liveBlockers(settings, mail),
    effectiveDailyCap: cap,
    schedule,
    canSendNow: sendWhy.length === 0,
    sendNowBlockers: sendWhy,
    sent24h: (sentRows || []).length,
    sentTotal: (sentEv || []).length,
    sentLog,
    suppressed: (supp || []).length,
    counts,
    leads: (leads || []).map((l) => ({ ...l, sent: sentMap[l.id] || {} })),
    events: (events || []).map((e) => ({ id: e.id, type: e.type, step: e.step, at: e.created_at, institution: e.lead?.institution_name || null, email: e.lead?.email || null, detail: e.detail })),
  };
}

function cleanSettings(body) {
  const out = {};
  if (body.mode !== undefined) {
    if (!['off', 'dry', 'test'].includes(body.mode)) throw fail(400, 'Mode must be off, dry or test. Going live needs the approval button.');
    out.mode = body.mode;
  }
  if (body.daily_cap !== undefined) {
    const n = Number(body.daily_cap);
    if (!Number.isInteger(n) || n < 1 || n > 500) throw fail(400, 'Daily limit must be a whole number from 1 to 500.');
    out.daily_cap = n;
  }
  if (body.hourly_cap !== undefined) {
    const n = Number(body.hourly_cap);
    if (!Number.isInteger(n) || n < 1 || n > 60) throw fail(400, 'Hourly limit must be a whole number from 1 to 60.');
    out.hourly_cap = n;
  }
  if (body.calendly_url !== undefined) {
    const v = String(body.calendly_url || '').trim();
    if (v && !/^https:\/\/[^\s]+$/i.test(v)) throw fail(400, 'The Calendly link must start with https://');
    out.calendly_url = v || null;
  }
  if (body.test_recipient !== undefined) {
    const v = String(body.test_recipient || '').trim().toLowerCase();
    if (v && !EMAIL_RE.test(v)) throw fail(400, 'The test address is not a valid email address.');
    out.test_recipient = v || null;
  }
  return out;
}

export async function handleOutreachAction(req, res) {
  const body = req.body || {};
  const action = String(body.action || '');

  // Public: the unsubscribe page. Only a valid token does anything.
  if (action === 'outreach-unsubscribe') {
    try { return res.status(200).json(await unsubscribeByToken(getAdmin(), body.token)); } catch (e) {
      console.error('[outreach] unsubscribe failed', e?.message);
      return res.status(500).json({ ok: false });
    }
  }

  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status || 403).json({ error: auth.error });
  const db = getAdmin();

  try {
    if (action === 'outreach-overview') return res.status(200).json(await overview(db, body));

    if (action === 'outreach-import') {
      const result = await importLeads(db, body.rows, { source: 'csv' });
      return res.status(200).json(result);
    }

    if (action === 'outreach-update-settings') {
      const changes = cleanSettings(body);
      if (!Object.keys(changes).length) throw fail(400, 'Nothing to change.');
      const { error } = await db.from('outreach_settings').update({ ...changes, updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'outreach-preview-email') {
      const step = [1, 2, 3].includes(Number(body.step)) ? Number(body.step) : 1;
      const { settings } = await getSettings(db);
      const mail = { user: outreachMailConfig().user };
      const rendered = renderEmail(step, await previewLead(db, body.lead_id), { calendlyUrl: settings?.calendly_url || 'https://calendly.com/your-link', senderEmail: mail.user || 'midhat@certify.wiki', unsubscribeUrl: `${APP_URL}/unsubscribe?t=${SAMPLE.unsubscribe_token}` });
      return res.status(200).json({ subject: rendered.subject, html: rendered.html });
    }

    if (action === 'outreach-send-test') {
      const mailer = createMailer();
      const { settings } = await getSettings(db);
      if (!mailer.configured) throw fail(409, 'The outreach mailbox is not configured yet (Vercel environment variables).');
      if (!settings?.calendly_url) throw fail(409, 'Set the Calendly link first.');
      const to = String(body.to || settings.test_recipient || '').trim().toLowerCase();
      if (!EMAIL_RE.test(to)) throw fail(400, 'Enter the address to send the test to.');
      const step = [1, 2, 3].includes(Number(body.step)) ? Number(body.step) : 1;
      const rendered = renderEmail(step, await previewLead(db, body.lead_id), { calendlyUrl: settings.calendly_url, senderEmail: mailer.user, unsubscribeUrl: `${APP_URL}/unsubscribe?t=${SAMPLE.unsubscribe_token}` });
      await mailer.send({ to, subject: `[TEST] ${rendered.subject}`, html: rendered.html, text: rendered.text });
      const now = new Date().toISOString();
      await db.from('outreach_settings').update({ test_sent_at: now, test_recipient: to, updated_at: now }).eq('id', 1);
      await db.from('outreach_events').insert({ lead_id: null, type: 'test_sent', step, detail: { by: auth.caller.id } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'outreach-approve-live') {
      const { settings } = await getSettings(db);
      const mail = { configured: outreachMailConfig().configured };
      const why = liveBlockers({ ...settings, live_approved_at: 'x' }, mail);
      if (!settings.test_sent_at) why.push('no test email has been sent yet');
      if (why.length) throw fail(409, `Cannot go live: ${why.join('; ')}.`);
      const now = new Date().toISOString();
      const { error } = await db.from('outreach_settings').update({
        mode: 'live', live_approved_by: auth.caller.id, live_approved_at: now, warmup_started_at: settings.warmup_started_at || now, updated_at: now,
      }).eq('id', 1);
      if (error) throw error;
      await db.from('outreach_events').insert({ lead_id: null, type: 'approved_live', step: null, detail: { by: auth.caller.id } });
      return res.status(200).json({ ok: true });
    }

    // The Super Admin sends the next email to one lead right now, instead of waiting for the hourly run.
    // The same safeguards apply (suppression list, one claim per email); a test must have been sent first.
    if (action === 'outreach-send-now') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'Missing lead.');
      const mailer = createMailer();
      const { settings } = await getSettings(db);
      const why = [];
      if (!mailer.configured) why.push('the outreach mailbox is not connected');
      if (!settings?.calendly_url) why.push('the Calendly link is not set');
      if (!settings?.test_sent_at) why.push('no test email has been sent yet');
      if (why.length) throw fail(409, `Cannot send yet: ${why.join('; ')}.`);
      const { data: lead } = await db.from('outreach_leads').select('*').eq('id', id).maybeSingle();
      if (!lead) throw fail(404, 'Lead not found.');
      if (!['new', 'in_sequence'].includes(lead.status) || lead.step >= 3) throw fail(409, 'This lead has nothing left to send.');
      const { data: blocked } = await db.from('outreach_suppressions').select('email').eq('email', lead.email.toLowerCase()).maybeSingle();
      if (blocked) throw fail(409, 'This address is on the do-not-email list.');
      const schedule = resolveSchedule(lead);
      if (!schedule) throw fail(409, 'Set a country or time zone for this lead first.');
      const out = await sendStep({ supabase: db, mail: mailer, settings, lead, schedule, by: auth.caller.id });
      if (out.skipped) throw fail(409, 'This email is already being sent.');
      if (!out.ok) throw fail(502, `The email was not sent: ${out.error}`);
      return res.status(200).json({ ok: true, step: out.step });
    }

    if (action === 'outreach-pause') {
      const { error } = await db.from('outreach_settings').update({ mode: 'dry', updated_at: new Date().toISOString() }).eq('id', 1);
      if (error) throw error;
      await db.from('outreach_events').insert({ lead_id: null, type: 'paused', step: null, detail: { by: auth.caller.id } });
      return res.status(200).json({ ok: true });
    }

    if (action === 'outreach-lead-action') {
      const id = String(body.id || '');
      if (!/^[0-9a-f-]{36}$/i.test(id)) throw fail(400, 'Missing lead.');
      const { data: lead } = await db.from('outreach_leads').select('id, email, status, step').eq('id', id).maybeSingle();
      if (!lead) throw fail(404, 'Lead not found.');
      const now = new Date().toISOString();
      const what = String(body.what || '');
      if (what === 'stop') await db.from('outreach_leads').update({ status: 'stopped', next_send_at: null, updated_at: now }).eq('id', id);
      else if (what === 'replied') await db.from('outreach_leads').update({ status: 'replied', next_send_at: null, updated_at: now }).eq('id', id);
      else if (what === 'unsubscribe') { await db.from('outreach_leads').update({ status: 'unsubscribed', next_send_at: null, updated_at: now }).eq('id', id); await suppress(db, lead.email, 'marked by admin'); }
      else if (what === 'restart') {
        if (lead.status !== 'stopped' || lead.step !== 0) throw fail(409, 'Only a stopped lead that has not been emailed can be restarted.');
        await db.from('outreach_leads').update({ status: 'new', updated_at: now }).eq('id', id);
      } else if (what === 'delete') await db.from('outreach_leads').delete().eq('id', id);
      else throw fail(400, 'Unknown action.');
      await db.from('outreach_events').insert({ lead_id: what === 'delete' ? null : id, type: `admin_${what}`, step: lead.step, detail: { by: auth.caller.id } });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('[outreach-admin]', action, e?.message || e);
    return res.status(e?.status || 500).json({ error: e?.message || 'Outreach action failed' });
  }
}
