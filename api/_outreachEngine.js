// ============================================================================
// Cold outreach to schools and universities: the sequence engine
// ============================================================================
// Requested by the client (boss), 13 Nov 2026. Three emails per institution, from midhat@certify.wiki:
// the introduction, a follow-up on day 4 and a final follow-up on day 9, each in the recipient's local business
// hours, with the Calendly link and (emails 2 and 3) an unsubscribe link.
//
// A free scheduler (GitHub Actions, hourly) calls two jobs in api/notify-event.js:
//   outreach-send     sends what is due, within the daily/hourly caps and the recipient's business hours
//   outreach-replies  reads the mailbox, stops the sequence for anyone who replied, bounced or asked to stop
//
// Safe by design: the switch starts OFF. DRY only works out who would be emailed. LIVE needs a test email to
// have been sent and a Super Admin to have approved it. Nobody on the suppression list is ever emailed, and
// the lead row is claimed (step moved on) BEFORE sending, so two overlapping runs cannot send the same email.
// ============================================================================

import { TEMPLATES } from './_outreachTemplates.js';
import { APP_URL } from './_appUrl.js';
import { newMessageId } from './_outreachMail.js';
import {
  resolveSchedule, isBusinessMoment, followUpAt, seedFrom, effectiveDailyCap, localParts,
} from './_outreachSchedule.js';

const DAY = 86400000;
const PHONE = '+971 50 644 9356';
const WEBSITE = 'https://certify.cx';
const EMAIL_RE = /^[^\s@<>()",;:]+@[^\s@<>()",;:]+\.[A-Za-z]{2,}$/;
export const MAX_IMPORT_ROWS = 2000;

const isMissingTable = (err) => err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message || ''));
const esc = (v) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function getSettings(supabase) {
  const { data, error } = await supabase.from('outreach_settings').select('*').eq('id', 1).maybeSingle();
  if (isMissingTable(error)) return { migrated: false, settings: null };
  if (error) throw error;
  return { migrated: true, settings: data || { id: 1, mode: 'off', daily_cap: 40, hourly_cap: 6 } };
}

// ---------------------------------------------------------------------------
// The email itself
// ---------------------------------------------------------------------------
const ENTITIES = { '&amp;': '&', '&nbsp;': ' ', '&trade;': '(TM)', '&rsquo;': "'", '&lsquo;': "'", '&copy;': '(c)', '&#10003;': '-', '&quot;': '"', '&lt;': '<', '&gt;': '>', '&#8199;': ' ', '&#847;': '' };

