// ============================================================================
// Notification & engagement engine (Phases 1 and 2)
// ============================================================================
// Requested by the client (boss), 15 Nov 2026: notify every stakeholder about every
// important deadline and transaction.
//
// How it works, in four steps (run once a day by the cron in api/notify-event.js):
//   1. Load the rules (api/_notifyEngine.js DEFAULT_RULES, kept in the notification_rules table
//      so an admin can switch one off or change the days).
//   2. Each rule has a FINDER: a query over the real tables that returns who needs a message
//      right now, with the day count worked out from that person's own dates (not a fixed
//      calendar date). Anything finished, paid, cancelled or expired is simply not returned, so
//      there are no obsolete reminders.
//   3. Every candidate gets an event id (rule:entity:bucket) written to notification_log, which
//      is UNIQUE: if the row already exists the reminder already went out and is skipped.
//   4. Only newly logged candidates are delivered: in-app inbox, email, and WhatsApp (a no-op
//      until a WhatsApp provider is configured).
//
// Lives in a "_" file so it is not a serverless function (the Hobby plan allows 12).
// ============================================================================

import { sendViaResend } from './_resendClient.js';
import { sendWhatsApp } from './_notifyWhatsApp.js';
import { notificationEmail } from './_emailTemplates.js';
import { APP_URL } from './_appUrl.js';

const DAY = 86400000;

/** Most messages one run may deliver. The rest are picked up by tomorrow's run (they are not logged yet). */
export const MAX_SENDS_PER_RUN = 25;

// ---------------------------------------------------------------------------
// Default rules. The same shape as the notification_rules table.
// ---------------------------------------------------------------------------
export const DEFAULT_RULES = [
  {
    key: 'contractor_trial_ending',
    title: 'Contractor free subscription ending',
    description: 'A contractor\'s free subscription is about to end. Counted from their approval date.',
    enabled: true,
    offsets: [7, 3, 1],
    channels: ['in_app', 'email'],
    recipient_role: 'contractor',
    config: { trial_days: 30 },
    templates: {
      en: {
        byOffset: {
          7: { title: 'Your free subscription ends in {{days}} days', message: 'Continue enjoying Certify.cx services. Review your subscription options to maintain uninterrupted access.' },
          3: { title: 'Only {{days}} days left!', message: 'Your free subscription is approaching its end. Choose your preferred plan.' },
          1: { title: 'Your subscription expires tomorrow', message: 'Upgrade today to avoid interruption to your contractor account.' },
        },
        cta: 'Review your options',
        path: '/contractor/dashboard',
      },
    },
  },
  {
    key: 'client_onboarding_incomplete',
    title: 'Client has not started certification',
    description: 'A client registered, but 24 hours later has not started an application.',
    enabled: true,
    offsets: [1],
    channels: ['in_app', 'email'],
    recipient_role: 'client',
    config: { lookback_days: 7 },
    templates: {
      en: {
        default: { title: 'Finish setting up your Certify.cx account', message: 'You registered but have not started your certification yet. It takes about five minutes: choose a standard and we will match you with accredited providers.' },
        cta: 'Continue',
        path: '/client/dashboard',
      },
    },
  },
  {
    key: 'invoice_unpaid',
    title: 'Invoice unpaid',
    description: 'An issued invoice is still unpaid on its due date, and again three days later.',
    enabled: true,
    offsets: [0, 3],
    channels: ['in_app', 'email'],
    recipient_role: 'client',
    config: { lookback_days: 14 },
    templates: {
      en: {
        byOffset: {
          0: { title: 'Invoice {{invoice}} is due today', message: '{{amount}} is due today. Pay now to keep your certification on schedule.' },
          3: { title: 'Invoice {{invoice}} is {{days}} days overdue', message: '{{amount}} was due on {{date}}. Please complete the payment so we can continue your certification.' },
        },
        cta: 'Open my dashboard',
        path: '/client/dashboard',
      },
    },
  },
  {
    key: 'documents_missing',
    title: 'Required documents missing',
    description: 'A client chose a package but has uploaded no documents. Repeats every 3 days, up to 4 times.',
    enabled: true,
    offsets: [3],
    channels: ['in_app', 'email'],
    recipient_role: 'client',
    config: { every_days: 3, max_reminders: 4, lookback_days: 45 },
    templates: {
      en: {
        default: { title: 'Documents still needed for {{company}}', message: 'We are waiting for your required documents. Upload them from your dashboard so your audit can be scheduled.' },
        cta: 'Upload documents',
        path: '/client/dashboard',
      },
    },
  },
  {
    key: 'certificate_expiry',
    title: 'Certificate nearing expiry',
    description: 'An active certificate expires in 90, 60 and 30 days.',
    enabled: true,
    offsets: [90, 60, 30],
    channels: ['in_app', 'email'],
    recipient_role: 'client',
    config: {},
    templates: {
      en: {
        default: { title: 'Your {{iso}} certificate expires in {{days}} days', message: 'Certificate {{number}} for {{company}} expires on {{date}}. Start your renewal now to avoid a gap in certification.' },
        cta: 'Start renewal',
        path: '/client/certificates',
      },
    },
  },
];

