import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWhopPayment, runWorker, backoffMs, MAX_ATTEMPTS, SyncError, reconcile, buildInvoiceLines,
} from '../../api/_odooSync.js';
import { OdooError, redact } from '../../api/_odoo.js';
import { CFG, scenario, whopEvent, MemoryStore } from './fakes.mjs';

const run = (s, opts) => runWorker(s.ctx, opts);

// ---------------------------------------------------------------------------
// Reading the event
// ---------------------------------------------------------------------------
test('extractWhopPayment reads a verified card payment', () => {
  const p = extractWhopPayment(whopEvent({ total: '1200.00', appIds: ['a', 'b'] }));
  assert.equal(p.paymentId, 'pay_AAA');
  assert.equal(p.total, 1200);
  assert.equal(p.currency, 'USD');
  assert.deepEqual(p.applicationIds, ['a', 'b']);
});

test('MICRO monthly plans are skipped, not mirrored', () => {
  assert.throws(() => extractWhopPayment(whopEvent({ type: 'micro_plan' })), (e) => e instanceof SyncError && e.skip);
});

test('a payment with no order is skipped', () => {
  const ev = whopEvent({});
  ev.data.metadata = {};
  assert.throws(() => extractWhopPayment(ev), (e) => e.skip);
});

test('refunded, non-paid and zero-total payments go to a person', () => {
  assert.throws(() => extractWhopPayment(whopEvent({ refunded: { amount: '10.00', currency: 'usd' } })), (e) => e.review && e.kind === 'refunded');
  assert.throws(() => extractWhopPayment(whopEvent({ status: 'pending' })), (e) => e.review && e.kind === 'status_not_paid');
  assert.throws(() => extractWhopPayment(whopEvent({ total: '0.00' })), (e) => e.review && e.kind === 'no_total');
});

test('invoice lines carry explicit empty taxes unless the owner configured some', () => {
  const lines = buildInvoiceLines([{ total_amount: 100, recommended_iso: 'ISO 9001', company_name: 'Acme' }], CFG);
  assert.deepEqual(lines[0][2].tax_ids, [[6, 0, []]]);
  assert.equal(lines[0][2].account_id, 400);
  const withTax = buildInvoiceLines([{ total_amount: 100 }], { ...CFG, taxIds: [5] });
  assert.deepEqual(withTax[0][2].tax_ids, [[6, 0, [5]]]);
});

test('reconcile rejects orders that do not add up to the payment', () => {
  assert.equal(reconcile([{ total_amount: 600 }, { total_amount: 600 }], 1200), 1200);
  assert.throws(() => reconcile([{ total_amount: 600 }], 1200), (e) => e.kind === 'amount_mismatch');
  assert.throws(() => reconcile([{ total_amount: null }], 1200), (e) => e.kind === 'missing_amount');
});

// ---------------------------------------------------------------------------
// Happy path and idempotency
// ---------------------------------------------------------------------------
test('a verified payment creates one customer, one posted invoice and one payment', async () => {
  const s = scenario();
  const out = await run(s);
  assert.equal(out.processed, 1);
  assert.equal(s.store.jobs.get(s.job.id).status, 'done');
  assert.equal(s.odoo.partners.length, 1);
  assert.equal(s.odoo.partners[0].ref, 'CERTIFY-user-1');
  assert.equal(s.odoo.moves.length, 1);
  assert.equal(s.odoo.moves[0].state, 'posted');
  assert.equal(s.odoo.moves[0].ref, 'CERTIFY-pay_AAA');
  assert.equal(s.odoo.moves[0].amount_total, 1200);
  assert.equal(s.odoo.paymentsCreated, 1);
  assert.equal(s.store.records.get('invoice:pay_AAA').payment_state, 'in_payment');
  assert.ok(s.store.records.get('payment:pay_AAA'));
});

test('running the same job twice never creates a second invoice or payment', async () => {
  const s = scenario();
  await run(s);
  // Force the already-finished job back through the queue.
  Object.assign(s.store.jobs.get(s.job.id), { status: 'pending', attempts: 0 });
  await run(s);
  assert.equal(s.odoo.partners.length, 1);
  assert.equal(s.odoo.moves.length, 1);
  assert.equal(s.odoo.paymentsCreated, 1);
});

