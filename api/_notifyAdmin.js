// Super Admin actions for the notification engine: the proof page ("who was notified") and its controls.
//
// No new serverless function (the Hobby plan allows 12). api/notify-event.js hands every action that starts
// with "notify-admin-" to this file, which verifies the caller is a Super Admin itself.
//
//   notify-admin-overview     rules + totals + the delivery log, with who received each message
//   notify-admin-update-rule  switch a rule on/off, change its days and channels
//   notify-admin-check        dry run: how many people each rule would message today (nothing is sent)

import { verifyAdmin, getAdmin } from './_verifyAdmin.js';
import { DEFAULT_RULES, runNotificationEngine } from './_notifyEngine.js';

const CHANNELS = ['in_app', 'email', 'whatsapp'];
const MAX_LOG_ROWS = 300;

const isMissingTable = (err) => err && (err.code === '42P01' || err.code === 'PGRST205' || /does not exist|schema cache/i.test(err.message || ''));

/** Stored rows, plus the built-in default for any rule the engine has not saved yet. */
async function loadRules(db) {
  const { data, error } = await db.from('notification_rules').select('*');
  if (isMissingTable(error)) return { migrated: false, rules: [] };
  if (error) throw error;
  const have = new Map((data || []).map((r) => [r.key, r]));
  const rules = DEFAULT_RULES.map((d) => ({ ...(have.get(d.key) || d), saved: have.has(d.key) }));
  for (const r of data || []) if (!DEFAULT_RULES.some((d) => d.key === r.key)) rules.push({ ...r, saved: true });
  return { migrated: true, rules };
}

async function overview(db, days) {
  const { migrated, rules } = await loadRules(db);
  if (!migrated) return { migrated: false };

  const since = new Date(Date.now() - days * 86400000).toISOString();
  const { data: rows, error } = await db
    .from('notification_log')
    .select('id, event_id, rule_key, user_id, bucket, entity_type, sent_at, channels, error, created_at')
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(1000);
  if (error) throw error;
  const all = rows || [];

  // Who received each message.
  const ids = [...new Set(all.map((r) => r.user_id).filter(Boolean))];
  const people = new Map();
  if (ids.length) {
    const { data } = await db.from('profiles').select('id, full_name, email, role').in('id', ids);
    for (const p of data || []) people.set(p.id, p);
  }

  // Whether the in-app copy has been read (the inbox row carries the event id).
  const eventIds = all.map((r) => r.event_id);
  const read = new Map();
  if (eventIds.length) {
    const { data } = await db.from('notifications').select('event_id, read').in('event_id', eventIds.slice(0, 1000));
    for (const n of data || []) read.set(n.event_id, !!n.read);
  }

  const status = (r) => (r.error ? 'failed' : (r.sent_at ? 'sent' : 'pending'));
  const log = all.slice(0, MAX_LOG_ROWS).map((r) => {
    const p = people.get(r.user_id) || {};
    return {
      id: r.id,
      ruleKey: r.rule_key,
      bucket: r.bucket,
      when: r.sent_at || r.created_at,
      status: status(r),
      channels: r.channels || {},
      error: r.error || null,
      recipient: { name: p.full_name || null, email: p.email || null, role: p.role || null },
      inAppRead: read.has(r.event_id) ? read.get(r.event_id) : null,
    };
  });

  const perRule = {};
  for (const r of all) {
    const s = (perRule[r.rule_key] ||= { sent: 0, failed: 0, last: null });
    if (status(r) === 'sent') s.sent += 1;
    if (status(r) === 'failed') s.failed += 1;
    if (!s.last || (r.sent_at || r.created_at) > s.last) s.last = r.sent_at || r.created_at;
  }

  return {
    migrated: true,
    days,
    totals: {
      sent: all.filter((r) => status(r) === 'sent').length,
      failed: all.filter((r) => status(r) === 'failed').length,
      inAppRead: [...read.values()].filter(Boolean).length,
      inAppUnread: [...read.values()].filter((v) => !v).length,
      people: ids.length,
    },
    rules: rules.map((r) => ({
      key: r.key, title: r.title, description: r.description, enabled: r.enabled !== false, offsets: r.offsets || [],
      channels: r.channels || [], recipientRole: r.recipient_role || null, saved: r.saved, stats: perRule[r.key] || { sent: 0, failed: 0, last: null },
    })),
    log,
  };
}

export function cleanUpdate(body) {
  const out = {};
  if (typeof body.enabled === 'boolean') out.enabled = body.enabled;
  if (body.offsets !== undefined) {
    const o = Array.isArray(body.offsets) ? body.offsets.map(Number) : [];
    if (!o.length || o.length > 6 || o.some((n) => !Number.isInteger(n) || n < 0 || n > 365)) {
      const e = new Error('Days must be 1 to 6 whole numbers between 0 and 365.'); e.status = 400; throw e;
    }
    out.offsets = [...new Set(o)].sort((a, b) => b - a);
  }
  if (body.channels !== undefined) {
    const c = Array.isArray(body.channels) ? body.channels : [];
    if (!c.length || c.some((x) => !CHANNELS.includes(x))) {
      const e = new Error('Choose at least one channel: in_app, email or whatsapp.'); e.status = 400; throw e;
    }
    out.channels = [...new Set(c)];
  }
  return out;
}

export async function handleNotifyAdminAction(req, res) {
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status || 403).json({ error: auth.error });

  const action = String(req.body?.action || '');
  const db = getAdmin();
  try {
    if (action === 'notify-admin-overview') {
      const days = [7, 30, 90].includes(Number(req.body?.days)) ? Number(req.body.days) : 30;
      return res.status(200).json(await overview(db, days));
    }

    if (action === 'notify-admin-update-rule') {
      const key = String(req.body?.key || '');
      const base = DEFAULT_RULES.find((r) => r.key === key);
      const { data: stored, error: findErr } = await db.from('notification_rules').select('key').eq('key', key).maybeSingle();
      if (isMissingTable(findErr)) return res.status(409).json({ error: 'Run supabase/phase47_notification_engine.sql first.' });
      if (!base && !stored) return res.status(400).json({ error: 'Unknown notification.' });
      const changes = cleanUpdate(req.body || {});
      if (!Object.keys(changes).length) return res.status(400).json({ error: 'Nothing to change.' });
      const now = new Date().toISOString();
      const { error } = stored
        ? await db.from('notification_rules').update({ ...changes, updated_at: now }).eq('key', key)
        : await db.from('notification_rules').insert({ ...base, ...changes, updated_at: now });
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'notify-admin-check') {
      const summary = await runNotificationEngine({ supabase: db, dryRun: true });
      return res.status(200).json(summary);
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('[notify-admin]', action, e?.message || e);
    return res.status(e?.status || 500).json({ error: e?.message || 'Notification action failed' });
  }
}