// ---------------------------------------------------------------------------
// Pure helpers (unit tested)
// ---------------------------------------------------------------------------

/** Whole days from `from` up to `to`, rounded up: 6 hours left counts as 1 day left. */
export function daysUntil(to, from = new Date()) {
  return Math.ceil((new Date(to).getTime() - new Date(from).getTime()) / DAY);
}

/**
 * "Before a deadline" rules. Offsets are how many days ahead to remind (e.g. 7, 3, 1).
 * Given the days left, return the reminder that applies now: the smallest offset that is
 * still >= days left. A run that was missed therefore still sends the nearest reminder
 * rather than nothing, and never sends two at once. Nothing once the date has passed.
 */
export function pickBefore(offsets, daysLeft) {
  if (!Number.isFinite(daysLeft) || daysLeft < 1) return null;
  const fit = [...offsets].filter((o) => o >= daysLeft).sort((a, b) => a - b);
  return fit.length ? fit[0] : null;
}

/**
 * "After a date" rules (overdue invoices). Offsets are days after the due date (0, 3).
 * Return the latest offset already reached.
 */
export function pickAfter(offsets, daysPast) {
  if (!Number.isFinite(daysPast) || daysPast < 0) return null;
  const fit = [...offsets].filter((o) => o <= daysPast).sort((a, b) => b - a);
  return fit.length ? fit[0] : null;
}

export function eventId(ruleKey, entityId, bucket) {
  return `${ruleKey}:${entityId}:${bucket}`;
}

/** Fill {{name}} placeholders; an unknown placeholder is left empty rather than printed. */
export function fill(text, vars = {}) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => (vars[k] == null ? '' : String(vars[k])));
}

/** The wording for a rule in a language: the bucket's own text, else the default, else English. */
export function renderTemplate(rule, { lang = 'en', bucket, vars = {} } = {}) {
  const t = rule.templates?.[lang] || rule.templates?.en;
  if (!t) return null;
  const body = t.byOffset?.[bucket] || t.default;
  if (!body) return null;
  return {
    title: fill(body.title, vars),
    message: fill(body.message, vars),
    cta: t.cta || null,
    path: t.path || '/dashboard',
  };
}

