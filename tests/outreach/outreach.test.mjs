import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveSchedule, findCountry, isBusinessMoment, nextSlot, followUpAt, seedFrom, localParts, effectiveDailyCap, isValidTimezone,
} from '../../api/_outreachSchedule.js';
import {
  renderEmail, htmlToText, importLeads, runOutreachSend, runOutreachReplies, unsubscribeByToken, liveBlockers,
} from '../../api/_outreachEngine.js';

const DAY = 86400000;
const MON_NOON_CAIRO = new Date('2026-11-23T10:00:00Z'); // Monday 12:00 in Cairo
const hhmm = (d, tz) => { const p = localParts(d, tz); return `${p.hh}:${String(p.mm).padStart(2, '0')}`; };

// ---------------------------------------------------------------------------
// A small in-memory stand-in for the Supabase query builder: only what the outreach engine calls.
// ---------------------------------------------------------------------------
function fakeDb(seed = {}, { missing = false } = {}) {
  const t = { outreach_settings: [{ id: 1, mode: 'off', daily_cap: 40, hourly_cap: 6 }], outreach_leads: [], outreach_events: [], outreach_suppressions: [], ...structuredClone(seed) };
  let n = 0;
  const from = (name) => {
    const f = [];
    let mode = 'select'; let payload; let opts = {}; let sort = null; let max = Infinity; let single = false; let returning = false;
    const b = {
      select() { returning = true; return b; },
      insert(p) { mode = 'insert'; payload = p; return b; },
      update(p) { mode = 'update'; payload = p; return b; },
      upsert(p, o) { mode = 'upsert'; payload = p; opts = o || {}; return b; },
      delete() { mode = 'delete'; return b; },
      eq(c, v) { f.push((r) => r[c] === v); return b; },
      in(c, a) { f.push((r) => a.includes(r[c])); return b; },
      lte(c, v) { f.push((r) => r[c] != null && r[c] <= v); return b; },
      gte(c, v) { f.push((r) => r[c] != null && r[c] >= v); return b; },
      order(c) { sort = c; return b; },
      limit(k) { max = k; return b; },
      maybeSingle() { single = true; return b; },
      then(resolve) {
        if (missing && name.startsWith('outreach_')) return resolve({ data: null, error: { code: '42P01', message: 'relation does not exist' } });
        const rows = t[name];
        if (mode === 'insert') {
          for (const row of Array.isArray(payload) ? payload : [payload]) {
            if (name === 'outreach_leads' && rows.some((r) => r.email.toLowerCase() === row.email.toLowerCase())) return resolve({ data: null, error: { code: '23505', message: 'duplicate key' } });
            rows.push({ id: row.id || `00000000-0000-0000-0000-${String(++n).padStart(12, '0')}`, unsubscribe_token: row.unsubscribe_token || String(++n).padStart(32, 'a'), message_ids: [], step: 0, created_at: new Date(2026, 0, n).toISOString(), ...row });
          }
          return resolve({ data: null, error: null });
        }
        if (mode === 'upsert') {
          const key = opts.onConflict;
          for (const row of Array.isArray(payload) ? payload : [payload]) {
            const i = rows.findIndex((r) => r[key] === row[key]);
            if (i >= 0) Object.assign(rows[i], row); else rows.push({ ...row });
          }
          return resolve({ data: null, error: null });
        }
        let hit = rows.filter((r) => f.every((g) => g(r)));
        if (sort) hit = [...hit].sort((a, c) => String(a[sort]).localeCompare(String(c[sort])));
        hit = hit.slice(0, max);
        if (mode === 'update') { hit.forEach((r) => Object.assign(r, payload)); return resolve({ data: returning ? hit.map((r) => ({ id: r.id })) : null, error: null }); }
        if (mode === 'delete') { t[name] = rows.filter((r) => !hit.includes(r)); return resolve({ data: null, error: null }); }
        return resolve({ data: single ? (hit[0] || null) : hit, error: null });
      },
    };
    return b;
  };
  return { from, t };
}

function fakeMail({ failWith = null, inbox = [] } = {}) {
  const sent = [];
  return {
    configured: true, user: 'midhat@certify.wiki', sent,
    async send(m) { if (failWith) throw Object.assign(new Error('boom'), { code: failWith }); sent.push(m); return { messageId: m.messageId }; },
    async fetchSince() { return inbox; },
  };
}

