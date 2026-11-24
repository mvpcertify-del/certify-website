import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { TEMPLATES } from '../../api/_qmsMaster.js';

// Runs the real QMS handler (api/_qms.js) against a small in-memory stand-in for the database, so the workflow rules are
// tested end to end: generate, version, approve, nonconformity closing, audit findings, review inputs and the pack.
// (The database triggers are tested separately against a real Postgres.)

let uid = 0;
const DEFAULTS = {
  qms_documents: { status: 'draft', review_months: 12, approved_version: null, next_review: null },
  qms_nonconformities: { status: 'open', severity: 'minor', source: 'internal_audit' },
  qms_actions: { status: 'open', kind: 'corrective' },
  qms_audits: { status: 'planned', audit_type: 'internal', clauses: [] },
  qms_findings: { nc_id: null },
  qms_risks: { status: 'open', kind: 'risk' },
  qms_kpis: { direction: 'higher', target: null, actual: null },
  qms_reviews: { status: 'planned', inputs: {} },
};
const store = {};
const counters = {};
const rowsOf = (t) => (store[t] ||= []);

function builder(table) {
  const q = { op: 'select', filters: [], order: null, limit: null, payload: null, one: false, ret: false };
  const run = () => {
    let rows = rowsOf(table);
    for (const f of q.filters) rows = rows.filter(f);
    if (q.op === 'insert') {
      const made = [].concat(q.payload).map((r) => {
        const row = { id: `id${++uid}`, created_at: new Date().toISOString(), ...(DEFAULTS[table] || {}), ...r };
        if (table === 'qms_risks') row.score = row.likelihood * row.impact;
        rowsOf(table).push(row);
        return row;
      });
      return { data: q.one ? made[0] : made, error: null };
    }
    if (q.op === 'update') {
      for (const r of rows) { Object.assign(r, q.payload); if (table === 'qms_risks') r.score = r.likelihood * r.impact; }
      return { data: q.one ? rows[0] || null : rows, error: null };
    }
    if (q.op === 'delete') {
      store[table] = rowsOf(table).filter((r) => !rows.includes(r));
      return { data: null, error: null };
    }
    if (q.order) rows = [...rows].sort((a, b) => (a[q.order.col] > b[q.order.col] ? 1 : a[q.order.col] < b[q.order.col] ? -1 : 0) * (q.order.asc ? 1 : -1));
    if (q.limit) rows = rows.slice(0, q.limit);
    return { data: q.one ? rows[0] || null : rows, error: null };
  };
  const api = {
    select() { return api; },
    insert(p) { q.op = 'insert'; q.payload = p; return api; },
    update(p) { q.op = 'update'; q.payload = p; return api; },
    delete() { q.op = 'delete'; return api; },
    eq(c, v) { q.filters.push((r) => r[c] === v); return api; },
    in(c, vs) { q.filters.push((r) => vs.includes(r[c])); return api; },
    order(c, o = {}) { q.order = { col: c, asc: o.ascending !== false }; return api; },
    limit(n) { q.limit = n; return api; },
    single() { q.one = true; return Promise.resolve(run()); },
    maybeSingle() { q.one = true; return Promise.resolve(run()); },
    then(res, rej) { return Promise.resolve(run()).then(res, rej); },
  };
  return api;
}
const fakeDb = {
  from: builder,
  rpc: async (_fn, { p_prefix }) => { counters[p_prefix] = (counters[p_prefix] || 0) + 1; return { data: `${p_prefix}-${String(counters[p_prefix]).padStart(4, '0')}`, error: null }; },
};

mock.module(new URL('../../api/_verifyAdmin.js', import.meta.url).href, {
  namedExports: { getAdmin: () => fakeDb, verifyAdmin: async () => ({ caller: { id: 'admin-1' } }) },
});
const { handleQmsAction } = await import('../../api/_qms.js');

async function call(action, body = {}) {
  let status = 200; let out;
  const res = { status(s) { status = s; return res; }, json(o) { out = o; return res; } };
  await handleQmsAction({ body: { action, ...body }, headers: {} }, res);
  return { status, ...out };
}
const one = (t, f) => rowsOf(t).find(f);

test('generate creates every template as a draft with version 1, and is safe to repeat', async () => {
  const a = await call('qms-generate');
  assert.equal(a.created, TEMPLATES.length);
  assert.equal(rowsOf('qms_documents').length, TEMPLATES.length);
  assert.equal(rowsOf('qms_document_versions').length, TEMPLATES.length);
  assert.ok(rowsOf('qms_documents').every((d) => d.status === 'draft' && d.approved_version == null));
  const b = await call('qms-generate');
  assert.equal(b.created, 0);
  assert.equal(b.skipped, TEMPLATES.length);
  assert.equal(rowsOf('qms_documents').length, TEMPLATES.length);
});

