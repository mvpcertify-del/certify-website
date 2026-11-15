import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_RULES, daysUntil, pickBefore, pickAfter, eventId, fill, renderTemplate, runNotificationEngine,
} from '../../api/_notifyEngine.js';
import { notificationEmail } from '../../api/_emailTemplates.js';

const DAY = 86400000;
const NOW = new Date('2026-11-20T09:00:00Z');
const daysAgo = (n) => new Date(NOW.getTime() - n * DAY).toISOString();
const daysAhead = (n) => new Date(NOW.getTime() + n * DAY).toISOString();
const rule = (key) => DEFAULT_RULES.find((r) => r.key === key);

// A tiny in-memory stand-in for the Supabase query builder: just the calls the engine uses.
function fakeDb(tables = {}, { missingRules = false } = {}) {
  const store = Object.fromEntries(Object.entries(tables).map(([k, v]) => [k, [...v]]));
  const unique = new Set((store.notification_log || []).map((r) => r.event_id));
  const from = (name) => {
    const filters = [];
    let mode = 'select'; let payload = null;
    const b = {
      select() { return b; },
      insert(p) { mode = 'insert'; payload = p; return b; },
      update(p) { mode = 'update'; payload = p; return b; },
      eq(c, v) { filters.push((r) => r[c] === v); return b; },
      neq(c, v) { filters.push((r) => r[c] !== v); return b; },
      gt(c, v) { filters.push((r) => r[c] > v); return b; },
      gte(c, v) { filters.push((r) => r[c] >= v); return b; },
      lte(c, v) { filters.push((r) => r[c] <= v); return b; },
      in(c, arr) { filters.push((r) => arr.includes(r[c])); return b; },
      not(c, op, v) {
        if (op === 'is') filters.push((r) => (v === null ? r[c] != null : r[c] !== v));
        if (op === 'in') { const set = String(v).replace(/[()]/g, '').split(','); filters.push((r) => !set.includes(r[c])); }
        return b;
      },
      maybeSingle() { b.single = true; return b; },
      then(resolve) {
        if (name === 'notification_rules' && missingRules) return resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } });
        const rows = store[name] || (store[name] = []);
        if (mode === 'insert') {
          const list = Array.isArray(payload) ? payload : [payload];
          for (const row of list) {
            if (name === 'notification_log') {
              if (unique.has(row.event_id)) return resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
              unique.add(row.event_id);
            }
            rows.push({ ...row });
          }
          return resolve({ data: null, error: null });
        }
        const hit = rows.filter((r) => filters.every((f) => f(r)));
        if (mode === 'update') { hit.forEach((r) => Object.assign(r, payload)); return resolve({ data: null, error: null }); }
        return resolve({ data: b.single ? (hit[0] || null) : hit, error: null });
      },
    };
    return b;
  };
  return { from, store };
}

// ---------------------------------------------------------------------------
// Timing
// ---------------------------------------------------------------------------
test('days left are counted from the real date and rounded up', () => {
  assert.equal(daysUntil(daysAhead(7), NOW), 7);
  assert.equal(daysUntil(new Date(NOW.getTime() + 6 * 3600000), NOW), 1);
  assert.equal(daysUntil(daysAgo(2), NOW), -2);
});

test('a "before" reminder picks the nearest offset that is still ahead, and never two at once', () => {
  const o = [7, 3, 1];
  assert.equal(pickBefore(o, 7), 7);
  assert.equal(pickBefore(o, 5), 7); // the 7 day message was missed: it still goes, once
  assert.equal(pickBefore(o, 3), 3);
  assert.equal(pickBefore(o, 2), 3);
  assert.equal(pickBefore(o, 1), 1);
  assert.equal(pickBefore(o, 0), null); // ended
  assert.equal(pickBefore(o, -4), null);
  assert.equal(pickBefore(o, 8), null); // too early
});

test('an "after" reminder picks the latest offset reached', () => {
  const o = [0, 3];
  assert.equal(pickAfter(o, -1), null);
  assert.equal(pickAfter(o, 0), 0);
  assert.equal(pickAfter(o, 2), 0);
  assert.equal(pickAfter(o, 3), 3);
  assert.equal(pickAfter(o, 9), 3);
});

test('the event id is rule, entity and bucket', () => {
  assert.equal(eventId('contractor_trial_ending', 'abc', 7), 'contractor_trial_ending:abc:7');
});

// ---------------------------------------------------------------------------
// Wording
// ---------------------------------------------------------------------------
test('placeholders are filled and unknown ones are left empty', () => {
  assert.equal(fill('Ends in {{days}} days {{nope}}!', { days: 5 }), 'Ends in 5 days !');
});