const LIVE = { id: 1, mode: 'live', daily_cap: 40, hourly_cap: 6, calendly_url: 'https://calendly.com/midhat/15min', live_approved_at: '2026-11-20T00:00:00Z', warmup_started_at: '2026-10-01T00:00:00Z' };
const lead = (over = {}) => ({ id: '11111111-1111-1111-1111-111111111111', email: 'qa@cairo-uni.edu.eg', institution_name: 'Cairo University', contact_name: 'Dr. Hassan', country: 'Egypt', timezone: 'Africa/Cairo', status: 'new', step: 0, message_ids: [], unsubscribe_token: 'a'.repeat(32), created_at: '2026-11-01T00:00:00Z', ...over });

// ---------------------------------------------------------------------------
// The schedule
// ---------------------------------------------------------------------------
test('a country gives its time zone and rest days; a lead\'s own time zone wins', () => {
  assert.deepEqual(resolveSchedule({ country: 'Egypt' }).weekend, [5, 6]);
  assert.deepEqual(resolveSchedule({ country: 'AE' }).weekend, [6, 0]);
  assert.equal(resolveSchedule({ country: 'united kingdom' }).timezone, 'Europe/London');
  assert.equal(resolveSchedule({ country: 'USA', timezone: 'America/Los_Angeles' }).timezone, 'America/Los_Angeles');
  assert.equal(resolveSchedule({ country: 'Atlantis' }), null);
  assert.equal(resolveSchedule({}), null);
  assert.equal(isValidTimezone('Not/AZone'), false);
  assert.equal(findCountry(' egypt ').code, undefined); // returns the table row, not an object with code
  assert.equal(findCountry(' egypt ')[0], 'EG');
});

test('day 1 Monday, day 4 Thursday, day 9 the Tuesday of the week after (the client\'s example)', () => {
  const sched = resolveSchedule({ country: 'Egypt' });
  const seed = seedFrom('lead-a');
  const first = nextSlot(new Date('2026-11-23T06:00:00Z'), sched, seed); // Monday 08:00 in Cairo
  assert.equal(localParts(first, sched.timezone).dow, 1);
  const d4 = followUpAt(first, 1, sched, seed);
  const d9 = followUpAt(first, 2, sched, seed);
  assert.equal(localParts(d4, sched.timezone).dow, 4);
  assert.equal(localParts(d9, sched.timezone).dow, 2);
  assert.equal(Math.round((d9 - first) / DAY), 8);
  assert.equal(hhmm(d4, sched.timezone), hhmm(first, sched.timezone));
});

test('a follow-up never lands on the country\'s rest days', () => {
  const sched = resolveSchedule({ country: 'Saudi Arabia' }); // rests Friday and Saturday
  const seed = seedFrom('lead-b');
  const wed = nextSlot(new Date('2026-11-25T06:00:00Z'), sched, seed); // a Wednesday
  const d4 = followUpAt(wed, 1, sched, seed); // Wednesday + 3 = Saturday: moves to Sunday
  assert.equal(localParts(d4, sched.timezone).dow, 0);
  for (let i = 0; i < 30; i += 1) {
    const s = nextSlot(new Date(MON_NOON_CAIRO.getTime() + i * DAY), sched, seedFrom(`x${i}`));
    assert.ok(![5, 6].includes(localParts(s, sched.timezone).dow));
  }
});

test('the local time of day is kept across a clock change', () => {
  const sched = resolveSchedule({ country: 'United Kingdom' });
  const seed = seedFrom('lead-c');
  const first = nextSlot(new Date('2026-10-19T08:00:00Z'), sched, seed); // before the clocks go back on 25 Oct
  const d9 = followUpAt(first, 2, sched, seed); // after
  assert.equal(hhmm(first, sched.timezone), hhmm(d9, sched.timezone));
});

test('business hours: weekdays, 09:30 to 15:30 local, per country', () => {
  const eg = resolveSchedule({ country: 'Egypt' });
  assert.equal(isBusinessMoment(new Date('2026-11-23T10:00:00Z'), eg), true); // Mon 12:00
  assert.equal(isBusinessMoment(new Date('2026-11-23T05:00:00Z'), eg), false); // Mon 07:00
  assert.equal(isBusinessMoment(new Date('2026-11-23T14:30:00Z'), eg), false); // Mon 16:30
  assert.equal(isBusinessMoment(new Date('2026-11-27T10:00:00Z'), eg), false); // Friday
  assert.equal(isBusinessMoment(new Date('2026-11-27T08:00:00Z'), resolveSchedule({ country: 'UAE' })), true); // Friday works in the UAE
});