test('overview starts at 0 percent: drafts are not evidence', async () => {
  const o = await call('qms-overview');
  assert.equal(o.percent, 0);
  assert.equal(o.counts.documents, TEMPLATES.length);
  assert.equal(o.counts.approved, 0);
});

test('a document goes draft -> in review -> approved, and cannot skip review', async () => {
  const doc = one('qms_documents', (d) => d.doc_no === 'QMS-POL-01');
  const skip = await call('qms-doc-status', { id: doc.id, to: 'approved' });
  assert.equal(skip.ok, false);
  assert.ok((await call('qms-doc-status', { id: doc.id, to: 'in_review' })).ok);
  assert.ok((await call('qms-doc-status', { id: doc.id, to: 'approved' })).ok);
  const after = one('qms_documents', (d) => d.id === doc.id);
  assert.equal(after.status, 'approved');
  assert.equal(after.approved_version, 1);
  assert.ok(after.next_review);
  const v = one('qms_document_versions', (x) => x.document_id === doc.id);
  assert.equal(v.status, 'approved');
  assert.equal(v.approved_by, 'admin-1');
});

test('editing an approved document needs a change note and creates version 2, keeping version 1 as the approved one', async () => {
  const doc = one('qms_documents', (d) => d.doc_no === 'QMS-POL-01');
  const noNote = await call('qms-doc-version', { id: doc.id, content: 'changed text' });
  assert.equal(noNote.ok, false);
  assert.ok(noNote.errors.change_note);
  const ok = await call('qms-doc-version', { id: doc.id, content: 'changed text', change_note: 'Added commitment to improve' });
  assert.equal(ok.version, 2);
  const after = one('qms_documents', (d) => d.id === doc.id);
  assert.equal(after.status, 'draft');
  assert.equal(after.approved_version, 1);
  const o = await call('qms-overview');
  assert.ok(o.readiness.find((r) => r.no === '5.2').met.includes('doc'), 'approved v1 stays as evidence');
  await call('qms-doc-status', { id: doc.id, to: 'in_review' });
  await call('qms-doc-status', { id: doc.id, to: 'approved' });
  const versions = rowsOf('qms_document_versions').filter((x) => x.document_id === doc.id);
  assert.deepEqual(versions.map((x) => `${x.version}:${x.status}`).sort(), ['1:superseded', '2:approved']);
  assert.equal(one('qms_documents', (d) => d.id === doc.id).approved_version, 2);
});

test('an empty document cannot be sent for review', async () => {
  const created = await call('qms-save', { entity: 'document', record: { title: 'Blank SOP', doc_type: 'procedure', clauses: ['7.5'] } });
  assert.ok(created.ok);
  const r = await call('qms-doc-status', { id: created.row.id, to: 'in_review' });
  assert.equal(r.ok, false);
});

test('a nonconformity is closed only with cause, done actions and an effectiveness check', async () => {
  const c = await call('qms-save', { entity: 'nc', record: { title: 'Certificate sent late', severity: 'major', clause: '8.5' } });
  assert.ok(c.ok);
  assert.match(c.row.nc_no, /^NC-\d{4}$/);
  const id = c.row.id;
  let r = await call('qms-save', { entity: 'nc', id, record: { status: 'closed' } });
  assert.equal(r.ok, false);
  await call('qms-save', { entity: 'nc', id, record: { root_cause: 'No release checklist' } });
  r = await call('qms-save', { entity: 'nc', id, record: { status: 'closed' } });
  assert.equal(r.ok, false, 'still needs an action');
  const act = await call('qms-child-save', { entity: 'action', record: { nc_id: id, kind: 'corrective', description: 'Add a release checklist' } });
  assert.ok(act.ok);
  r = await call('qms-save', { entity: 'nc', id, record: { status: 'closed' } });
  assert.equal(r.ok, false, 'action is still open');
  await call('qms-child-save', { entity: 'action', id: act.row.id, record: { status: 'done' } });
  r = await call('qms-save', { entity: 'nc', id, record: { status: 'closed' } });
  assert.equal(r.ok, false, 'needs the effectiveness check');
  r = await call('qms-save', { entity: 'nc', id, record: { effectiveness_note: 'No late certificate in 3 months', status: 'closed' } });
  assert.ok(r.ok);
  assert.equal(one('qms_nonconformities', (n) => n.id === id).status, 'closed');
  assert.ok(one('qms_nonconformities', (n) => n.id === id).closed_at);
  const reopen = await call('qms-save', { entity: 'nc', id, record: { status: 'open' } });
  assert.equal(reopen.ok, false);
  const add = await call('qms-child-save', { entity: 'action', record: { nc_id: id, kind: 'preventive', description: 'Late addition' } });
  assert.equal(add.ok, false, 'a closed case cannot get new actions');
});