test('a basket of two orders becomes one invoice with two lines', async () => {
  const s = scenario({
    apps: [
      { id: 'app-1', client_id: 'user-1', company_name: 'Acme', recommended_iso: 'ISO 9001', total_amount: 700 },
      { id: 'app-2', client_id: 'user-1', company_name: 'Acme', recommended_iso: 'ISO 14001', total_amount: 500 },
    ],
    event: whopEvent({ appIds: ['app-1', 'app-2'] }),
  });
  await run(s);
  assert.equal(s.odoo.moves.length, 1);
  assert.equal(s.odoo.moves[0].invoice_line_ids.length, 2);
  assert.equal(s.odoo.moves[0].amount_total, 1200);
});

test('an invoice created by an interrupted run is adopted, not duplicated', async () => {
  const s = scenario();
  // Odoo already has the invoice (a previous run died before saving the mapping).
  s.odoo.moves.push({ id: 900, move_type: 'out_invoice', ref: 'CERTIFY-pay_AAA', state: 'draft', payment_state: 'not_paid', name: '/', amount_total: 1200 });
  await run(s);
  assert.equal(s.odoo.moves.length, 1);
  assert.equal(s.odoo.moves[0].state, 'posted');
  assert.equal(s.store.records.get('invoice:pay_AAA').odoo_id, 900);
});

test('an invoice already paid in Odoo is not paid a second time', async () => {
  const s = scenario();
  s.odoo.moves.push({ id: 901, move_type: 'out_invoice', ref: 'CERTIFY-pay_AAA', state: 'posted', payment_state: 'paid', name: 'INV/1', amount_total: 1200 });
  await run(s);
  assert.equal(s.odoo.paymentsCreated, 0);
  assert.equal(s.store.jobs.get(s.job.id).status, 'done');
});

test('an existing Odoo customer with the same email is reused, not duplicated', async () => {
  const s = scenario();
  s.odoo.partners.push({ id: 55, name: 'Old name', email: 'Buyer@Example.com' });
  await run(s);
  assert.equal(s.odoo.partners.length, 1);
  assert.equal(s.store.records.get('partner:user-1').odoo_id, 55);
});

// ---------------------------------------------------------------------------
// Stop-and-ask cases
// ---------------------------------------------------------------------------
test('mismatched amounts stop before anything is written to Odoo', async () => {
  const s = scenario({ apps: [{ id: 'app-1', client_id: 'user-1', company_name: 'A', recommended_iso: 'ISO 9001', total_amount: 900 }] });
  await run(s);
  const job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'needs_review');
  assert.equal(job.error_kind, 'amount_mismatch');
  assert.equal(s.odoo.calls.length, 0);
});

test('Odoo adding tax of its own is caught before posting and the payment is NOT registered', async () => {
  const s = scenario({ taxPercent: 10 });
  await run(s);
  const job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'needs_review');
  assert.equal(job.error_kind, 'invoice_total_mismatch');
  assert.equal(s.odoo.moves[0].state, 'draft'); // never posted with the wrong total
  assert.equal(s.odoo.paymentsCreated, 0);
});

test('two Odoo customers with the same email are never guessed between', async () => {
  const s = scenario();
  s.odoo.partners.push({ id: 1, email: 'buyer@example.com' }, { id: 2, email: 'buyer@example.com' });
  await run(s);
  assert.equal(s.store.jobs.get(s.job.id).error_kind, 'duplicate_partner');
  assert.equal(s.odoo.moves.length, 0);
});

test('an order not yet marked paid is retried, not rejected', async () => {
  const s = scenario({ apps: [{ id: 'app-1', client_id: 'user-1', company_name: 'A', recommended_iso: 'X', total_amount: 1200, payment_status: 'pending' }] });
  await run(s);
  const job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'failed');
  assert.ok(job.next_retry_at);
  assert.equal(s.odoo.calls.length, 0);
});

