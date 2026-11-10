#!/usr/bin/env node
// Integration check against a REAL Odoo SANDBOX database.
//
//   node --env-file=.env.odoo-sandbox scripts/odoo-sandbox-check.mjs           # read-only
//   node --env-file=.env.odoo-sandbox scripts/odoo-sandbox-check.mjs --write   # full round trip
//
// Read-only (default): reaches Odoo, proves the credentials, and confirms the
// journals, the income account / product and USD exist. Nothing is created.
//
// --write: runs the SAME sync code the site uses, with an in-memory store, for
// one synthetic USD 1.00 payment, then runs it a second time to prove no second
// invoice or payment appears. It creates, in the sandbox only: one test customer
// ("CERTIFY-TEST-<time>"), one posted invoice and one payment. Posted invoices
// cannot be deleted in Odoo, so use a throw-away sandbox database.
//
// Refuses to run unless ODOO_ENV=sandbox. The API key is never printed.

import { createOdooClient, describeConfig, loadOdooConfig, redact } from '../api/_odoo.js';
import { runWorker } from '../api/_odooSync.js';
import { MemoryStore } from '../tests/odoo/fakes.mjs';

const write = process.argv.includes('--write');
const cfg = loadOdooConfig();
const secrets = [cfg.apiKey];
let failed = false;
const ok = (name, detail = '') => console.log(`  PASS  ${name}${detail ? ` - ${detail}` : ''}`);
const bad = (name, detail = '') => { failed = true; console.log(`  FAIL  ${name}${detail ? ` - ${detail}` : ''}`); };

console.log('Configuration:', JSON.stringify(describeConfig(cfg)));
if (cfg.env !== 'sandbox') {
  console.error('Refusing to run: ODOO_ENV must be "sandbox" for this script.');
  process.exit(2);
}
if (!cfg.configured) {
  console.error(`Not configured: ${[...cfg.missing, ...cfg.problems, cfg.blocked].filter(Boolean).join('; ')}`);
  process.exit(2);
}

const odoo = createOdooClient(cfg);

async function readOnly() {
  console.log('\nRead-only checks');
  try { const v = await odoo.version(); ok('reach Odoo', v.server_version); } catch (e) { bad('reach Odoo', redact(e.message, secrets)); return; }
  try { await odoo.whoami(); ok('credentials'); } catch (e) { bad('credentials', redact(e.message, secrets)); return; }
  try {
    const j = await odoo.searchRead('account.journal', [['id', 'in', [cfg.salesJournalId, cfg.paymentJournalId]]], ['id', 'type'], { limit: 5 });
    j.some((x) => x.id === cfg.salesJournalId) ? ok('sales journal') : bad('sales journal', `id ${cfg.salesJournalId} not found`);
    j.some((x) => x.id === cfg.paymentJournalId) ? ok('payment journal') : bad('payment journal', `id ${cfg.paymentJournalId} not found`);
    if (cfg.incomeAccountId) {
      (await odoo.searchRead('account.account', [['id', '=', cfg.incomeAccountId]], ['id'], { limit: 1 })).length
        ? ok('income account') : bad('income account', `id ${cfg.incomeAccountId} not found`);
    }
    if (cfg.productId) {
      (await odoo.searchRead('product.product', [['id', '=', cfg.productId]], ['id'], { limit: 1 })).length
        ? ok('product') : bad('product', `id ${cfg.productId} not found`);
    }
    const usd = await odoo.searchRead('res.currency', [['name', '=', 'USD']], ['id', 'active'], { limit: 1 });
    usd.length && usd[0].active !== false ? ok('USD enabled') : bad('USD enabled', 'enable USD in Odoo');
  } catch (e) { bad('lookups', redact(e.message, secrets)); }
}

async function roundTrip() {
  console.log('\nRound trip with the real sync code (sandbox only)');
  const stamp = Date.now();
  const paymentId = `pay_TEST_${stamp}`;
  const store = new MemoryStore();
  store.addProfile({ id: `test-user-${stamp}`, email: `certify-test-${stamp}@example.com`, full_name: 'Certify Test', company_name: `Certify Test ${stamp}`, country: 'US' });
  store.addApp({ id: `test-app-${stamp}`, client_id: `test-user-${stamp}`, company_name: `Certify Test ${stamp}`, recommended_iso: 'ISO 9001:2015', total_amount: 1 });
  store.addEvent('ev-1', {
    type: 'payment.succeeded',
    timestamp: new Date().toISOString(),
    data: {
      id: paymentId, status: 'paid', currency: 'usd',
      total: { amount: '1.00', currency: 'usd', decimals: 2, display_decimals: 2 },
      refunded_amount: null, paid_at: new Date().toISOString(),
      metadata: { applicationIds: `test-app-${stamp}`, clientId: `test-user-${stamp}` },
    },
  });
  const job = store.addJob({ idempotency_key: `whop_payment:${paymentId}`, whop_payment_id: paymentId, source_event_id: 'ev-1' });
  store.settings.enabled = true;
  const ctx = { store, cfg: { ...cfg, enabled: true }, getOdoo: () => odoo, now: () => new Date(), log: () => {} };

  const countMoves = async () => (await odoo.searchRead('account.move', [['ref', '=', `CERTIFY-${paymentId}`]], ['id', 'state', 'payment_state', 'amount_total'], { limit: 5 }));

  await runWorker(ctx);
  let j = store.jobs.get(job.id);
  j.status === 'done' ? ok('first run completed') : bad('first run', `${j.status} ${j.error_kind || ''} ${j.last_error || ''}`);
  let moves = await countMoves();
  moves.length === 1 ? ok('one invoice in Odoo', `total ${moves[0].amount_total}, ${moves[0].state}, ${moves[0].payment_state}`) : bad('invoice count', String(moves.length));

  Object.assign(store.jobs.get(job.id), { status: 'pending', attempts: 0 });
  await runWorker(ctx);
  moves = await countMoves();
  moves.length === 1 ? ok('second run created no duplicate invoice') : bad('duplicate invoice', String(moves.length));
  const partners = await odoo.searchRead('res.partner', [['ref', '=', `CERTIFY-test-user-${stamp}`]], ['id'], { limit: 5 });
  partners.length === 1 ? ok('one customer in Odoo') : bad('customer count', String(partners.length));
}

try {
  await readOnly();
  if (write && !failed) await roundTrip();
  else if (write) console.log('\nSkipping the round trip: fix the read-only failures first.');
} catch (e) {
  bad('unexpected error', redact(e?.message || e, secrets));
}
console.log(failed ? '\nResult: FAILED' : '\nResult: OK');
process.exit(failed ? 1 : 0);
