import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS } from '../../api/_coaMaster.js';
import { buildStatements, sumLines } from '../../api/_financeStatements.js';

const accounts = ACCOUNTS.map((a) => ({ code: a.code, name: a.name, category: a.category, parent_code: a.parent, is_header: a.isHeader, ifrs_class: a.ifrs }));
const L = (account_code, debit, credit) => ({ account_code, debit, credit });
const run = (lines, movementLines = lines) => buildStatements({ accounts, cumulative: sumLines(lines), movement: sumLines(movementLines) });

// A small set of balanced journals: capital in, revenue, cost, expenses, interest, tax, equipment, OCI.
const JOURNALS = [
  [L('1110', 50000, 0), L('3101', 0, 50000)],                         // share capital paid in
  [L('1110', 12000, 0), L('4101', 0, 12000)],                         // commission revenue received
  [L('5101', 3000, 0), L('1110', 0, 3000)],                           // certification body cost
  [L('6101', 4000, 0), L('1110', 0, 4000)],                           // salaries
  [L('7201', 200, 0), L('1110', 0, 200)],                             // interest paid (financing)
  [L('1110', 150, 0), L('7301', 0, 150)],                             // gain on disposal (investing)
  [L('7401', 500, 0), L('1110', 0, 500)],                             // tax
  [L('1201', 8000, 0), L('1110', 0, 8000)],                           // laptops bought
  [L('1220', 0, 800), L('6101', 800, 0)],                             // depreciation (contra asset)
  [L('1110', 300, 0), L('8101', 0, 300)],                             // OCI translation gain
];
const flat = JOURNALS.flat();

test('an empty ledger gives zero statements that balance', () => {
  const s = run([]);
  assert.equal(s.pnl.profit, 0);
  assert.equal(s.position.assets.total, 0);
  assert.ok(s.position.balanced);
  assert.deepEqual(s.warnings, []);
});

test('profit or loss follows the IFRS 18 categories', () => {
  const { pnl } = run(flat);
  assert.equal(pnl.revenue.total, 12000);
  assert.equal(pnl.costOfRevenue.total, -3000);
  assert.equal(pnl.grossProfit, 9000);
  assert.equal(pnl.operatingExpenses.total, -4800, 'salaries and depreciation');
  assert.equal(pnl.operatingProfit, 4200);
  assert.equal(pnl.investing.total, 150);
  assert.equal(pnl.financing.total, -200);
  assert.equal(pnl.profitBeforeTax, 4150);
  assert.equal(pnl.incomeTax.total, -500);
  assert.equal(pnl.profitContinuing, 3650);
  assert.equal(pnl.profit, 3650);
  assert.equal(pnl.oci.total, 300);
  assert.equal(pnl.totalComprehensive, 3950);
});

test('exchange differences follow the item they arise from (operating)', () => {
  const { pnl } = run([L('1110', 100, 0), L('7103', 0, 100)]);
  assert.equal(pnl.operatingOther.total, 100);
  assert.equal(pnl.investing.total, 0);
  assert.equal(pnl.operatingProfit, 100);
});

test('the category of an account follows its IFRS class on the chart, not its number', () => {
  const moved = accounts.map((a) => (a.code === '6101' ? { ...a, ifrs_class: 'investing' } : a));
  const s = buildStatements({ accounts: moved, cumulative: sumLines(flat), movement: sumLines(flat) });
  assert.ok(s.pnl.investing.lines.some((l) => l.code === '6101'));
  assert.equal(s.pnl.operatingExpenses.total, 0, 'every posting on 6101 moved with the account');
  assert.equal(s.pnl.investing.total, 150 - 4800);
});

test('an unclassified profit or loss account is shown under operating with a warning', () => {
  const unclassified = accounts.map((a) => (a.code === '6101' ? { ...a, ifrs_class: 'none' } : a));
  const s = buildStatements({ accounts: unclassified, cumulative: sumLines(flat), movement: sumLines(flat) });
  assert.ok(s.warnings.some((w) => w.includes('6101')));
  assert.equal(s.pnl.operatingExpenses.total, -4800);
});

test('only movement inside the period counts in profit or loss, while the position uses everything up to the end date', () => {
  const before = [L('1110', 5000, 0), L('4101', 0, 5000)];   // earlier year
  const inside = [L('1110', 2000, 0), L('4101', 0, 2000)];
  const s = run([...before, ...inside], inside);
  assert.equal(s.pnl.revenue.total, 2000);
  assert.equal(s.position.assets.total, 7000);
  assert.equal(s.position.equity.total, 7000, 'accumulated result is carried in equity');
  assert.ok(s.position.balanced);
});

test('the statement of financial position balances: assets = liabilities + equity (including the result)', () => {
  const { position } = run(flat);
  assert.ok(position.balanced, `difference ${position.difference}`);
  assert.equal(position.assets.total, position.totalLiabilitiesAndEquity);
  const cash = position.assets.groups.flatMap((g) => g.lines).find((l) => l.code === '1110');
  assert.equal(cash.amount, 50000 + 12000 - 3000 - 4000 - 200 + 150 - 500 - 8000 + 300);
});

test('a contra account (accumulated depreciation) reduces assets', () => {
  const { position } = run(flat);
  const acc = position.assets.groups.flatMap((g) => g.lines).find((l) => l.code === '1220');
  assert.equal(acc.amount, -800);
  const nonCurrent = position.assets.groups.find((g) => g.name === 'Non-Current Assets');
  assert.equal(nonCurrent.total, 8000 - 800);
});

test('liabilities show as positive and the result and OCI sit in equity', () => {
  const journals = [[L('1110', 1000, 0), L('2110', 0, 1000)]];
  const s = run(journals.flat());
  assert.equal(s.position.liabilities.total, 1000);
  const t = run(flat);
  const names = t.position.equity.lines.map((l) => l.code);
  assert.ok(names.includes('3101') && names.includes('RESULT') && names.includes('OCI'));
  assert.equal(t.position.equity.total, 50000 + 3650 + 300);
});

test('clearing accounts are shown, so the statement still balances', () => {
  const s = run([L('1110', 900, 0), L('9102', 0, 900)]);
  assert.equal(s.position.liabilities.total, 900);
  assert.ok(s.position.balanced);
  const t = run([L('9101', 400, 0), L('3101', 0, 400)]);
  assert.equal(t.position.assets.total, 400);
  assert.ok(t.position.balanced);
});

test('a reversed journal nets to zero', () => {
  const orig = [L('1110', 700, 0), L('4101', 0, 700)];
  const reversal = [L('1110', 0, 700), L('4101', 700, 0)];
  const s = run([...orig, ...reversal]);
  assert.equal(s.pnl.revenue.total, 0);
  assert.equal(s.position.assets.total, 0);
});

test('accounts without activity are left out, and totals equal the sum of their lines', () => {
  const s = run(flat);
  const all = [...s.pnl.revenue.lines, ...s.pnl.operatingExpenses.lines];
  assert.ok(all.every((l) => l.amount !== 0));
  assert.equal(s.pnl.operatingExpenses.total, s.pnl.operatingExpenses.lines.reduce((t, l) => t + l.amount, 0));
});

test('sumLines adds debits and credits per account and rounds to cents', () => {
  const r = sumLines([L('1110', 0.1, 0), L('1110', 0.2, 0), L('4101', 0, 0.3)]);
  assert.equal(r['1110'].debit, 0.3);
  assert.equal(r['4101'].credit, 0.3);
});