test('the trial reminders use the client\'s wording for 7, 3 and 1 days', () => {
  const r = rule('contractor_trial_ending');
  assert.match(renderTemplate(r, { bucket: 7, vars: { days: 6 } }).title, /ends in 6 days/);
  assert.match(renderTemplate(r, { bucket: 3, vars: { days: 3 } }).title, /Only 3 days left/);
  assert.match(renderTemplate(r, { bucket: 1, vars: {} }).title, /expires tomorrow/);
});

test('an unknown language falls back to English', () => {
  assert.ok(renderTemplate(rule('certificate_expiry'), { lang: 'ar', bucket: 60, vars: { days: 55 } }));
});

test('the reminder email escapes what it prints and carries the button', () => {
  const m = notificationEmail({ name: '<b>x</b>', title: 'T <i>', message: 'M & N', ctaLabel: 'Go', ctaUrl: 'https://certify.cx/x' });
  assert.ok(!m.html.includes('<b>x</b>'));
  assert.match(m.html, /M &amp; N/);
  assert.match(m.html, /href="https:\/\/certify\.cx\/x"/);
  assert.equal(m.subject, 'T <i>');
});

// ---------------------------------------------------------------------------
// The run (finders + de-duplication)
// ---------------------------------------------------------------------------
const noDeliver = async () => ({ in_app: 'sent', email: 'sent' });

test('contractor trial: reminded 7, 3 and 1 days before the 30 day mark, counted from approval', async () => {
  const db = fakeDb({
    profiles: [
      { id: 'c1', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(23) }, // 7 days left
      { id: 'c2', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(27) }, // 3 left
      { id: 'c3', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(29) }, // 1 left
      { id: 'c4', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(10) }, // far off
      { id: 'c5', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(40) }, // ended
      { id: 'c6', role: 'contractor', approval_status: 'pending', approved_at: null },
    ],
  });
  const res = await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('contractor_trial_ending')], deliver: noDeliver });
  const logged = db.store.notification_log.map((r) => r.event_id).sort();
  assert.deepEqual(logged, ['contractor_trial_ending:c1:7', 'contractor_trial_ending:c2:3', 'contractor_trial_ending:c3:1']);
  assert.equal(res.rules.contractor_trial_ending.sent, 3);
});

test('running twice sends nothing the second time', async () => {
  const db = fakeDb({ profiles: [{ id: 'c1', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(27) }] });
  let delivered = 0;
  const deliver = async () => { delivered += 1; return { email: 'sent' }; };
  await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('contractor_trial_ending')], deliver });
  const again = await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('contractor_trial_ending')], deliver });
  assert.equal(delivered, 1);
  assert.equal(again.rules.contractor_trial_ending.duplicates, 1);
});

test('a switched-off rule sends nothing', async () => {
  const db = fakeDb({ profiles: [{ id: 'c1', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(27) }] });
  const off = { ...rule('contractor_trial_ending'), enabled: false };
  const res = await runNotificationEngine({ supabase: db, now: NOW, rules: [off], deliver: noDeliver });
  assert.equal(res.rules.contractor_trial_ending.enabled, false);
  assert.equal((db.store.notification_log || []).length, 0);
});

test('a dry run counts but logs and sends nothing', async () => {
  const db = fakeDb({ profiles: [{ id: 'c1', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(27) }] });
  let delivered = 0;
  const res = await runNotificationEngine({ supabase: db, now: NOW, dryRun: true, rules: [rule('contractor_trial_ending')], deliver: async () => { delivered += 1; return {}; } });
  assert.equal(res.rules.contractor_trial_ending.candidates, 1);
  assert.equal(delivered, 0);
  assert.equal((db.store.notification_log || []).length, 0);
});

test('one run never sends more than the cap; the rest wait for tomorrow', async () => {
  const profiles = Array.from({ length: 6 }, (_, i) => ({ id: `c${i}`, role: 'contractor', approval_status: 'approved', approved_at: daysAgo(27) }));
  const db = fakeDb({ profiles });
  const res = await runNotificationEngine({ supabase: db, now: NOW, maxSends: 4, rules: [rule('contractor_trial_ending')], deliver: noDeliver });
  assert.equal(res.rules.contractor_trial_ending.sent, 4);
  assert.equal(res.rules.contractor_trial_ending.deferred, 2);
  const next = await runNotificationEngine({ supabase: db, now: NOW, maxSends: 4, rules: [rule('contractor_trial_ending')], deliver: noDeliver });
  assert.equal(next.rules.contractor_trial_ending.sent, 2); // the two that were deferred
});