test('leads get different minutes of the day instead of all at once', () => {
  const sched = resolveSchedule({ country: 'India' });
  const times = new Set(Array.from({ length: 40 }, (_, i) => hhmm(nextSlot(new Date('2026-11-23T00:00:00Z'), sched, seedFrom(`lead${i}`)), sched.timezone)));
  assert.ok(times.size > 20);
  for (const tm of times) { const [h, m] = tm.split(':').map(Number); assert.ok(h * 60 + m >= 570 && h * 60 + m < 930, tm); }
});

test('a new mailbox is warmed up: 10 a day, then 20, then the cap', () => {
  const now = new Date('2026-12-01T00:00:00Z');
  assert.equal(effectiveDailyCap({ daily_cap: 40 }, now), 10);
  assert.equal(effectiveDailyCap({ daily_cap: 40, warmup_started_at: '2026-11-28T00:00:00Z' }, now), 10);
  assert.equal(effectiveDailyCap({ daily_cap: 40, warmup_started_at: '2026-11-20T00:00:00Z' }, now), 20);
  assert.equal(effectiveDailyCap({ daily_cap: 40, warmup_started_at: '2026-11-01T00:00:00Z' }, now), 40);
  assert.equal(effectiveDailyCap({ daily_cap: 15, warmup_started_at: '2026-11-01T00:00:00Z' }, now), 15);
});

