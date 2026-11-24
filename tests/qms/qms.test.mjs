import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLAUSES, TEMPLATES, EDITION } from '../../api/_qmsMaster.js';
import {
  SPECS, validateRecord, ncCloseBlocker, auditCompleteBlocker, reviewHeldBlocker, clauseReadiness, readinessPercent, riskLevel, addMonths,
} from '../../api/_qms.js';

// ---------------------------------------------------------------- master data
test('the clauses are the 28 sub-clauses of ISO 9001 clauses 4 to 10, each once', () => {
  assert.equal(EDITION, 'ISO 9001:2015');
  assert.equal(CLAUSES.length, 28);
  assert.equal(new Set(CLAUSES.map((c) => c.no)).size, 28);
  for (const c of CLAUSES) assert.match(c.no, /^(4|5|6|7|8|9|10)\.\d$/);
});

test('every clause is covered by at least one generated document', () => {
  const covered = new Set(TEMPLATES.flatMap((t) => t.clauses));
  for (const c of CLAUSES) assert.ok(covered.has(c.no), `clause ${c.no} has no document`);
});

test('templates have unique numbers, valid clauses and the five standard sections', () => {
  const nos = TEMPLATES.map((t) => t.doc_no);
  assert.equal(new Set(nos).size, nos.length);
  const valid = new Set(CLAUSES.map((c) => c.no));
  for (const t of TEMPLATES) {
    assert.match(t.doc_no, /^QMS-[A-Z]{3}-\d{2}$/);
    for (const c of t.clauses) assert.ok(valid.has(c), `${t.doc_no} uses unknown clause ${c}`);
    for (const h of ['## 1. Purpose', '## 2. Scope', '## 3. Responsibilities', '## 4. Procedure', '## 5. Records kept']) assert.ok(t.content.includes(h), `${t.doc_no} lacks ${h}`);
    assert.ok(t.content.length > 400, `${t.doc_no} is too short`);
  }
});

test('templates never name a person and never claim certification', () => {
  for (const t of TEMPLATES) {
    assert.ok(!/certified to|is certified|we are certified/i.test(t.content), t.doc_no);
  }
});

// ---------------------------------------------------------------- validation
test('creating a nonconformity needs a title and checks the enums, dates and clause', () => {
  const bad = validateRecord(SPECS.nc, { title: '', severity: 'huge', due_date: '31/12/2026', clause: '99.9' }, 'create');
  assert.ok(bad.errors.title && bad.errors.severity && bad.errors.due_date && bad.errors.clause);
  const good = validateRecord(SPECS.nc, { title: 'Late delivery of certificate', severity: 'major', due_date: '2026-12-31', clause: '8.5' }, 'create');
  assert.deepEqual(good.errors, {});
  assert.equal(good.values.severity, 'major');
});

test('an update only checks the fields that were sent', () => {
  const r = validateRecord(SPECS.nc, { root_cause: 'No checklist at release' }, 'update');
  assert.deepEqual(r.errors, {});
  assert.deepEqual(Object.keys(r.values), ['root_cause']);
});

test('text is cleaned and cut to its maximum length', () => {
  const r = validateRecord(SPECS.risk, { title: `  ${'x'.repeat(300)}\u0007 `, likelihood: 3, impact: 4 }, 'create');
  assert.equal(r.values.title.length, 200);
  assert.ok(!r.values.title.includes('\u0007'));
});

test('risk likelihood and impact are whole numbers from 1 to 5', () => {
  assert.ok(validateRecord(SPECS.risk, { title: 'A', likelihood: 0, impact: 3 }, 'create').errors.likelihood);
  assert.ok(validateRecord(SPECS.risk, { title: 'A', likelihood: 3, impact: 6 }, 'create').errors.impact);
  assert.ok(validateRecord(SPECS.risk, { title: 'A', likelihood: 2.5, impact: 3 }, 'create').errors.likelihood);
  assert.deepEqual(validateRecord(SPECS.risk, { title: 'A', likelihood: 5, impact: 5 }, 'create').errors, {});
});

test('risk levels follow the score (likelihood x impact)', () => {
  assert.equal(riskLevel(25), 'high');
  assert.equal(riskLevel(15), 'high');
  assert.equal(riskLevel(8), 'medium');
  assert.equal(riskLevel(7), 'low');
});

test('a document may only be tagged with real clauses', () => {
  assert.ok(validateRecord(SPECS.document, { title: 'X', clauses: ['7.5', '12.1'] }, 'create').errors.clauses);
  assert.deepEqual(validateRecord(SPECS.document, { title: 'X', clauses: ['7.5', '7.5'] }, 'create').values.clauses, ['7.5']);
});

test('a finding and an action need their text', () => {
  assert.ok(validateRecord(SPECS.finding, { kind: 'minor_nc' }, 'create').errors.statement);
  assert.ok(validateRecord(SPECS.action, { kind: 'corrective' }, 'create').errors.description);
});