// ---------------------------------------------------------------------------
// Finders: who needs a message right now. Each returns
//   [{ userId, entityType, entityId, bucket, vars }]
// ---------------------------------------------------------------------------
const FINDERS = {
  async contractor_trial_ending({ supabase, now, rule }) {
    const trialDays = Number(rule.config?.trial_days) || 30;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, approved_at')
      .eq('role', 'contractor')
      .eq('approval_status', 'approved')
      .not('approved_at', 'is', null);
    if (error) throw error;
    const out = [];
    for (const p of data || []) {
      const end = new Date(new Date(p.approved_at).getTime() + trialDays * DAY);
      const daysLeft = daysUntil(end, now);
      const bucket = pickBefore(rule.offsets, daysLeft);
      if (bucket == null) continue;
      out.push({ userId: p.id, entityType: 'contractor', entityId: p.id, bucket, vars: { days: daysLeft, date: end.toISOString().slice(0, 10) } });
    }
    return out;
  },

  async client_onboarding_incomplete({ supabase, now, rule }) {
    const lookback = Number(rule.config?.lookback_days) || 7;
    const after = Number(rule.offsets?.[0]) || 1;
    const newest = new Date(now.getTime() - after * DAY).toISOString();
    const oldest = new Date(now.getTime() - lookback * DAY).toISOString();
    const { data: clients, error } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'client')
      .eq('approval_status', 'approved')
      .lte('created_at', newest)
      .gte('created_at', oldest);
    if (error) throw error;
    const ids = (clients || []).map((c) => c.id);
    if (!ids.length) return [];
    const { data: apps, error: appErr } = await supabase.from('applications').select('client_id').in('client_id', ids);
    if (appErr) throw appErr;
    const started = new Set((apps || []).map((a) => a.client_id));
    return ids.filter((id) => !started.has(id)).map((id) => ({ userId: id, entityType: 'client', entityId: id, bucket: after, vars: {} }));
  },

  async invoice_unpaid({ supabase, now, rule }) {
    const lookback = Number(rule.config?.lookback_days) || 14;
    const today = now.toISOString().slice(0, 10);
    const from = new Date(now.getTime() - lookback * DAY).toISOString().slice(0, 10);
    const { data, error } = await supabase
      .from('invoices')
      .select('id, client_id, invoice_number, currency, total, amount_paid, due_date')
      .eq('status', 'issued')
      .not('due_date', 'is', null)
      .not('client_id', 'is', null)
      .gte('due_date', from)
      .lte('due_date', today);
    if (error) throw error;
    const out = [];
    for (const inv of data || []) {
      const owed = Number(inv.total) - Number(inv.amount_paid || 0);
      if (!(owed > 0)) continue;
      const daysPast = Math.floor((new Date(today).getTime() - new Date(inv.due_date).getTime()) / DAY);
      const bucket = pickAfter(rule.offsets, daysPast);
      if (bucket == null) continue;
      out.push({
        userId: inv.client_id, entityType: 'invoice', entityId: inv.id, bucket,
        vars: { invoice: inv.invoice_number, amount: `${inv.currency} ${owed.toFixed(2)}`, date: inv.due_date, days: daysPast },
      });
    }
    return out;
  },

  async documents_missing({ supabase, now, rule }) {
    const every = Number(rule.config?.every_days) || 3;
    const max = Number(rule.config?.max_reminders) || 4;
    const lookback = Number(rule.config?.lookback_days) || 45;
    const oldest = new Date(now.getTime() - lookback * DAY).toISOString();
    const newest = new Date(now.getTime() - every * DAY).toISOString();
    const { data: apps, error } = await supabase
      .from('applications')
      .select('id, client_id, company_name, created_at')
      .not('selected_package', 'is', null)
      .not('status', 'in', '(approved,rejected,completed,cancelled)')
      .neq('certification_status', 'approved')
      .gte('created_at', oldest)
      .lte('created_at', newest);
    if (error) throw error;
    const ids = (apps || []).map((a) => a.id);
    if (!ids.length) return [];
    const { data: docs, error: docErr } = await supabase.from('documents').select('application_id').in('application_id', ids);
    if (docErr) throw docErr;
    const hasDocs = new Set((docs || []).map((d) => d.application_id));
    const out = [];
    for (const a of apps) {
      if (hasDocs.has(a.id)) continue;
      const age = Math.floor((now.getTime() - new Date(a.created_at).getTime()) / DAY);
      const bucket = Math.floor(age / every);
      if (bucket < 1 || bucket > max) continue;
      out.push({ userId: a.client_id, entityType: 'application', entityId: a.id, bucket, vars: { company: a.company_name } });
    }
    return out;
  },

  async certificate_expiry({ supabase, now, rule }) {
    const horizon = Math.max(...rule.offsets);
    const { data, error } = await supabase
      .from('certificates')
      .select('id, client_id, company_name, iso_standard, certificate_number, expires_at, renewal_reminded_at')
      .eq('status', 'active')
      .gt('expires_at', now.toISOString())
      .lte('expires_at', new Date(now.getTime() + horizon * DAY).toISOString());
    if (error) throw error;
    const out = [];
    for (const c of data || []) {
      const daysLeft = daysUntil(c.expires_at, now);
      const bucket = pickBefore(rule.offsets, daysLeft);
      if (bucket == null) continue;
      // The old 30-day reminder already went to this certificate: do not repeat it.
      if (c.renewal_reminded_at && bucket === Math.min(...rule.offsets)) continue;
      out.push({
        userId: c.client_id, entityType: 'certificate', entityId: c.id, bucket,
        vars: { company: c.company_name, iso: c.iso_standard, number: c.certificate_number, days: daysLeft, date: String(c.expires_at).slice(0, 10) },
      });
    }
    return out;
  },
};