test('before the migration the engine sends nothing, but a dry run still works', async () => {
  const db = fakeDb({ profiles: [] }, { missingRules: true });
  const live = await runNotificationEngine({ supabase: db, now: NOW });
  assert.equal(live.skipped, 'not_migrated');
  const dry = await runNotificationEngine({ supabase: db, now: NOW, dryRun: true });
  assert.equal(dry.ok, true);
  assert.equal(dry.persisted, false);
});

test('client onboarding: only clients registered 1 to 7 days ago who have no application', async () => {
  const db = fakeDb({
    profiles: [
      { id: 'a', role: 'client', approval_status: 'approved', created_at: daysAgo(2) }, // yes
      { id: 'b', role: 'client', approval_status: 'approved', created_at: daysAgo(2) }, // has an application
      { id: 'c', role: 'client', approval_status: 'approved', created_at: daysAgo(0.2) }, // too new
      { id: 'd', role: 'client', approval_status: 'approved', created_at: daysAgo(60) }, // history, not blasted
    ],
    applications: [{ id: 'x', client_id: 'b' }],
  });
  await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('client_onboarding_incomplete')], deliver: noDeliver });
  assert.deepEqual(db.store.notification_log.map((r) => r.event_id), ['client_onboarding_incomplete:a:1']);
});

test('unpaid invoice: due today and three days later, never when paid or old', async () => {
  const day = (n) => new Date(NOW.getTime() - n * DAY).toISOString().slice(0, 10);
  const inv = (id, due, extra = {}) => ({ id, client_id: `u${id}`, invoice_number: `INV-${id}`, currency: 'USD', total: 100, amount_paid: 0, status: 'issued', due_date: due, ...extra });
  const db = fakeDb({
    invoices: [inv('1', day(0)), inv('2', day(3)), inv('3', day(1)), inv('4', day(5), { amount_paid: 100 }), inv('5', day(40)), inv('6', day(0), { status: 'paid' })],
  });
  await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('invoice_unpaid')], deliver: noDeliver });
  assert.deepEqual(db.store.notification_log.map((r) => r.event_id).sort(), ['invoice_unpaid:1:0', 'invoice_unpaid:2:3', 'invoice_unpaid:3:0']);
});

test('missing documents: every 3 days, up to 4 times, only while nothing is uploaded', async () => {
  const app = (id, age, extra = {}) => ({ id, client_id: `u${id}`, company_name: 'Co', selected_package: 'p', status: 'pending', certification_status: 'pending', created_at: daysAgo(age), ...extra });
  const db = fakeDb({
    applications: [app('a', 3), app('b', 7), app('c', 20), app('d', 4), app('e', 10, { status: 'approved' }), app('f', 2)],
    documents: [{ application_id: 'd' }],
  });
  await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('documents_missing')], deliver: noDeliver });
  assert.deepEqual(db.store.notification_log.map((r) => r.event_id).sort(), ['documents_missing:a:1', 'documents_missing:b:2']);
});

test('certificate expiry: 90, 60 and 30 days, but not the 30 day one twice', async () => {
  const cert = (id, ahead, extra = {}) => ({ id, client_id: `u${id}`, company_name: 'Co', iso_standard: 'ISO 9001', certificate_number: `C-${id}`, status: 'active', expires_at: daysAhead(ahead), renewal_reminded_at: null, ...extra });
  const db = fakeDb({
    certificates: [cert('1', 85), cert('2', 55), cert('3', 25), cert('4', 25, { renewal_reminded_at: daysAgo(1) }), cert('5', 120), cert('6', 25, { status: 'expired' })],
  });
  await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('certificate_expiry')], deliver: noDeliver });
  assert.deepEqual(db.store.notification_log.map((r) => r.event_id).sort(), ['certificate_expiry:1:90', 'certificate_expiry:2:60', 'certificate_expiry:3:30']);
});

test('a failed channel is recorded and does not stop the others', async () => {
  const db = fakeDb({ profiles: [{ id: 'c1', role: 'contractor', approval_status: 'approved', approved_at: daysAgo(27) }] });
  const res = await runNotificationEngine({ supabase: db, now: NOW, rules: [rule('contractor_trial_ending')], deliver: async () => ({ in_app: 'sent', email: 'failed: boom' }) });
  assert.equal(res.rules.contractor_trial_ending.failed, 1);
  const row = db.store.notification_log[0];
  assert.equal(row.channels.in_app, 'sent');
  assert.match(row.error, /boom/);
});
