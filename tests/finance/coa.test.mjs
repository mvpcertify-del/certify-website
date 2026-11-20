import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACCOUNTS, CATEGORY_BY_DIGIT, CONTRA, COA_VERSION } from '../../api/_coaMaster.js';

const by = Object.fromEntries(ACCOUNTS.map((a) => [a.code, a]));

test('the master chart is V1.0 and codes are unique four-digit numbers', () => {
  assert.equal(COA_VERSION, 'V1.0');
  assert.equal(new Set(ACCOUNTS.map((a) => a.code)).size, ACCOUNTS.length);
  for (const a of ACCOUNTS) assert.match(a.code, /^[1-9]\d{3}$/, a.code);
});

test('the category follows the first digit and the normal balance is Dr, Cr or Dr/Cr', () => {
  for (const a of ACCOUNTS) {
    assert.equal(a.category, CATEGORY_BY_DIGIT[a.code[0]], a.code);
    assert.ok(['Dr', 'Cr', 'Dr/Cr'].includes(a.normal), `${a.code} ${a.normal}`);
  }
});

test('every parent exists, has the same first digit and is not the account itself', () => {
  for (const a of ACCOUNTS) {
    if (!a.parent) { assert.match(a.code, /^[1-9]000$/, `${a.code} has no parent but is not a top group`); continue; }
    assert.ok(by[a.parent], `${a.code} -> ${a.parent}`);
    assert.equal(a.parent[0], a.code[0], a.code);
    assert.notEqual(a.parent, a.code);
  }
});

test('group accounts cannot be posted to, real accounts can', () => {
  for (const a of ACCOUNTS) assert.equal(a.allowPosting, !a.isHeader, a.code);
  assert.equal(by['1000'].isHeader, true);
  assert.equal(by['1100'].isHeader, true);
  assert.equal(by['1101'].allowPosting, true);
});

test('normal balances follow the spec for the main classes', () => {
  for (const a of ACCOUNTS.filter((x) => !x.isHeader)) {
    if (CONTRA.has(a.code)) continue;
    if (a.category === 'asset' || a.category === 'cost_of_revenue' || a.category === 'expense') assert.equal(a.normal, 'Dr', a.code);
    if (a.category === 'liability') assert.equal(a.normal, 'Cr', a.code);
  }
  assert.equal(by['1139'].normal, 'Cr');
  assert.equal(by['1220'].normal, 'Cr');
  assert.equal(by['4901'].normal, 'Dr');
  assert.equal(by['3112'].normal, 'Dr');
  assert.equal(by['3170'].normal, 'Dr');
  assert.equal(by['7404'].normal, 'Dr/Cr');
  assert.equal(by['9101'].normal, 'Dr/Cr');
});

test('contra accounts are flagged: contra-assets are Cr, contra-revenue are Dr', () => {
  for (const code of CONTRA) {
    const a = by[code];
    assert.ok(a, code);
    assert.equal(a.isContra, true);
    assert.equal(a.normal, a.category === 'asset' ? 'Cr' : 'Dr', code);
  }
});

test('the accounts named in the spec examples exist', () => {
  assert.equal(by['1120'].name, 'Payment Gateway Clearing');
  assert.equal(by['2110'].name, 'Certification Body Funds Payable');
  assert.equal(by['2140'].name, 'Deferred Subscription Revenue');
  assert.match(by['4101'].name, /Marketplace Commission Revenue/);
});

test('sub-accounts sit under their parent account', () => {
  assert.equal(by['1121'].parent, '1120');
  assert.equal(by['1139'].parent, '1130');
  assert.equal(by['2113'].parent, '2110');
  assert.equal(by['2172'].parent, '2170');
  assert.equal(by['1101'].parent, '1100');
  assert.equal(by['3101'].parent, '3000');
  assert.equal(by['9109'].parent, '9000');
});

test('the IFRS 18 class is a default that is not just the numbering, and income tax and OCI are separate', () => {
  assert.equal(by['4101'].ifrs, 'operating');
  assert.equal(by['7401'].ifrs, 'income_tax');
  assert.equal(by['8101'].ifrs, 'oci');
  assert.equal(by['7201'].ifrs, 'financing');
  assert.equal(by['7101'].ifrs, 'investing');
  assert.equal(by['1101'].ifrs, 'none');
});