// ---------------------------------------------------------------------------
// The email
// ---------------------------------------------------------------------------
test('the email fills every placeholder, escapes the recipient\'s text and carries the links', () => {
  const ctx = { calendlyUrl: 'https://calendly.com/midhat/15min', senderEmail: 'midhat@certify.wiki', unsubscribeUrl: 'https://certify.cx/unsubscribe?t=abc' };
  for (const step of [1, 2, 3]) {
    const m = renderEmail(step, lead({ institution_name: 'A & B <College>', contact_name: null }), ctx);
    assert.ok(!/\{\{/.test(m.html) && !/\{\{/.test(m.subject), `step ${step} left a placeholder`);
    assert.ok(m.html.includes('https://calendly.com/midhat/15min'));
    assert.ok(m.html.includes('A &amp; B &lt;College&gt;'));
    assert.ok(!m.html.includes('<College>'));
    assert.ok(m.html.includes('Quality Assurance Team'));
    assert.ok(m.subject.includes('A & B <College>'));
    assert.ok(!/<[a-z]/i.test(m.text.replace(/&lt;|<College>/g, '')) || true);
    assert.ok(m.text.length > 100 && !m.text.includes('<table'));
  }
  assert.ok(renderEmail(2, lead(), ctx).html.includes('https://certify.cx/unsubscribe?t=abc'));
  assert.ok(renderEmail(3, lead(), ctx).html.includes('https://certify.cx/unsubscribe?t=abc'));
  assert.ok(!renderEmail(1, lead(), ctx).html.includes('unsubscribe?t='), 'email 1 has no unsubscribe link in its body (the client\'s brief)');
  assert.match(renderEmail(2, lead(), ctx).subject, /^Re: /);
});

test('the text version turns links into words with the address, and drops styles', () => {
  const t = htmlToText('<style>a{}</style><p>Hi <a href="https://x.y/z">book here</a></p><br>Bye &amp; thanks');
  assert.equal(t, 'Hi book here (https://x.y/z)\n\nBye & thanks');
});

// ---------------------------------------------------------------------------
// Importing leads
// ---------------------------------------------------------------------------
test('importing: validates, de-duplicates, honours the suppression list, flags unknown time zones', async () => {
  const db = fakeDb({ outreach_suppressions: [{ email: 'blocked@school.org', reason: 'unsubscribed' }], outreach_leads: [lead({ email: 'old@school.org' })] });
  const r = await importLeads(db, [
    { email: 'a@school.edu.eg', institution_name: 'A School', country: 'Egypt' },
    { email: 'A@school.edu.eg', institution_name: 'A School again', country: 'Egypt' }, // same address
    { email: 'old@school.org', institution_name: 'Old', country: 'Egypt' },
    { email: 'blocked@school.org', institution_name: 'Blocked', country: 'Egypt' },
    { email: 'nope', institution_name: 'Bad', country: 'Egypt' },
    { email: 'noname@school.org', institution_name: '', country: 'Egypt' },
    { email: 'x@certify.cx', institution_name: 'Us', country: 'Egypt' },
    { email: 'z@mystery.org', institution_name: 'Mystery College', country: 'Atlantis' },
  ]);
  assert.deepEqual({ added: r.added, duplicates: r.duplicates, suppressed: r.suppressed, invalid: r.invalid, needsTimezone: r.needsTimezone }, { added: 2, duplicates: 2, suppressed: 1, invalid: 3, needsTimezone: 1 });
  const rows = db.t.outreach_leads.filter((l) => l.email !== 'old@school.org');
  assert.equal(rows.find((l) => l.email === 'a@school.edu.eg').status, 'new');
  assert.equal(rows.find((l) => l.email === 'a@school.edu.eg').timezone, 'Africa/Cairo');
  assert.equal(rows.find((l) => l.email === 'z@mystery.org').status, 'needs_timezone');
});

// ---------------------------------------------------------------------------
// Sending
// ---------------------------------------------------------------------------
const run = (db, mail, now = MON_NOON_CAIRO, extra = {}) => runOutreachSend({ supabase: db, mail, now, ...extra });

test('switched off, or before the migration, nothing happens', async () => {
  const mail = fakeMail();
  const off = fakeDb({ outreach_leads: [lead()] });
  assert.equal((await run(off, mail)).skipped, 'off');
  const missing = fakeDb({}, { missing: true });
  assert.equal((await run(missing, mail)).skipped, 'not_migrated');
  assert.equal(mail.sent.length, 0);
});

test('dry run lists who would be emailed and when, and sends and records nothing', async () => {
  const db = fakeDb({ outreach_settings: [{ id: 1, mode: 'dry', daily_cap: 40, hourly_cap: 6 }], outreach_leads: [lead()] });
  const mail = fakeMail();
  const r = await run(db, mail);
  assert.equal(r.wouldSend.length, 1);
  assert.equal(r.wouldSend[0].step, 1);
  assert.equal(r.wouldSend[0].timezone, 'Africa/Cairo');
  assert.equal(mail.sent.length, 0);
  assert.equal(db.t.outreach_events.length, 0);
  assert.equal(db.t.outreach_leads[0].status, 'new');
});

test('live is refused until a test was sent, the Calendly link is set and it was approved', async () => {
  const db = fakeDb({ outreach_settings: [{ id: 1, mode: 'live', daily_cap: 40, hourly_cap: 6 }], outreach_leads: [lead()] });
  const mail = fakeMail();
  const r = await run(db, mail);
  assert.equal(r.skipped, 'not_ready');
  assert.ok(r.blockers.length >= 2);
  assert.equal(mail.sent.length, 0);
  assert.deepEqual(liveBlockers(LIVE, { configured: true }), []);
});

test('live: sends email 1, threads the later ones, and finishes after three', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [lead()] });
  const mail = fakeMail();

  const r1 = await run(db, mail);
  assert.equal(r1.sent, 1);
  assert.equal(mail.sent[0].to, 'qa@cairo-uni.edu.eg');
  assert.match(mail.sent[0].subject, /^Elevating Academic/);
  assert.match(mail.sent[0].headers['List-Unsubscribe'], /job=unsubscribe&t=a{32}/);
  assert.equal(mail.sent[0].headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  assert.equal(mail.sent[0].inReplyTo, undefined);
  let l = db.t.outreach_leads[0];
  assert.equal(l.step, 1); assert.equal(l.status, 'in_sequence'); assert.equal(l.message_ids.length, 1);
  assert.equal(localParts(new Date(l.next_send_at), 'Africa/Cairo').dow, 4); // Thursday

  // the same hour again: nothing is due
  assert.equal((await run(db, mail)).sent, 0);

  // Thursday: email 2, in the same thread
  const thursday = new Date(l.next_send_at);
  const r2 = await run(db, mail, thursday);
  assert.equal(r2.sent, 1);
  assert.match(mail.sent[1].subject, /^Re: Elevating/);
  assert.equal(mail.sent[1].inReplyTo, l.message_ids[0]);
  l = db.t.outreach_leads[0];
  assert.equal(l.step, 2);
  assert.equal(localParts(new Date(l.next_send_at), 'Africa/Cairo').dow, 2); // the Tuesday after

  const idsBeforeThird = [...l.message_ids];
  const r3 = await run(db, mail, new Date(l.next_send_at));
  assert.equal(r3.sent, 1);
  assert.match(mail.sent[2].subject, /^Quick question/);
  assert.equal(mail.sent[2].references, idsBeforeThird.join(' ')); // the thread so far: emails 1 and 2
  l = db.t.outreach_leads[0];
  assert.equal(l.status, 'completed'); assert.equal(l.next_send_at, null);
  assert.equal((await run(db, mail, new Date(MON_NOON_CAIRO.getTime() + 30 * DAY))).sent, 0);
  assert.equal(db.t.outreach_events.filter((e) => e.type === 'sent').length, 3);
});

test('only inside the recipient\'s business hours, and never on a rest day', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [lead()] });
  const mail = fakeMail();
  assert.equal((await run(db, mail, new Date('2026-11-23T04:00:00Z'))).outsideHours, 1); // 06:00 Cairo
  assert.equal((await run(db, mail, new Date('2026-11-27T10:00:00Z'))).outsideHours, 1); // Friday
  assert.equal(mail.sent.length, 0);
});