test('a MICRO event that reached the queue is skipped without calling Odoo', async () => {
  const s = scenario({ event: whopEvent({ type: 'micro_plan' }) });
  await run(s);
  assert.equal(s.store.jobs.get(s.job.id).status, 'skipped');
  assert.equal(s.odoo.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Retry
// ---------------------------------------------------------------------------
test('a transient Odoo failure is retried later and resumes without duplicating', async () => {
  const s = scenario();
  s.odoo.failNext('execute:account.move.action_post', new OdooError('network', 'Could not reach Odoo', { retryable: true }));
  await run(s);
  let job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'failed');
  assert.equal(job.step, 'invoice');
  assert.equal(job.attempts, 1);
  assert.ok(new Date(job.next_retry_at) > s.ctx.now());
  assert.equal(s.odoo.moves.length, 1); // created, not yet posted

  // Not due yet: nothing happens.
  assert.equal((await run(s)).processed, 0);

  s.advance(backoffMs(1) + 1000);
  await run(s);
  job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'done');
  assert.equal(s.odoo.moves.length, 1);
  assert.equal(s.odoo.paymentsCreated, 1);
});

test('retries stop after the maximum and the job is marked dead', async () => {
  const s = scenario();
  s.odoo.failNext('searchRead:res.partner', new OdooError('server', 'Odoo server error (HTTP 502)', { retryable: true }), 99);
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    await run(s);
    s.advance(backoffMs(MAX_ATTEMPTS) + 1000);
  }
  const job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'dead');
  assert.equal(job.attempts, MAX_ATTEMPTS);
});

test('an authentication failure waits for a person instead of retrying', async () => {
  const s = scenario();
  s.odoo.failNext('searchRead:res.partner', new OdooError('auth', 'Odoo rejected the credentials (HTTP 401)'));
  await run(s);
  const job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'needs_review');
  assert.equal(job.next_retry_at, null);
});

test('the admin retry puts a stuck job back in the queue and it then completes', async () => {
  const s = scenario();
  s.odoo.failNext('searchRead:res.partner', new OdooError('validation', 'Odoo validation: nope'));
  await run(s);
  assert.equal(s.store.jobs.get(s.job.id).status, 'needs_review');
  assert.equal(await s.store.retryJob(s.job.id), true);
  await run(s);
  assert.equal(s.store.jobs.get(s.job.id).status, 'done');
  assert.equal(s.odoo.moves.length, 1);
});

test('backoff grows and is capped', () => {
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(backoffMs), [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000, 43_200_000]);
});

// ---------------------------------------------------------------------------
// Switches
// ---------------------------------------------------------------------------
test('nothing runs while the environment switch is off', async () => {
  const s = scenario({ cfg: { enabled: false } });
  const out = await run(s);
  assert.equal(out.skipped, 'env_disabled');
  assert.equal(s.store.jobs.get(s.job.id).status, 'pending');
  assert.equal(s.odoo.calls.length, 0);
});

test('nothing runs while the database switch is off', async () => {
  const s = scenario({ dbEnabled: false });
  assert.equal((await run(s)).skipped, 'db_disabled');
  assert.equal(s.odoo.calls.length, 0);
});

test('a blocked or unconfigured setup never reaches Odoo', async () => {
  const blocked = scenario({ cfg: { blocked: 'ODOO_ENV=production is not allowed outside the production deployment' } });
  assert.equal((await run(blocked)).skipped, 'blocked');
  const bad = scenario({ cfg: { configured: false, ready: false } });
  assert.equal((await run(bad)).skipped, 'not_configured');
  assert.equal(blocked.odoo.calls.length + bad.odoo.calls.length, 0);
});

// ---------------------------------------------------------------------------
// Safety of stored errors
// ---------------------------------------------------------------------------
test('the API key never lands in a stored error message', async () => {
  const s = scenario();
  s.odoo.failNext('searchRead:res.partner', new OdooError('validation', `bad request using sekret-key-123 and Bearer sekret-key-123`));
  await run(s);
  const err = s.store.jobs.get(s.job.id).last_error;
  assert.ok(!err.includes('sekret-key-123'));
});

test('redact removes keys, bearer tokens and truncates long text', () => {
  assert.equal(redact('key=abcd1234 end', ['abcd1234']), 'key=[redacted] end');
  assert.match(redact('Authorization: bearer abc.def-123'), /bearer \[redacted\]/);
  assert.ok(redact('x'.repeat(2000)).length <= 501);
});

test('the memory store hands a job to exactly one claimant', async () => {
  const store = new MemoryStore();
  store.addJob({ idempotency_key: 'k', whop_payment_id: 'p', source_event_id: 'e' });
  const now = new Date('2026-11-10T10:00:00Z');
  const a = await store.claimNext({ now, staleBefore: new Date(now - 1) });
  const b = await store.claimNext({ now, staleBefore: new Date(now - 1) });
  assert.ok(a);
  assert.equal(b, null);
});

test('config constant in tests carries no tax unless set', () => {
  assert.deepEqual(CFG.taxIds, []);
});