test('the chart has the expected size', () => {
  const groups = ACCOUNTS.filter((a) => a.isHeader).length;
  const real = ACCOUNTS.length - groups;
  // 215 accounts counted from the spec by hand (assets 40, liabilities 29, equity 14, revenue 33, cost of revenue 20,
  // operating expenses 47, finance/investing/tax 18, OCI 5, control 9) plus 32 group headings.
  assert.equal(groups, 32);
  assert.equal(real, 215);
  console.log(`      ${ACCOUNTS.length} rows: ${groups} groups, ${real} accounts`);
});

// ---- validation of an account being added or changed (api/_financeCoa.js) ----
import { validateAccount } from '../../api/_financeCoa.js';

const chart = Object.fromEntries(ACCOUNTS.map((a) => [a.code, { code: a.code, is_header: a.isHeader, normal_balance: a.normal, parent_code: a.parent, is_active: true }]));
const NEW = { code: '1115', name: 'Bank Account – SAR', normal_balance: 'Dr', parent_code: '1100', ifrs_class: 'none' };

test('a new account is accepted, gets its category from the code and is postable', () => {
  const r = validateAccount(NEW, { mode: 'create', byCode: chart });
  assert.deepEqual(r.errors, {});
  assert.equal(r.values.category, 'asset');
  assert.equal(r.values.allow_posting, true);
});

test('a code that exists, or a bad code, is refused: codes are never reused or changed', () => {
  assert.ok(validateAccount({ ...NEW, code: '1101' }, { mode: 'create', byCode: chart }).errors.code);
  assert.ok(validateAccount({ ...NEW, code: '0123' }, { mode: 'create', byCode: chart }).errors.code);
  assert.ok(validateAccount({ ...NEW, code: '12' }, { mode: 'create', byCode: chart }).errors.code);
});

test('the parent must exist and share the first digit', () => {
  assert.ok(validateAccount({ ...NEW, parent_code: '9999' }, { mode: 'create', byCode: chart }).errors.parent_code);
  assert.ok(validateAccount({ ...NEW, parent_code: '2100' }, { mode: 'create', byCode: chart }).errors.parent_code);
  assert.ok(validateAccount({ ...NEW, parent_code: null }, { mode: 'create', byCode: chart }).errors.parent_code);
});

test('normal balance and IFRS class must be valid values', () => {
  assert.ok(validateAccount({ ...NEW, normal_balance: 'Debit' }, { mode: 'create', byCode: chart }).errors.normal_balance);
  assert.ok(validateAccount({ ...NEW, ifrs_class: 'bogus' }, { mode: 'create', byCode: chart }).errors.ifrs_class);
  assert.deepEqual(validateAccount({ ...NEW, normal_balance: 'Dr/Cr' }, { mode: 'create', byCode: chart }).errors, {});
});

test('a group account cannot be made postable', () => {
  const cur = chart['1100'];
  assert.ok(validateAccount({ allow_posting: true }, { mode: 'update', byCode: chart, current: cur }).errors.allow_posting);
});

test('the normal balance cannot change once the account has postings', () => {
  const cur = chart['1101'];
  assert.ok(validateAccount({ normal_balance: 'Cr' }, { mode: 'update', byCode: chart, current: cur, hasPostings: true }).errors.normal_balance);
  assert.deepEqual(validateAccount({ normal_balance: 'Cr' }, { mode: 'update', byCode: chart, current: cur, hasPostings: false }).errors, {});
});

test('an account with a balance, or active sub-accounts, cannot be made inactive', () => {
  const cur = chart['1120'];
  assert.ok(validateAccount({ is_active: false }, { mode: 'update', byCode: chart, current: cur, netBalance: 250 }).errors.is_active);
  assert.ok(validateAccount({ is_active: false }, { mode: 'update', byCode: chart, current: cur, activeChildren: 2 }).errors.is_active);
  assert.deepEqual(validateAccount({ is_active: false }, { mode: 'update', byCode: chart, current: cur }).errors, {});
});

test('currency, tax treatment, department, cost centre and project can be set', () => {
  const r = validateAccount({ currency: 'aed', tax_treatment: 'VAT 5%', department: 'Finance', cost_centre: 'CC-01', project: 'Platform' }, { mode: 'update', byCode: chart, current: chart['1101'] });
  assert.deepEqual(r.errors, {});
  assert.equal(r.values.currency, 'AED');
  assert.equal(r.values.tax_treatment, 'VAT 5%');
  assert.ok(validateAccount({ currency: 'DOLLAR' }, { mode: 'update', byCode: chart, current: chart['1101'] }).errors.currency);
});