// ---------------------------------------------------------------------------
// Delivery
// ---------------------------------------------------------------------------
async function deliverDefault({ supabase, candidate, rule, message, profile, evId }) {
  const results = {};
  const link = `${APP_URL}${message.path}`;
  const channels = rule.channels || ['in_app'];

  if (channels.includes('in_app')) {
    const { error } = await supabase.from('notifications').insert({
      user_id: candidate.userId, type: 'reminder', title: message.title, message: message.message, link: message.path, event_id: evId,
    });
    results.in_app = error ? `failed: ${error.message}` : 'sent';
  }

  if (channels.includes('email')) {
    if (!profile?.email) {
      results.email = 'skipped: no email address';
    } else {
      try {
        const mail = notificationEmail({ name: profile.full_name || null, title: message.title, message: message.message, ctaLabel: message.cta, ctaUrl: link });
        await sendViaResend({ to: profile.email, subject: message.title, html: mail.html, text: mail.text });
        results.email = 'sent';
      } catch (e) {
        results.email = `failed: ${e.message}`;
      }
    }
  }

  if (channels.includes('whatsapp')) {
    try {
      const r = await sendWhatsApp({ to: profile?.phone, text: `${message.title}\n${message.message}\n${link}` });
      results.whatsapp = r?.ok ? 'sent' : `skipped: ${r?.skipped || r?.error || 'not configured'}`;
    } catch (e) {
      results.whatsapp = `failed: ${e.message}`;
    }
  }
  return results;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------
const isMissingTable = (err) => err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message || ''));

/**
 * Run every enabled rule once.
 *   dryRun   only count who would be messaged: nothing is logged or sent
 *   only     run one rule key
 *   finders / deliver / rules  injectable for tests
 */
export async function runNotificationEngine({
  supabase, now = new Date(), dryRun = false, only = null, rules = null, finders = FINDERS, deliver = deliverDefault, maxSends = MAX_SENDS_PER_RUN,
} = {}) {
  // 1. Rules: the table when it exists, else the defaults (dry runs work before the migration is applied).
  let active = rules;
  let persisted = true;
  if (!active) {
    const { data, error } = await supabase.from('notification_rules').select('*');
    if (isMissingTable(error)) {
      if (!dryRun) return { ok: false, skipped: 'not_migrated', message: 'Run supabase/phase47_notification_engine.sql first.' };
      persisted = false;
      active = DEFAULT_RULES;
    } else if (error) {
      return { ok: false, error: error.message };
    } else {
      const have = new Set((data || []).map((r) => r.key));
      const missing = DEFAULT_RULES.filter((r) => !have.has(r.key));
      if (missing.length && !dryRun) await supabase.from('notification_rules').insert(missing);
      active = [...(data || []), ...missing];
    }
  }

  const summary = { ok: true, dryRun, persisted, rules: {} };
  let sends = 0;

  for (const rule of active) {
    if (only && rule.key !== only) continue;
    if (rule.enabled === false) { summary.rules[rule.key] = { enabled: false }; continue; }
    const finder = finders[rule.key];
    if (!finder) { summary.rules[rule.key] = { skipped: 'no finder' }; continue; }
    const row = { candidates: 0, sent: 0, duplicates: 0, failed: 0, deferred: 0 };
    summary.rules[rule.key] = row;

    let candidates;
    try {
      candidates = await finder({ supabase, now, rule });
    } catch (e) {
      row.error = e.message || String(e);
      continue;
    }
    row.candidates = candidates.length;
    if (dryRun) continue;

    for (const candidate of candidates) {
      if (sends >= maxSends) { row.deferred += 1; continue; }
      const evId = eventId(rule.key, candidate.entityId, candidate.bucket);

      // The unique event id is the lock: whoever inserts the row owns the send.
      const { error: logErr } = await supabase.from('notification_log').insert({
        event_id: evId, rule_key: rule.key, user_id: candidate.userId, entity_type: candidate.entityType,
        entity_id: String(candidate.entityId), bucket: String(candidate.bucket), scheduled_for: now.toISOString(),
      });
      if (logErr) {
        if (logErr.code === '23505' || /duplicate key/i.test(logErr.message || '')) row.duplicates += 1;
        else row.failed += 1;
        continue;
      }

      sends += 1;
      try {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', candidate.userId).maybeSingle();
        const message = renderTemplate(rule, { lang: 'en', bucket: candidate.bucket, vars: candidate.vars });
        if (!message) { row.failed += 1; continue; }
        const results = await deliver({ supabase, candidate, rule, message, profile, evId });
        const anyFailed = Object.values(results).some((v) => String(v).startsWith('failed'));
        await supabase.from('notification_log').update({ sent_at: new Date().toISOString(), channels: results, error: anyFailed ? JSON.stringify(results) : null }).eq('event_id', evId);
        if (anyFailed) row.failed += 1; else row.sent += 1;
      } catch (e) {
        row.failed += 1;
        await supabase.from('notification_log').update({ error: e.message || String(e) }).eq('event_id', evId);
      }
    }
  }
  return summary;
}