test('KPI target and actual must be numbers', () => {
  assert.ok(validateRecord(SPECS.kpi, { name: 'On-time delivery', period: '2026-Q4', target: 'a lot' }, 'create').errors.target);
  const ok = validateRecord(SPECS.kpi, { name: 'On-time delivery', period: '2026-Q4', target: 95, actual: 97.5, direction: 'higher' }, 'create');
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.values.actual, 97.5);
});

// ---------------------------------------------------------------- closing rules
test('a nonconformity cannot be closed without cause, actions done and an effectiveness check', () => {
  const nc = { root_cause: '', effectiveness_note: '' };
  assert.match(ncCloseBlocker(nc, []), /root cause/);
  nc.root_cause = 'No release checklist';
  assert.match(ncCloseBlocker(nc, []), /at least one/);
  assert.match(ncCloseBlocker(nc, [{ status: 'open' }]), /done/);
  assert.match(ncCloseBlocker(nc, [{ status: 'done' }]), /effectiveness/);
  nc.effectiveness_note = 'No repeat in 3 months';
  assert.equal(ncCloseBlocker(nc, [{ status: 'done' }, { status: 'verified' }]), null);
});

test('an audit needs a finding or summary and a completion date before it is completed', () => {
  assert.ok(auditCompleteBlocker({ summary: '', completed_date: '2026-11-20' }, []));
  assert.ok(auditCompleteBlocker({ summary: 'All good', completed_date: null }, []));
  assert.equal(auditCompleteBlocker({ summary: 'All good', completed_date: '2026-11-20' }, []), null);
  assert.equal(auditCompleteBlocker({ summary: '', completed_date: '2026-11-20' }, [{ id: 1 }]), null);
});

test('a management review needs decisions before it is held', () => {
  assert.ok(reviewHeldBlocker({ decisions: '  ' }));
  assert.equal(reviewHeldBlocker({ decisions: 'Add a second auditor' }), null);
});

// ---------------------------------------------------------------- readiness
const approvedAll = () => TEMPLATES.map((t) => ({ doc_no: t.doc_no, clauses: t.clauses, status: 'approved', approved_version: 1 }));

test('with nothing in the system, no clause is ready and the score is zero', () => {
  const rows = clauseReadiness({});
  assert.equal(rows.length, 28);
  assert.ok(rows.every((r) => r.level === 'none'));
  assert.equal(readinessPercent(rows), 0);
});

test('draft documents count as partial, not as evidence', () => {
  const docs = TEMPLATES.map((t) => ({ doc_no: t.doc_no, clauses: t.clauses, status: 'draft', approved_version: null }));
  const rows = clauseReadiness({ documents: docs });
  assert.ok(rows.every((r) => r.level === 'partial'));
  assert.equal(readinessPercent(rows), 0);
});

test('approved documents alone make most clauses ready, but 6.1, 6.2, 9.1, 9.2 and 9.3 also need records', () => {
  const rows = clauseReadiness({ documents: approvedAll() });
  const notReady = rows.filter((r) => r.level !== 'ready').map((r) => r.no).sort();
  assert.deepEqual(notReady, ['6.1', '6.2', '9.1', '9.2', '9.3']);
  for (const r of rows.filter((x) => x.level !== 'ready')) assert.equal(r.level, 'partial');
});

test('records complete the remaining clauses and the system reaches 100 percent', () => {
  const rows = clauseReadiness({
    documents: approvedAll(),
    risks: [{ id: 1 }],
    kpis: [{ name: 'A', actual: 97 }],
    audits: [{ status: 'completed' }],
    reviews: [{ status: 'held' }],
  });
  assert.ok(rows.every((r) => r.level === 'ready'));
  assert.equal(readinessPercent(rows), 100);
});

test('a planned audit or a planned review is not evidence', () => {
  const rows = clauseReadiness({ documents: approvedAll(), audits: [{ status: 'planned' }], reviews: [{ status: 'planned' }] });
  assert.equal(rows.find((r) => r.no === '9.2').level, 'partial');
  assert.equal(rows.find((r) => r.no === '9.3').level, 'partial');
});

test('an obsolete document does not count', () => {
  const docs = approvedAll().map((d) => (d.doc_no === 'QMS-POL-01' ? { ...d, status: 'obsolete' } : d));
  const rows = clauseReadiness({ documents: docs });
  assert.equal(rows.find((r) => r.no === '5.2').level, 'none');
});

test('a new draft version of an approved document keeps the approved version as evidence', () => {
  const docs = approvedAll().map((d) => (d.doc_no === 'QMS-POL-01' ? { ...d, status: 'draft', approved_version: 1 } : d));
  assert.equal(clauseReadiness({ documents: docs }).find((r) => r.no === '5.2').level, 'ready');
});

test('addMonths moves a date forward', () => {
  assert.equal(addMonths('2026-11-24', 12), '2027-11-24');
  assert.equal(addMonths('2026-11-24', -12), '2025-11-24');
});