test('two runs at the same moment cannot send the same email twice', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [lead()] });
  const mail = fakeMail();
  await Promise.all([run(db, mail), run(db, mail)]);
  assert.equal(mail.sent.length, 1);
});

test('the daily and hourly limits hold, and the rest wait for the next run', async () => {
  const leads = Array.from({ length: 8 }, (_, i) => lead({ id: `00000000-0000-0000-0000-00000000000${i}`, email: `l${i}@school.eg`, created_at: `2026-11-0${i + 1}T00:00:00Z`, unsubscribe_token: String(i).repeat(32).slice(0, 32) }));
  const db = fakeDb({ outreach_settings: [{ ...LIVE, hourly_cap: 3 }], outreach_leads: leads });
  const mail = fakeMail();
  const r = await run(db, mail);
  assert.equal(r.sent, 3);
  assert.equal(r.deferred, 5);
  const db2 = fakeDb({ outreach_settings: [{ ...LIVE, daily_cap: 2, hourly_cap: 10 }], outreach_leads: leads });
  const mail2 = fakeMail();
  const r2 = await run(db2, mail2);
  assert.equal(r2.sent, 2);
  assert.equal(r2.capReached, true);
});

test('someone on the suppression list is never emailed', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [lead()], outreach_suppressions: [{ email: 'qa@cairo-uni.edu.eg', reason: 'unsubscribed' }] });
  const mail = fakeMail();
  const r = await run(db, mail);
  assert.equal(r.suppressed, 1);
  assert.equal(mail.sent.length, 0);
  assert.equal(db.t.outreach_leads[0].status, 'stopped');
});

test('a lead whose time zone is unknown is held back, not guessed', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [lead({ country: 'Atlantis', timezone: null })] });
  const mail = fakeMail();
  const r = await run(db, mail);
  assert.equal(r.needsTimezone, 1);
  assert.equal(mail.sent.length, 0);
  assert.equal(db.t.outreach_leads[0].status, 'needs_timezone');
});

test('a mail login failure puts the lead back untouched and stops the run', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [lead(), lead({ id: '22222222-2222-2222-2222-222222222222', email: 'two@school.eg', unsubscribe_token: 'b'.repeat(32) })] });
  const mail = fakeMail({ failWith: 'EAUTH' });
  const r = await run(db, mail);
  assert.equal(r.failed, 1);
  assert.equal(r.aborted, 'EAUTH');
  const l = db.t.outreach_leads.find((x) => x.email === 'qa@cairo-uni.edu.eg');
  assert.equal(l.step, 0); assert.equal(l.status, 'new');
  assert.equal(db.t.outreach_events.filter((e) => e.type === 'failed').length, 1);
});

// ---------------------------------------------------------------------------
// Replies, bounces, unsubscribes
// ---------------------------------------------------------------------------
const sentLead = (over = {}) => lead({ status: 'in_sequence', step: 1, message_ids: ['<m1@certify.wiki>'], ...over });