test('an audit finding raises a nonconformity once, and only for minor or major findings', async () => {
  const au = await call('qms-save', { entity: 'audit', record: { title: 'Q4 internal audit', clauses: ['8.5', '9.2'], planned_date: '2026-12-01' } });
  assert.ok(au.ok);
  const auditId = au.row.id;
  const f1 = await call('qms-child-save', { entity: 'finding', record: { audit_id: auditId, clause: '8.5', kind: 'minor_nc', statement: 'No release record for 3 applications', evidence: 'Sample of 10' } });
  const f2 = await call('qms-child-save', { entity: 'finding', record: { audit_id: auditId, clause: '7.5', kind: 'conformity', statement: 'Documents are controlled' } });
  const bad = await call('qms-finding-to-nc', { id: f2.row.id });
  assert.equal(bad.ok, false);
  const nc = await call('qms-finding-to-nc', { id: f1.row.id });
  assert.ok(nc.ok);
  assert.equal(nc.row.severity, 'minor');
  assert.equal(nc.row.clause, '8.5');
  const again = await call('qms-finding-to-nc', { id: f1.row.id });
  assert.equal(again.ok, false);
  assert.equal(one('qms_findings', (f) => f.id === f1.row.id).nc_id, nc.row.id);
});

test('an audit is completed only with a finding or summary and a date, and then it is locked', async () => {
  const au = await call('qms-save', { entity: 'audit', record: { title: 'Empty audit' } });
  let r = await call('qms-save', { entity: 'audit', id: au.row.id, record: { status: 'completed' } });
  assert.equal(r.ok, false);
  const real = rowsOf('qms_audits').find((a) => a.title === 'Q4 internal audit');
  r = await call('qms-save', { entity: 'audit', id: real.id, record: { status: 'completed', completed_date: '2026-12-02' } });
  assert.ok(r.ok);
  const f = await call('qms-child-save', { entity: 'finding', record: { audit_id: real.id, kind: 'observation', statement: 'Late addition' } });
  assert.equal(f.ok, false, 'a completed audit cannot get new findings');
});

test('KPIs, risks and the management review feed the readiness score', async () => {
  assert.ok((await call('qms-save', { entity: 'risk', record: { title: 'Provider outage', likelihood: 4, impact: 4, clause: '6.1' } })).ok);
  assert.ok((await call('qms-save', { entity: 'kpi', record: { name: 'On-time certificates', period: '2026-Q4', target: 95, actual: 97, direction: 'higher' } })).ok);
  const rv = await call('qms-save', { entity: 'review', record: { review_date: '2026-12-10', attendees: 'Top management' } });
  const held = await call('qms-save', { entity: 'review', id: rv.row.id, record: { status: 'held' } });
  assert.equal(held.ok, false, 'decisions are required');
  const snap = await call('qms-review-snapshot', { id: rv.row.id });
  assert.ok(snap.ok);
  assert.equal(snap.inputs.kpis.met, 1);
  assert.equal(snap.inputs.risks.high.length, 1);
  assert.ok((await call('qms-save', { entity: 'review', id: rv.row.id, record: { decisions: 'Add a second auditor', status: 'held' } })).ok);
  const again = await call('qms-review-snapshot', { id: rv.row.id });
  assert.equal(again.ok, false, 'a held review is a record');
});

test('approving every document brings the score to 100 percent once the records exist', async () => {
  for (const d of rowsOf('qms_documents')) {
    if (d.approved_version != null) continue;
    const hasText = rowsOf('qms_document_versions').some((v) => v.document_id === d.id && String(v.content).trim());
    if (!hasText) continue;
    await call('qms-doc-status', { id: d.id, to: 'in_review' });
    await call('qms-doc-status', { id: d.id, to: 'approved' });
  }
  const o = await call('qms-overview');
  assert.equal(o.percent, 100);
  assert.ok(o.readiness.every((r) => r.level === 'ready'), o.readiness.filter((r) => r.level !== 'ready').map((r) => r.no).join());
});

test('the audit pack carries documents, audits with findings, nonconformities with actions and the trail', async () => {
  const p = await call('qms-pack');
  assert.ok(p.documents.length >= TEMPLATES.length);
  assert.ok(p.documents.find((d) => d.doc_no === 'QMS-POL-01').approval);
  assert.ok(p.audits[0].findings);
  assert.ok(p.nonconformities.some((n) => n.actions.length > 0));
  assert.ok(p.trail.length > 10);
  assert.equal(p.percent, 100);
});

test('every change is written to the trail with the actor', async () => {
  assert.ok(rowsOf('qms_trail').length > 20);
  assert.ok(rowsOf('qms_trail').every((t) => t.actor === 'admin-1'));
  assert.ok(rowsOf('qms_trail').some((t) => /approved/.test(t.action)));
});

test('unknown actions and entities are refused', async () => {
  assert.equal((await call('qms-nope')).status, 400);
  assert.equal((await call('qms-list', { entity: 'users' })).status, 400);
  assert.equal((await call('qms-save', { entity: 'action', record: {} })).status, 400);
});
