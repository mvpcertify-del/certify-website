import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS } from '../../api/_coaMaster.js';

// Runs the real "gl-statements" action against a small in-memory stand-in for the database: entity and date filters,
// draft journals left out, reversed journals included, period versus cumulative.

const ENTITY_A = '11111111-1111-1111-1111-111111111111';
const ENTITY_B = '22222222-2222-2222-2222-222222222222';
const tables = {
  coa_accounts: ACCOUNTS.map((a) => ({ code: a.code, name: a.name, category: a.category, parent_code: a.parent, is_header: a.isHeader, ifrs_class: a.ifrs })),
  fin_journal_entries: [
    { id: 'e1', entity_id: ENTITY_A, entry_date: '2025-12-20', status: 'posted' },   // last year: capital and revenue
    { id: 'e2', entity_id: ENTITY_A, entry_date: '2026-03-10', status: 'posted' },
    { id: 'e3', entity_id: ENTITY_A, entry_date: '2026-03-11', status: 'draft' },    // not in the books
    { id: 'e4', entity_id: ENTITY_B, entry_date: '2026-04-01', status: 'posted' },   // other entity
    { id: 'e5', entity_id: ENTITY_A, entry_date: '2026-05-01', status: 'reversed' }, // original of a reversal
    { id: 'e6', entity_id: ENTITY_A, entry_date: '2026-05-02', status: 'posted' },   // the reversal
    { id: 'e7', entity_id: ENTITY_A, entry_date: '2027-01-05', status: 'posted' },   // after the end date
  ],
  fin_journal_lines: [
    { entry_id: 'e1', account_code: '1110', debit: 10000, credit: 0 }, { entry_id: 'e1', account_code: '3101', debit: 0, credit: 7000 }, { entry_id: 'e1', account_code: '4101', debit: 0, credit: 3000 },
    { entry_id: 'e2', account_code: '1110', debit: 2000, credit: 0 }, { entry_id: 'e2', account_code: '4101', debit: 0, credit: 2000 },
    { entry_id: 'e3', account_code: '1110', debit: 999, credit: 0 }, { entry_id: 'e3', account_code: '4101', debit: 0, credit: 999 },
    { entry_id: 'e4', account_code: '1110', debit: 500, credit: 0 }, { entry_id: 'e4', account_code: '4101', debit: 0, credit: 500 },
    { entry_id: 'e5', account_code: '6101', debit: 400, credit: 0 }, { entry_id: 'e5', account_code: '1110', debit: 0, credit: 400 },
    { entry_id: 'e6', account_code: '6101', debit: 0, credit: 400 }, { entry_id: 'e6', account_code: '1110', debit: 400, credit: 0 },
    { entry_id: 'e7', account_code: '1110', debit: 777, credit: 0 }, { entry_id: 'e7', account_code: '4101', debit: 0, credit: 777 },
  ],
};

function builder(table) {
  const f = [];
  const api = {
    select() { return api; }, order() { return api; }, limit() { return api; },
    in(c, vs) { f.push((r) => vs.includes(r[c])); return api; },
    eq(c, v) { f.push((r) => r[c] === v); return api; },
    lte(c, v) { f.push((r) => r[c] <= v); return api; },
    then(res, rej) { return Promise.resolve({ data: tables[table].filter((r) => f.every((x) => x(r))), error: null }).then(res, rej); },
  };
  return api;
}
mock.module(new URL('../../api/_verifyAdmin.js', import.meta.url).href, {
  namedExports: { getAdmin: () => ({ from: builder }), verifyAdmin: async () => ({ caller: { id: 'admin-1' } }) },
});
const { handleGlAction } = await import('../../api/_financeGl.js');

async function call(body) {
  let status = 200; let out;
  const res = { status(s) { status = s; return res; }, json(o) { out = o; return res; } };
  await handleGlAction({ body: { action: 'gl-statements', ...body }, headers: {} }, res);
  return { status, ...out };
}

test('only posted and reversed journals count: drafts, later dates and other entities are left out', async () => {
  const r = await call({ entity_id: ENTITY_A, from: '2026-01-01', to: '2026-12-31' });
  assert.equal(r.entries, 4, 'e1, e2, e5 and e6 only');
});

test('profit or loss covers the period only; the position carries everything up to the end date', async () => {
  const r = await call({ entity_id: ENTITY_A, from: '2026-01-01', to: '2026-12-31' });
  assert.equal(r.pnl.revenue.total, 2000, 'last year revenue is not in this period');
  assert.equal(r.pnl.operatingExpenses.total, 0, 'the reversed journal and its reversal net to zero');
  assert.equal(r.position.assets.total, 10000 + 2000);
  assert.equal(r.position.equity.total, 7000 + 3000 + 2000, 'capital plus accumulated result');
  assert.ok(r.position.balanced);
});

test('all entities together include the other entity', async () => {
  const r = await call({ from: '2026-01-01', to: '2026-12-31' });
  assert.equal(r.pnl.revenue.total, 2500);
  assert.ok(r.position.balanced);
});

test('an earlier end date leaves later journals out', async () => {
  const r = await call({ entity_id: ENTITY_A, from: '2025-01-01', to: '2025-12-31' });
  assert.equal(r.pnl.revenue.total, 3000);
  assert.equal(r.position.assets.total, 10000);
});

test('a start date after the end date is refused', async () => {
  const r = await call({ from: '2026-12-31', to: '2026-01-01' });
  assert.equal(r.ok, false);
  assert.ok(r.errors.from);
});

test('missing dates default to this year up to today', async () => {
  const r = await call({});
  assert.equal(r.period.from, `${new Date().toISOString().slice(0, 4)}-01-01`);
  assert.equal(r.period.to, new Date().toISOString().slice(0, 10));
});