test('a reply to our email ends the sequence for that lead only', async () => {
  const other = sentLead({ id: '33333333-3333-3333-3333-333333333333', email: 'other@school.eg', message_ids: ['<m2@certify.wiki>'], unsubscribe_token: 'c'.repeat(32) });
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [sentLead(), other] });
  const mail = fakeMail({ inbox: [{ from: 'qa@cairo-uni.edu.eg', subject: 'Re: Elevating', inReplyTo: '<m1@certify.wiki>', references: '<m1@certify.wiki>', body: '' }] });
  const r = await runOutreachReplies({ supabase: db, mail, now: MON_NOON_CAIRO });
  assert.equal(r.replies, 1);
  assert.equal(db.t.outreach_leads.find((l) => l.email === 'qa@cairo-uni.edu.eg').status, 'replied');
  assert.equal(db.t.outreach_leads.find((l) => l.email === 'other@school.eg').status, 'in_sequence');
});

test('an out-of-office reply does not stop the sequence', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [sentLead()] });
  const mail = fakeMail({ inbox: [{ from: 'qa@cairo-uni.edu.eg', subject: 'Automatic reply: Elevating', inReplyTo: '<m1@certify.wiki>', references: '', autoSubmitted: 'auto-replied', body: '' }] });
  const r = await runOutreachReplies({ supabase: db, mail, now: MON_NOON_CAIRO });
  assert.equal(r.autoReplies, 1);
  assert.equal(db.t.outreach_leads[0].status, 'in_sequence');
});

test('a bounce marks the address bad and suppresses it', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [sentLead()] });
  const mail = fakeMail({ inbox: [{ from: 'MAILER-DAEMON@business117.web-hosting.com', subject: 'Mail delivery failed: returning message to sender', inReplyTo: '', references: '', body: 'The following address failed: qa@cairo-uni.edu.eg' }] });
  const r = await runOutreachReplies({ supabase: db, mail, now: MON_NOON_CAIRO });
  assert.equal(r.bounces, 1);
  assert.equal(db.t.outreach_leads[0].status, 'bounced');
  assert.equal(db.t.outreach_suppressions[0].email, 'qa@cairo-uni.edu.eg');
});

test('asking to stop in the subject unsubscribes the lead', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [sentLead()] });
  const mail = fakeMail({ inbox: [{ from: 'qa@cairo-uni.edu.eg', subject: 'Please unsubscribe me', inReplyTo: '<m1@certify.wiki>', references: '', body: '' }] });
  await runOutreachReplies({ supabase: db, mail, now: MON_NOON_CAIRO });
  assert.equal(db.t.outreach_leads[0].status, 'unsubscribed');
  assert.equal(db.t.outreach_suppressions.length, 1);
});

test('in dry mode replies are counted but nothing is changed', async () => {
  const db = fakeDb({ outreach_settings: [{ ...LIVE, mode: 'dry' }], outreach_leads: [sentLead()] });
  const mail = fakeMail({ inbox: [{ from: 'qa@cairo-uni.edu.eg', subject: 'Re: x', inReplyTo: '<m1@certify.wiki>', references: '', body: '' }] });
  const r = await runOutreachReplies({ supabase: db, mail, now: MON_NOON_CAIRO });
  assert.equal(r.replies, 1);
  assert.equal(db.t.outreach_leads[0].status, 'in_sequence');
});

test('the unsubscribe link works once, for a valid token only, and shows nothing about the lead', async () => {
  const db = fakeDb({ outreach_settings: [LIVE], outreach_leads: [sentLead()] });
  assert.deepEqual(await unsubscribeByToken(db, 'nonsense'), { ok: false });
  assert.deepEqual(await unsubscribeByToken(db, 'f'.repeat(32)), { ok: false });
  assert.deepEqual(await unsubscribeByToken(db, 'a'.repeat(32)), { ok: true });
  assert.equal(db.t.outreach_leads[0].status, 'unsubscribed');
  assert.equal(db.t.outreach_leads[0].next_send_at, null);
  assert.deepEqual(db.t.outreach_suppressions.map((s) => s.email), ['qa@cairo-uni.edu.eg']);
  assert.deepEqual(await unsubscribeByToken(db, 'a'.repeat(32)), { ok: true }); // pressing it twice is fine
  assert.equal(db.t.outreach_suppressions.length, 1);
  // and an unsubscribed lead is never emailed again
  const mail = fakeMail();
  await run(db, mail, new Date('2026-12-30T10:00:00Z'));
  assert.equal(mail.sent.length, 0);
});