/** A plain-text twin of the HTML email, for mail clients and spam filters that want one. */
export function htmlToText(html) {
  return html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_, href, label) => {
      const text = label.replace(/<[^>]+>/g, '').trim();
      return !text || text === href ? href : `${text} (${href})`;
    })
    .replace(/<\/(p|div|tr|li|h1|h2|h3)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<img[^>]*alt="([^"]*)"[^>]*>/gi, (_, alt) => (alt ? `[${alt}]` : ''))
    .replace(/<[^>]+>/g, '')
    .replace(/&[#\w]+;/g, (m) => (m in ENTITIES ? ENTITIES[m] : ''))
    .replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/** Subject, HTML and text for one email of the sequence. ctx: calendlyUrl, senderEmail, unsubscribeUrl. */
export function renderEmail(step, lead, ctx) {
  const t = TEMPLATES[String(step)];
  if (!t) throw new Error(`No template for step ${step}`);
  const plain = {
    recipient_name: lead.contact_name || 'Quality Assurance Team',
    institution_name: lead.institution_name,
    calendly_url: ctx.calendlyUrl || '',
    website_url: ctx.websiteUrl || WEBSITE,
    sender_email: ctx.senderEmail || '',
    phone: ctx.phone || PHONE,
    unsubscribe_url: ctx.unsubscribeUrl || '',
  };
  const fill = (text, escape) => text.replace(/\{\{(\w+)\}\}/g, (_, k) => (escape ? esc(plain[k]) : String(plain[k] ?? '')));
  const html = fill(t.html, true);
  return { subject: fill(t.subject, false), html, text: htmlToText(html) };
}

function mailContext(settings, mail, lead) {
  const base = APP_URL;
  return {
    calendlyUrl: settings.calendly_url,
    senderEmail: mail.user,
    unsubscribeUrl: `${base}/unsubscribe?t=${lead.unsubscribe_token}`,
    oneClickUrl: `${base}/api/notify-event?job=unsubscribe&t=${lead.unsubscribe_token}`,
  };
}

// ---------------------------------------------------------------------------
// Importing leads
// ---------------------------------------------------------------------------
/** Validates rows from the CSV and adds the new ones. Returns counts and the reasons for any that were skipped. */
export async function importLeads(supabase, rows, { source = 'csv' } = {}) {
  const out = { added: 0, duplicates: 0, suppressed: 0, invalid: 0, needsTimezone: 0, problems: [] };
  const list = Array.isArray(rows) ? rows.slice(0, MAX_IMPORT_ROWS) : [];
  const seen = new Set();
  const clean = [];

  list.forEach((r, i) => {
    const email = String(r.email || '').trim().toLowerCase();
    const institution = String(r.institution_name || '').trim();
    const line = i + 2; // row 1 of the file is the header
    if (!EMAIL_RE.test(email) || email.length > 200) { out.invalid += 1; if (out.problems.length < 20) out.problems.push(`Row ${line}: not a valid email address`); return; }
    if (!institution || institution.length > 200) { out.invalid += 1; if (out.problems.length < 20) out.problems.push(`Row ${line}: institution name missing`); return; }
    if (/@(certify\.(cx|wiki))$/.test(email)) { out.invalid += 1; if (out.problems.length < 20) out.problems.push(`Row ${line}: our own address`); return; }
    if (seen.has(email)) { out.duplicates += 1; return; }
    seen.add(email);
    clean.push({
      email, institution_name: institution,
      contact_name: String(r.contact_name || '').trim().slice(0, 120) || null,
      institution_type: String(r.institution_type || '').trim().slice(0, 60) || null,
      country: String(r.country || '').trim().slice(0, 80) || null,
      timezone: String(r.timezone || '').trim() || null,
    });
  });
  if (!clean.length) return out;

  const emails = clean.map((c) => c.email);
  const [{ data: have }, { data: supp }] = await Promise.all([
    supabase.from('outreach_leads').select('email').in('email', emails),
    supabase.from('outreach_suppressions').select('email').in('email', emails),
  ]);
  const haveSet = new Set((have || []).map((r) => r.email.toLowerCase()));
  const suppSet = new Set((supp || []).map((r) => r.email.toLowerCase()));

  const insert = [];
  for (const c of clean) {
    if (suppSet.has(c.email)) { out.suppressed += 1; continue; }
    if (haveSet.has(c.email)) { out.duplicates += 1; continue; }
    const sched = resolveSchedule({ timezone: c.timezone, country: c.country });
    if (!sched) out.needsTimezone += 1;
    insert.push({ ...c, timezone: sched ? sched.timezone : null, source, status: sched ? 'new' : 'needs_timezone' });
  }
  if (insert.length) {
    const { error } = await supabase.from('outreach_leads').insert(insert);
    if (error) throw error;
    out.added = insert.length;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
const event = (supabase, lead_id, type, step, detail = {}) =>
  supabase.from('outreach_events').insert({ lead_id, type, step, detail });

/** Why live sending is not allowed yet, as a list (empty when it is). */
export function liveBlockers(settings, mail) {
  const why = [];
  if (!mail.configured) why.push('the outreach mailbox is not configured (Vercel environment variables)');
  if (!settings.calendly_url) why.push('the Calendly link is not set');
  if (!settings.live_approved_at) why.push('going live has not been approved');
  return why;
}

/**
 * Sends the next email of the sequence to one lead. Used by the hourly job and by the Super Admin "Send now" button,
 * so both go through the same safeguards. The row is claimed (step moved on) BEFORE sending, so only one caller can
 * send a given email; if sending fails the row is put back exactly as it was.
 *   { ok: true, step }  sent
 *   { skipped: true }   someone else claimed it first
 *   { ok: false, code, error }  failed (recorded as an event)
 */
export async function sendStep({ supabase, mail, settings, lead, schedule, now = new Date(), by = null }) {
  const step = lead.step + 1;
  const previous = { step: lead.step, status: lead.status, next_send_at: lead.next_send_at };
  const { data: claimed, error: claimErr } = await supabase.from('outreach_leads')
    .update({ step, status: 'in_sequence', next_send_at: null, last_sent_at: now.toISOString(), updated_at: now.toISOString() })
    .eq('id', lead.id).eq('step', lead.step).in('status', ['new', 'in_sequence']).select('id');
  if (claimErr || !claimed || !claimed.length) return { skipped: true };

  try {
    const ctx = mailContext(settings, mail, lead);
    const rendered = renderEmail(step, lead, ctx);
    const messageId = newMessageId(mail.user);
    const ids = lead.message_ids || [];
    await mail.send({
      to: lead.email, subject: rendered.subject, html: rendered.html, text: rendered.text, messageId,
      inReplyTo: ids.length ? ids[ids.length - 1] : undefined,
      references: ids.length ? ids.join(' ') : undefined,
      headers: {
        'List-Unsubscribe': `<${ctx.oneClickUrl}>, <mailto:${mail.user}?subject=unsubscribe>`,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    const firstSent = lead.first_sent_at || now.toISOString();
    const done = step >= 3;
    const nextAt = done ? null : followUpAt(firstSent, step, schedule, seedFrom(lead.id));
    await supabase.from('outreach_leads').update({
      status: done ? 'completed' : 'in_sequence',
      first_sent_at: firstSent,
      message_ids: [...ids, messageId],
      next_send_at: nextAt ? nextAt.toISOString() : null,
      updated_at: now.toISOString(),
    }).eq('id', lead.id);
    await event(supabase, lead.id, 'sent', step, { messageId, subject: rendered.subject, ...(by ? { manual: true, by } : {}) });
    return { ok: true, step };
  } catch (e) {
    // Put the row back exactly as it was so it is tried again, and record why.
    await supabase.from('outreach_leads').update({ ...previous, updated_at: now.toISOString() }).eq('id', lead.id);
    await event(supabase, lead.id, 'failed', step, { error: String(e.message || e).slice(0, 300), code: e.code || null, ...(by ? { manual: true } : {}) });
    return { ok: false, code: e.code || null, error: String(e.message || e) };
  }
}

/**
 * Sends what is due. Returns counts per outcome.
 *   mode off   nothing
 *   mode dry / test   works out who would be emailed, sends nothing
 *   mode live  sends (only when liveBlockers() is empty)
 */
export async function runOutreachSend({ supabase, mail, now = new Date(), deadlineMs = 8000, sleepBetweenMs = 0 } = {}) {
  const started = Date.now();
  const { migrated, settings } = await getSettings(supabase);
  if (!migrated) return { ok: false, skipped: 'not_migrated', message: 'Run supabase/phase48_outreach.sql first.' };
  if (settings.mode === 'off') return { ok: true, skipped: 'off' };

  const live = settings.mode === 'live';
  const blockers = live ? liveBlockers(settings, mail) : [];
  if (live && blockers.length) return { ok: true, skipped: 'not_ready', blockers };

  const summary = { ok: true, mode: settings.mode, sent: 0, failed: 0, wouldSend: [], outsideHours: 0, needsTimezone: 0, deferred: 0, suppressed: 0, capReached: false };
  const dailyCap = effectiveDailyCap(settings, now);
  const hourlyCap = Number(settings.hourly_cap) || 6;

  const { data: recent } = await supabase.from('outreach_events').select('id').eq('type', 'sent').gte('created_at', new Date(now.getTime() - DAY).toISOString());
  const sentLast24h = (recent || []).length;
  summary.dailyCap = dailyCap;
  summary.sentLast24h = sentLast24h;

  const [{ data: due }, { data: fresh }] = await Promise.all([
    supabase.from('outreach_leads').select('*').eq('status', 'in_sequence').lte('next_send_at', now.toISOString()).order('next_send_at').limit(100),
    supabase.from('outreach_leads').select('*').eq('status', 'new').order('created_at').limit(200),
  ]);
  const candidates = [...(due || []), ...(fresh || [])];
  if (!candidates.length) return summary;

  const { data: supp } = await supabase.from('outreach_suppressions').select('email').in('email', candidates.map((c) => c.email.toLowerCase()));
  const suppressed = new Set((supp || []).map((r) => r.email.toLowerCase()));

  let sentThisRun = 0;
  for (const lead of candidates) {
    if (Date.now() - started > deadlineMs) { summary.deferred += 1; continue; }
    if (suppressed.has(lead.email.toLowerCase())) {
      summary.suppressed += 1;
      if (live) await supabase.from('outreach_leads').update({ status: 'stopped', next_send_at: null, updated_at: now.toISOString() }).eq('id', lead.id);
      continue;
    }
    const schedule = resolveSchedule({ timezone: lead.timezone, country: lead.country });
    if (!schedule) {
      summary.needsTimezone += 1;
      if (live) await supabase.from('outreach_leads').update({ status: 'needs_timezone', updated_at: now.toISOString() }).eq('id', lead.id);
      continue;
    }
    if (!isBusinessMoment(now, schedule)) { summary.outsideHours += 1; continue; }
    if (sentLast24h + sentThisRun >= dailyCap) { summary.capReached = true; summary.deferred += 1; continue; }
    if (sentThisRun >= hourlyCap) { summary.deferred += 1; continue; }

    const step = lead.step + 1;
    if (!live) {
      const lp = localParts(now, schedule.timezone);
      summary.wouldSend.push({ leadId: lead.id, institution: lead.institution_name, step, localTime: `${String(lp.hh).padStart(2, '0')}:${String(lp.mm).padStart(2, '0')}`, timezone: schedule.timezone });
      sentThisRun += 1;
      continue;
    }

    const outcome = await sendStep({ supabase, mail, settings, lead, schedule, now });
    if (outcome.skipped) continue; // another run got there first
    if (outcome.ok) {
      summary.sent += 1;
      sentThisRun += 1;
      if (sleepBetweenMs) await new Promise((r) => setTimeout(r, sleepBetweenMs));
    } else {
      summary.failed += 1;
      // A login or connection problem will hit every other email too: stop here rather than hammer the server.
      if (['EAUTH', 'ENOCONFIG', 'ECONNECTION', 'ETIMEDOUT', 'ESOCKET', 'EDNS'].includes(outcome.code)) { summary.aborted = outcome.code; break; }
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Replies, bounces and unsubscribes
// ---------------------------------------------------------------------------
const BOUNCE_FROM = /mailer-daemon|postmaster/i;
const BOUNCE_SUBJECT = /undeliver|delivery status|delivery failure|failure notice|returned mail|mail delivery failed/i;
const AUTO_SUBJECT = /^(automatic reply|auto[- ]?reply|auto:|out of office|autosvar|abwesenheit)/i;
const STOP_SUBJECT = /\b(unsubscribe|remove me|stop emailing|do not contact|opt[- ]?out)\b/i;

export async function suppress(supabase, email, reason) {
  await supabase.from('outreach_suppressions').upsert({ email: email.toLowerCase(), reason }, { onConflict: 'email' });
}

async function endSequence(supabase, lead, status, now) {
  await supabase.from('outreach_leads').update({ status, next_send_at: null, updated_at: now.toISOString() }).eq('id', lead.id);
}

/** Reads the mailbox and ends the sequence for anyone who replied, bounced or asked to stop. */
export async function runOutreachReplies({ supabase, mail, now = new Date() } = {}) {
  const { migrated, settings } = await getSettings(supabase);
  if (!migrated) return { ok: false, skipped: 'not_migrated' };
  if (settings.mode === 'off') return { ok: true, skipped: 'off' };
  if (!mail.configured) return { ok: true, skipped: 'mailbox_not_configured' };

  const since = settings.last_reply_check_at ? new Date(new Date(settings.last_reply_check_at).getTime() - DAY) : new Date(now.getTime() - 3 * DAY);
  const messages = await mail.fetchSince(since);
  const { data: leads } = await supabase.from('outreach_leads').select('id, email, status, step, message_ids').gte('step', 1).limit(5000);
  const all = leads || [];
  const byEmail = new Map(all.map((l) => [l.email.toLowerCase(), l]));
  const own = String(mail.user || '').toLowerCase();
  const summary = { ok: true, read: messages.length, replies: 0, autoReplies: 0, bounces: 0, unsubscribes: 0 };
  const live = settings.mode === 'live';

  for (const m of messages) {
    const from = String(m.from || '').toLowerCase();
    if (!from || from === own) continue;

    if (BOUNCE_FROM.test(from) || BOUNCE_SUBJECT.test(m.subject || '')) {
      const hit = all.find((l) => m.body && m.body.toLowerCase().includes(l.email.toLowerCase()));
      if (hit && hit.status !== 'bounced') {
        summary.bounces += 1;
        if (live) { await endSequence(supabase, hit, 'bounced', now); await suppress(supabase, hit.email, 'bounced'); await event(supabase, hit.id, 'bounce', hit.step, { subject: m.subject }); hit.status = 'bounced'; }
      }
      continue;
    }

    const refs = `${m.inReplyTo || ''} ${m.references || ''}`;
    const lead = all.find((l) => (l.message_ids || []).some((id) => refs.includes(id))) || byEmail.get(from);
    if (!lead || ['replied', 'unsubscribed', 'bounced'].includes(lead.status)) continue;

    if (m.autoSubmitted || AUTO_SUBJECT.test(m.subject || '')) {
      summary.autoReplies += 1;
      if (live) await event(supabase, lead.id, 'auto_reply', lead.step, { subject: m.subject });
      continue;
    }
    if (STOP_SUBJECT.test(m.subject || '')) {
      summary.unsubscribes += 1;
      if (live) { await endSequence(supabase, lead, 'unsubscribed', now); await suppress(supabase, lead.email, 'asked to stop by reply'); await event(supabase, lead.id, 'unsubscribed', lead.step, { by: 'reply' }); lead.status = 'unsubscribed'; }
      continue;
    }
    summary.replies += 1;
    if (live) { await endSequence(supabase, lead, 'replied', now); await event(supabase, lead.id, 'reply', lead.step, { subject: m.subject }); lead.status = 'replied'; }
  }

  if (live) await supabase.from('outreach_settings').update({ last_reply_check_at: now.toISOString() }).eq('id', 1);
  return summary;
}

/** Public: the unsubscribe link. Only a valid token does anything, and nothing about the lead is returned. */
export async function unsubscribeByToken(supabase, token, now = new Date()) {
  const t = String(token || '');
  if (!/^[0-9a-f]{32}$/i.test(t)) return { ok: false };
  const { data: lead } = await supabase.from('outreach_leads').select('id, email, step, status').eq('unsubscribe_token', t).maybeSingle();
  if (!lead) return { ok: false };
  if (lead.status !== 'unsubscribed') {
    await supabase.from('outreach_leads').update({ status: 'unsubscribed', next_send_at: null, updated_at: now.toISOString() }).eq('id', lead.id);
    await suppress(supabase, lead.email, 'unsubscribed');
    await event(supabase, lead.id, 'unsubscribed', lead.step, { by: 'link' });
  }
  return { ok: true };
}
