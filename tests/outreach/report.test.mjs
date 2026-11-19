import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildReport } from '../../api/_outreachReport.js';
import { outreachReportEmail } from '../../api/_emailTemplates.js';

// A tiny stand-in for the database: select/order/in/limit return the same chain, and awaiting it yields the rows.
const fakeDb = (tables) => ({
  from(name) {
    let rows = [...(tables[name] || [])];
    const chain = {
      select() { return chain; },
      order() { return chain; },
      limit() { return chain; },
      in(col, vals) { rows = rows.filter((r) => vals.includes(r[col])); return chain; },
      then(resolve) { resolve({ data: rows }); },
    };
    return chain;
  },
});

const leads = [
  { id: 'a', email: 'a@x.edu', institution_name: 'Alpha, University', contact_name: null, country: 'Egypt', status: 'in_sequence', step: 2, next_send_at: '2026-11-26T08:00:00Z' },
  { id: 'b', email: 'b@x.edu', institution_name: 'Beta', contact_name: 'Dr B', country: 'Cambodia', status: 'in_sequence', step: 1, next_send_at: '2026-11-22T08:00:00Z' },
  { id: 'c', email: 'c@x.edu', institution_name: 'Gamma', contact_name: null, country: 'Kenya', status: 'new', step: 0, next_send_at: null },
];
const events = [
  { lead_id: 'a', type: 'sent', step: 1, created_at: '2026-11-18T05:56:00Z' },
  { lead_id: 'a', type: 'sent', step: 2, created_at: '2026-11-18T05:58:00Z' },
  { lead_id: 'b', type: 'sent', step: 1, created_at: '2026-11-18T05:57:00Z' },
  { lead_id: 'b', type: 'bounce', step: 1, created_at: '2026-11-18T06:10:00Z' },
];

test('the report counts sends, contacts and problems', async () => {
  const r = await buildReport(fakeDb({ outreach_leads: leads, outreach_events: events }), new Date('2026-11-19T10:00:00Z'));
  assert.equal(r.totals.emails, 3);
  assert.equal(r.totals.email1, 2);
  assert.equal(r.totals.email2, 1);
  assert.equal(r.totals.contacted, 2);
  assert.equal(r.totals.leads, 3);
  assert.equal(r.totals.notStarted, 1);
  assert.equal(r.totals.bounces, 1);
  assert.deepEqual(r.perDay, [['2026-11-18', 3]]);
});

test('an Email 2 sent minutes after Email 1 is flagged', async () => {
  const r = await buildReport(fakeDb({ outreach_leads: leads, outreach_events: events }));
  assert.equal(r.notes.length, 1);
  assert.match(r.notes[0], /Alpha, University: Email 2 went 2 minutes after Email 1/);
});

test('the CSV has one row per institution and quotes commas', async () => {
  const r = await buildReport(fakeDb({ outreach_leads: leads, outreach_events: events }));
  const lines = r.csv.split('\r\n');
  assert.equal(lines.length, 4);
  assert.ok(lines[1].startsWith('"Alpha, University",a@x.edu'));
  assert.ok(lines[3].includes('Gamma,c@x.edu'));
});

test('the report email carries the numbers', async () => {
  const report = await buildReport(fakeDb({ outreach_leads: leads, outreach_events: events }));
  const mail = outreachReportEmail({ name: 'Midhat', report, dashboardUrl: 'https://certify.cx/admin/outreach' });
  assert.match(mail.subject, /3 emails sent to 2 institutions/);
  assert.match(mail.html, /Email 2 went 2 minutes after Email 1/);
  assert.match(mail.text, /Replies: 0/);
});
