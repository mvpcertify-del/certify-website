// The outreach campaign report: totals, sends per day, per-institution detail (as a CSV) and anything that looks wrong.
// Built from the database, so the numbers are the same ones the Outreach page shows.

const q = (v) => {
  const s = v == null ? '' : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
const day = (iso) => iso.slice(0, 10);

export async function buildReport(db, now = new Date()) {
  const { data: leads } = await db.from('outreach_leads')
    .select('id, email, institution_name, contact_name, country, status, step, next_send_at').order('institution_name').limit(5000);
  const { data: events } = await db.from('outreach_events').select('lead_id, type, step, created_at')
    .in('type', ['sent', 'failed', 'reply', 'auto_reply', 'bounce', 'unsubscribed']).order('created_at', { ascending: true }).limit(10000);

  const sent = {}; // lead id -> { 1: iso, 2: iso, 3: iso }
  const perDay = {};
  const totals = { emails: 0, email1: 0, email2: 0, email3: 0, failed: 0, replies: 0, autoReplies: 0, bounces: 0, unsubscribes: 0 };
  for (const e of events || []) {
    if (e.type === 'sent') {
      (sent[e.lead_id] ||= {})[e.step] = e.created_at;
      totals.emails += 1;
      if (e.step >= 1 && e.step <= 3) totals[`email${e.step}`] += 1;
      perDay[day(e.created_at)] = (perDay[day(e.created_at)] || 0) + 1;
    } else if (e.type === 'failed') totals.failed += 1;
    else if (e.type === 'reply') totals.replies += 1;
    else if (e.type === 'auto_reply') totals.autoReplies += 1;
    else if (e.type === 'bounce') totals.bounces += 1;
    else if (e.type === 'unsubscribed') totals.unsubscribes += 1;
  }

  const list = leads || [];
  const contacted = list.filter((l) => sent[l.id]);
  const status = {};
  for (const l of list) status[l.status] = (status[l.status] || 0) + 1;

  // Things worth a second look.
  const notes = [];
  for (const l of contacted) {
    const s = sent[l.id];
    if (s[1] && s[2]) {
      const mins = Math.round((new Date(s[2]) - new Date(s[1])) / 60000);
      if (mins < 24 * 60) notes.push(`${l.institution_name}: Email 2 went ${mins} minute${mins === 1 ? '' : 's'} after Email 1. It is meant to go on day 4.`);
    }
  }
  if (totals.failed) notes.push(`${totals.failed} send${totals.failed === 1 ? '' : 's'} failed (the mail server refused). They are retried.`);

  const header = ['Institution', 'Email', 'Contact', 'Country', 'Status', 'Emails sent', 'Email 1 sent (UTC)', 'Email 2 sent (UTC)', 'Email 3 sent (UTC)', 'Next email due (UTC)'];
  const rows = list.map((l) => {
    const s = sent[l.id] || {};
    return [l.institution_name, l.email, l.contact_name || '', l.country || '', l.status, Object.keys(s).length, s[1] || '', s[2] || '', s[3] || '', l.status === 'in_sequence' ? (l.next_send_at || '') : ''];
  });
  const csv = [header, ...rows].map((r) => r.map(q).join(',')).join('\r\n');

  return {
    generatedAt: now.toISOString(),
    totals: { ...totals, leads: list.length, contacted: contacted.length, notStarted: status.new || 0, inSequence: status.in_sequence || 0, completed: status.completed || 0, replied: status.replied || 0 },
    perDay: Object.entries(perDay).sort(([a], [b]) => a.localeCompare(b)),
    notes,
    csv,
  };
}