// ---------------------------------------------------------------------------
// Dry-run (the default mode): nothing is sent to Odoo, the plan is recorded
// ---------------------------------------------------------------------------
const dryCfg = { dryRun: true, configured: false, ready: true, baseUrl: '', db: '', apiKey: '', salesJournalId: null, paymentJournalId: null, incomeAccountId: null };

test('dry-run never calls the real Odoo client, even when one is supplied', async () => {
  const s = scenario({ cfg: dryCfg });
  let touched = 0;
  s.ctx.getOdoo = () => { touched += 1; return s.odoo; };
  await run(s);
  assert.equal(touched, 0);
  assert.equal(s.odoo.calls.length, 0);
});

test('dry-run needs no Odoo settings and ends the job as dry_run, not done', async () => {
  const s = scenario({ cfg: dryCfg });
  const out = await run(s);
  assert.equal(out.results[0].status, 'dry_run');
  const job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'dry_run');
  assert.equal(job.plan.mode, 'dry-run');
});

test('the dry-run plan lists exactly what would be sent to Odoo', async () => {
  const s = scenario({ cfg: dryCfg });
  await run(s);
  const { operations } = s.store.jobs.get(s.job.id).plan;
  const creates = operations.filter((o) => o.op === 'create').map((o) => o.model);
  assert.deepEqual(creates, ['res.partner', 'account.move', 'account.payment.register']);
  const calls = operations.filter((o) => o.op === 'call').map((o) => `${o.model}.${o.method}`);
  assert.deepEqual(calls, ['account.move.action_post', 'account.payment.register.action_create_payments']);
  const invoice = operations.find((o) => o.model === 'account.move' && o.op === 'create').values;
  assert.equal(invoice.move_type, 'out_invoice');
  assert.equal(invoice.ref, 'CERTIFY-pay_AAA');
  assert.equal(invoice.invoice_line_ids[0][2].price_unit, 1200);
  assert.deepEqual(invoice.invoice_line_ids[0][2].tax_ids, [[6, 0, []]]); // no tax invented
  const wizard = operations.find((o) => o.model === 'account.payment.register' && o.op === 'create').values;
  assert.equal(wizard.amount, 1200);
  assert.equal(wizard.communication, 'WHOP pay_AAA');
});

test('the dry-run plan flags the live settings that are still unset', async () => {
  const s = scenario({ cfg: dryCfg });
  await run(s);
  const { unset_settings } = s.store.jobs.get(s.job.id).plan;
  assert.ok(unset_settings.includes('ODOO_SALES_JOURNAL_ID'));
  assert.ok(unset_settings.includes('ODOO_PAYMENT_JOURNAL_ID'));
});

test('dry-run leaves no mapping behind, so a later live run starts clean', async () => {
  const s = scenario({ cfg: dryCfg });
  await run(s);
  assert.equal(s.store.records.size, 0);
});

test('dry-run still enforces the real checks: a mismatch is stopped, not planned', async () => {
  const s = scenario({
    cfg: dryCfg,
    apps: [{ id: 'app-1', client_id: 'user-1', company_name: 'A', recommended_iso: 'X', total_amount: 900 }],
  });
  await run(s);
  const job = s.store.jobs.get(s.job.id);
  assert.equal(job.status, 'needs_review');
  assert.equal(job.error_kind, 'amount_mismatch');
});

test('dry-run is still off until the switches are on', async () => {
  assert.equal((await run(scenario({ cfg: { ...dryCfg, enabled: false } }))).skipped, 'env_disabled');
  assert.equal((await run(scenario({ cfg: dryCfg, dbEnabled: false }))).skipped, 'db_disabled');
});

test('requeueing dry-run jobs makes them runnable for real, and only them', async () => {
  const s = scenario({ cfg: dryCfg });
  await run(s);
  const other = s.store.addJob({ idempotency_key: 'x', whop_payment_id: 'p2', source_event_id: 'ev-1', status: 'needs_review' });
  assert.equal(await s.store.requeueDryRuns(), 1);
  assert.equal(s.store.jobs.get(s.job.id).status, 'pending');
  assert.equal(s.store.jobs.get(other.id).status, 'needs_review');
  // Now live: the same payment is mirrored for real, once.
  s.ctx.cfg = { ...CFG };
  await run(s);
  assert.equal(s.store.jobs.get(s.job.id).status, 'done');
  assert.equal(s.odoo.moves.length, 1);
  assert.equal(s.odoo.paymentsCreated, 1);
});
