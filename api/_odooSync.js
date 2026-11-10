// ============================================================================
// Odoo Accounting sync (MVP)
// ============================================================================
// Mirrors a VERIFIED Whop card payment for a certification order into Odoo:
//   customer (res.partner)  ->  customer invoice (account.move, posted)
//   ->  registered payment (account.payment.register wizard)
//
// Certify.cx keeps issuing its own customer-facing invoice. This only creates
// the mirrored accounting record.
//
// This file holds the LOGIC and talks to the outside world only through two
// injected objects, so it is tested without a database or a network:
//   - `odoo`   the client from _odoo.js (searchRead / create / read / execute)
//   - `store`  persistence, implemented over Supabase in _odooStore.js
//
// What it will never do:
//   * invent tax or accounting settings (taxes only from ODOO_TAX_IDS)
//   * create a second invoice or payment for the same Whop payment
//   * register a payment that was not confirmed by a signature-verified
//     payment.succeeded event
//   * guess when amounts disagree: it stops and asks a person
// ============================================================================

import { OdooError, redact } from './_odoo.js';
import { DryRunOdoo, dryRunStore } from './_odooDryRun.js';

export const MAX_ATTEMPTS = 5;
// 1 min, 5 min, 30 min, 2 h, 12 h
export const BACKOFF_MS = [60_000, 300_000, 1_800_000, 7_200_000, 43_200_000];
export const STALE_LOCK_MS = 10 * 60 * 1000;
const TOLERANCE = 0.01;

/**
 * An outcome that is not an Odoo transport failure.
 *   review:    a person must look (data mismatch, validation, misconfiguration)
 *   retryable: try again later with backoff
 *   skip:      nothing to mirror (out of MVP scope)
 */
export class SyncError extends Error {
  constructor(kind, message, { review = false, retryable = false, skip = false } = {}) {
    super(message);
    this.name = 'SyncError';
    this.kind = kind;
    this.review = review;
    this.retryable = retryable;
    this.skip = skip;
  }
}

const needsReview = (kind, msg) => new SyncError(kind, msg, { review: true });

export const round2 = (n) => Math.round(Number(n) * 100) / 100;

export function backoffMs(attempts) {
  const i = Math.min(Math.max(attempts, 1), BACKOFF_MS.length) - 1;
  return BACKOFF_MS[i];
}

// ---------------------------------------------------------------------------
// Reading the Whop event
// ---------------------------------------------------------------------------

const moneyToNumber = (m) => {
  if (m == null) return null;
  const raw = typeof m === 'object' ? m.amount : m;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
};

/**
 * Pull what the mirror needs out of a stored `payment.succeeded` event.
 * Throws SyncError (skip or review) when the event is not something the MVP
 * mirrors or cannot be trusted to mirror.
 */
export function extractWhopPayment(payload) {
  if (!payload || payload.type !== 'payment.succeeded') {
    throw new SyncError('not_payment', 'Event is not payment.succeeded', { skip: true });
  }
  const data = payload.data || {};
  if (!data.id) throw needsReview('no_payment_id', 'Event carries no payment id');

  const metadata = data.metadata && typeof data.metadata === 'object' ? data.metadata : {};
  if (metadata.type === 'micro_plan') {
    throw new SyncError('out_of_scope', 'MICRO monthly plans are not mirrored in the MVP', { skip: true });
  }

  const applicationIds = String(metadata.applicationIds || metadata.applicationId || '')
    .split(',').map((s) => s.trim()).filter(Boolean);
  if (!applicationIds.length) {
    throw new SyncError('no_application', 'Payment is not linked to a certification order', { skip: true });
  }

  const total = moneyToNumber(data.total);
  if (!(total > 0)) throw needsReview('no_total', 'Payment total is missing or zero');
  const currency = String(data.total?.currency || data.currency || '').toUpperCase();
  if (!currency) throw needsReview('no_currency', 'Payment currency is missing');

  // A status other than "paid" on a payment.succeeded event is unexpected: do
  // not mirror it as money received.
  if (data.status && data.status !== 'paid') {
    throw needsReview('status_not_paid', `Payment status is "${data.status}", not "paid"`);
  }
  const refunded = moneyToNumber(data.refunded_amount) || 0;
  if (refunded > 0) {
    throw needsReview('refunded', 'Payment has been (partly) refunded; credit notes are outside the MVP');
  }

  return {
    paymentId: String(data.id),
    total: round2(total),
    currency,
    paidAt: data.paid_at || payload.timestamp || null,
    applicationIds,
    clientId: metadata.clientId || null,
  };
}

const isoDate = (ts, now) => {
  const d = ts ? new Date(ts) : now;
  return (Number.isNaN(d.getTime()) ? now : d).toISOString().slice(0, 10);
};

// ---------------------------------------------------------------------------
// Building the invoice
// ---------------------------------------------------------------------------

export function buildInvoiceLines(apps, cfg) {
  return apps.map((a) => {
    const label = [
      'Certification',
      a.recommended_iso ? `- ${a.recommended_iso}` : null,
      a.company_name ? `(${a.company_name})` : null,
    ].filter(Boolean).join(' ');
    const line = {
      name: label,
      quantity: 1,
      price_unit: round2(a.total_amount),
      // Explicit, so Odoo does not apply a default tax nobody chose.
      tax_ids: [[6, 0, cfg.taxIds || []]],
    };
    if (cfg.productId) line.product_id = cfg.productId;
    else line.account_id = cfg.incomeAccountId;
    return [0, 0, line];
  });
}

/** The order's own amounts must add up to what Whop actually charged. */
export function reconcile(apps, paymentTotal) {
  if (apps.some((a) => a.total_amount == null || !Number.isFinite(Number(a.total_amount)))) {
    throw needsReview('missing_amount', 'An order in this payment has no recorded amount');
  }
  const sum = round2(apps.reduce((s, a) => s + Number(a.total_amount), 0));
  if (Math.abs(sum - paymentTotal) > TOLERANCE) {
    throw needsReview('amount_mismatch', `Orders add up to ${sum.toFixed(2)} but Whop charged ${paymentTotal.toFixed(2)}`);
  }
  return sum;
}

// ---------------------------------------------------------------------------
// Steps (each safe to repeat)
// ---------------------------------------------------------------------------

async function ensurePartner({ odoo, store, now }, profile) {
  const known = await store.getRecord('partner', profile.id);
  if (known) return known.odoo_id;

  const ref = `CERTIFY-${profile.id}`;
  const byRef = await odoo.searchRead('res.partner', [['ref', '=', ref]], ['id'], { limit: 2 });
  let partnerId = null;
  if (byRef.length > 1) throw needsReview('duplicate_partner', 'More than one Odoo customer carries this Certify reference');
  if (byRef.length === 1) partnerId = byRef[0].id;

  if (!partnerId && profile.email) {
    const byEmail = await odoo.searchRead('res.partner', [['email', '=ilike', profile.email]], ['id'], { limit: 3 });
    if (byEmail.length > 1) throw needsReview('duplicate_partner', 'More than one Odoo customer has this email; pick one in Odoo and retry');
    if (byEmail.length === 1) partnerId = byEmail[0].id; // adopted, not modified
  }

  if (!partnerId) {
    const vals = {
      name: profile.company_name || profile.full_name || profile.email,
      email: profile.email || false,
      ref,
      company_type: profile.company_name ? 'company' : 'person',
    };
    if (!vals.name) throw needsReview('no_customer_name', 'Customer has no name or email to create in Odoo');
    if (profile.phone) vals.phone = profile.phone;
    if (profile.country) {
      const code = String(profile.country).trim();
      const domain = code.length === 2 ? [['code', '=ilike', code]] : [['name', '=ilike', code]];
      const found = await odoo.searchRead('res.country', domain, ['id'], { limit: 2 });
      if (found.length === 1) vals.country_id = found[0].id; // optional; skipped if ambiguous
    }
    partnerId = await odoo.create('res.partner', vals);
  }

  await store.upsertRecord({
    entity_type: 'partner', certify_id: profile.id, odoo_model: 'res.partner',
    odoo_id: partnerId, last_synced_at: now().toISOString(),
  });
  return partnerId;
}

const MOVE_FIELDS = ['id', 'name', 'state', 'payment_state', 'amount_total'];

async function readMove(odoo, id) {
  const rows = await odoo.read('account.move', [id], MOVE_FIELDS);
  if (!rows?.length) throw needsReview('invoice_missing', 'The Odoo invoice no longer exists');
  return rows[0];
}

async function currencyId(odoo, code) {
  const found = await odoo.searchRead('res.currency', [['name', '=', code]], ['id', 'active'], { limit: 1 });
  if (!found.length || found[0].active === false) {
    throw needsReview('currency_unavailable', `Currency ${code} is not enabled in Odoo`);
  }
  return found[0].id;
}

async function ensureInvoice(ctx, { payment, apps, partnerId }) {
  const { odoo, store, cfg, now } = ctx;
  const ref = `CERTIFY-${payment.paymentId}`;

  let moveId = (await store.getRecord('invoice', payment.paymentId))?.odoo_id || null;

  if (!moveId) {
    const existing = await odoo.searchRead(
      'account.move', [['ref', '=', ref], ['move_type', '=', 'out_invoice']], ['id'], { limit: 2 },
    );
    if (existing.length > 1) throw needsReview('duplicate_invoice', 'More than one Odoo invoice carries this reference');
    if (existing.length === 1) moveId = existing[0].id; // already created by an earlier, interrupted run
  }

  if (!moveId) {
    moveId = await odoo.create('account.move', {
      move_type: 'out_invoice',
      partner_id: partnerId,
      ref,
      invoice_origin: `Certify.cx ${payment.paymentId}`,
      invoice_date: isoDate(payment.paidAt, now()),
      currency_id: await currencyId(odoo, payment.currency),
      journal_id: cfg.salesJournalId,
      invoice_line_ids: buildInvoiceLines(apps, cfg),
    });
  }
  // Written the moment it exists: a crash after this point resumes, it does not recreate.
  await store.upsertRecord({
    entity_type: 'invoice', certify_id: payment.paymentId, odoo_model: 'account.move',
    odoo_id: moveId, currency: payment.currency, last_synced_at: now().toISOString(),
  });

  // Odoo may add taxes of its own; the mirror must equal the money received.
  // Checked while the invoice is still a draft, so a wrong total is never posted.
  const checkTotal = (m) => {
    if (Math.abs(round2(m.amount_total) - payment.total) > TOLERANCE) {
      throw needsReview('invoice_total_mismatch', `Odoo invoice total ${m.amount_total} differs from the payment ${payment.total}; check the tax settings`);
    }
  };

  let move = await readMove(odoo, moveId);
  if (move.state === 'cancel') throw needsReview('invoice_cancelled', 'The Odoo invoice was cancelled');
  if (move.state === 'draft') {
    checkTotal(move);
    await odoo.execute('account.move', 'action_post', [moveId]);
    move = await readMove(odoo, moveId);
  }
  if (move.state !== 'posted') throw needsReview('invoice_not_posted', `Odoo invoice is in state "${move.state}"`);
  checkTotal(move);

  await store.upsertRecord({
    entity_type: 'invoice', certify_id: payment.paymentId, odoo_model: 'account.move',
    odoo_id: moveId, odoo_number: move.name, odoo_state: move.state, payment_state: move.payment_state,
    amount: move.amount_total, currency: payment.currency, last_synced_at: now().toISOString(),
  });
  return move;
}

const SETTLED = new Set(['paid', 'in_payment']);

async function ensurePayment(ctx, { payment, move }) {
  const { odoo, store, cfg, now } = ctx;
  let current = move;

  if (!SETTLED.has(current.payment_state)) {
    // Only reachable from a signature-verified payment.succeeded event.
    const context = { active_model: 'account.move', active_ids: [move.id] };
    const wizardId = await odoo.create('account.payment.register', {
      journal_id: cfg.paymentJournalId,
      amount: payment.total,
      payment_date: isoDate(payment.paidAt, now()),
      communication: `WHOP ${payment.paymentId}`,
    }, { context });
    await odoo.execute('account.payment.register', 'action_create_payments', [wizardId], {}, { context });
    current = await readMove(odoo, move.id);
    if (!SETTLED.has(current.payment_state)) {
      throw needsReview('payment_not_registered', `Odoo shows the invoice as "${current.payment_state}" after registering the payment`);
    }
  }

  await store.upsertRecord({
    entity_type: 'payment', certify_id: payment.paymentId, odoo_model: 'account.move',
    odoo_id: move.id, odoo_number: `WHOP ${payment.paymentId}`, odoo_state: current.state,
    payment_state: current.payment_state, amount: payment.total, currency: payment.currency,
    last_synced_at: now().toISOString(),
  });
  await store.upsertRecord({
    entity_type: 'invoice', certify_id: payment.paymentId, odoo_model: 'account.move',
    odoo_id: move.id, odoo_number: current.name, odoo_state: current.state,
    payment_state: current.payment_state, amount: current.amount_total, currency: payment.currency,
    last_synced_at: now().toISOString(),
  });
  return current;
}

// ---------------------------------------------------------------------------
// One job
// ---------------------------------------------------------------------------

/**
 * Run a claimed job to completion (or to the step that failed). Throws on
 * failure; runWorker turns the throw into a job status.
 */
export async function processJob(ctx, job) {
  const { store, log } = ctx;

  const event = job.source_event_id ? await store.getEvent(job.source_event_id) : null;
  if (!event?.payload) throw needsReview('no_event', 'The stored webhook event for this job is missing');
  const payment = extractWhopPayment(event.payload);

  const apps = await store.loadApplications(payment.applicationIds);
  if (apps.length !== payment.applicationIds.length) {
    throw needsReview('order_missing', 'An order named in the payment no longer exists');
  }
  const clientIds = new Set(apps.map((a) => a.client_id));
  if (clientIds.size !== 1) throw needsReview('mixed_customers', 'The payment covers orders of different customers');
  const clientId = apps[0].client_id;
  if (payment.clientId && payment.clientId !== clientId) {
    throw needsReview('customer_mismatch', 'The payment names a different customer than its orders');
  }
  // The webhook marks orders paid before this event is flagged processed, so a
  // not-yet-paid order means timing, not an error: retry.
  if (apps.some((a) => a.payment_status !== 'paid' && a.payment_status !== 'verified')) {
    throw new SyncError('order_not_paid', 'Orders are not marked paid yet', { retryable: true });
  }
  reconcile(apps, payment.total);

  const profile = await store.loadProfile(clientId);
  if (!profile) throw needsReview('no_customer', 'The customer profile no longer exists');

  const odoo = ctx.getOdoo(); // throws config/blocked errors here, before any write

  await store.updateJob(job.id, { step: 'customer' });
  const partnerId = await ensurePartner({ odoo, store, now: ctx.now }, profile);
  log('info', 'odoo customer ready', { job: job.id, payment: payment.paymentId });

  await store.updateJob(job.id, { step: 'invoice' });
  const move = await ensureInvoice({ ...ctx, odoo }, { payment, apps, partnerId });
  log('info', 'odoo invoice ready', { job: job.id, payment: payment.paymentId, state: move.state });

  await store.updateJob(job.id, { step: 'payment' });
  const settled = await ensurePayment({ ...ctx, odoo }, { payment, move });
  log('info', 'odoo payment registered', { job: job.id, payment: payment.paymentId, state: settled.payment_state });

  return { step: 'done' };
}

// ---------------------------------------------------------------------------
// Worker
// ---------------------------------------------------------------------------

function classify(err, attempts) {
  if (err instanceof SyncError) {
    if (err.skip) return { status: 'skipped', retry: false };
    if (err.review) return { status: 'needs_review', retry: false };
    if (err.retryable) return attempts >= MAX_ATTEMPTS ? { status: 'dead', retry: false } : { status: 'failed', retry: true };
  }
  if (err instanceof OdooError) {
    if (err.retryable) return attempts >= MAX_ATTEMPTS ? { status: 'dead', retry: false } : { status: 'failed', retry: true };
    // config / auth / validation / client: waiting does not fix these.
    return { status: 'needs_review', retry: false };
  }
  // Unknown error: could be a bug or a blip. Retry a few times, then stop.
  return attempts >= MAX_ATTEMPTS ? { status: 'dead', retry: false } : { status: 'failed', retry: true };
}

/**
 * Claim and process pending jobs.
 *   ctx: { store, getOdoo, cfg, now, log }
 * Does nothing unless the environment switch AND the database switch are on.
 */
export async function runWorker(ctx, { limit = 5, deadlineMs = 20_000 } = {}) {
  const { store, cfg, now, log } = ctx;
  if (!cfg.enabled) return { skipped: 'env_disabled', processed: 0 };
  // The environment guard protects the live Odoo database; a dry-run never
  // contacts Odoo, so it is not subject to it.
  if (!cfg.dryRun && cfg.blocked) return { skipped: 'blocked', reason: cfg.blocked, processed: 0 };
  if (!cfg.ready) return { skipped: 'not_configured', processed: 0 };
  const settings = await store.getSettings();
  if (!settings?.enabled) return { skipped: 'db_disabled', processed: 0 };

  const started = now().getTime();
  const results = [];
  while (results.length < limit && now().getTime() - started < deadlineMs) {
    const job = await store.claimNext({
      now: now(),
      staleBefore: new Date(now().getTime() - STALE_LOCK_MS),
    });
    if (!job) break;
    // Dry-run: a throw-away stand-in for Odoo and a store that remembers nothing.
    const dry = cfg.dryRun ? new DryRunOdoo(cfg, now) : null;
    const jobCtx = dry ? { ...ctx, store: dryRunStore(store), getOdoo: () => dry } : ctx;
    try {
      await processJob(jobCtx, job);
      const finished = {
        step: 'done', last_error: null, error_kind: null,
        next_retry_at: null, locked_at: null, completed_at: now().toISOString(),
      };
      if (dry) {
        // Not 'done': a later live run can still mirror this payment for real.
        await store.updateJob(job.id, { ...finished, status: 'dry_run', plan: dry.plan() });
        results.push({ id: job.id, status: 'dry_run' });
      } else {
        await store.updateJob(job.id, { ...finished, status: 'done' });
        results.push({ id: job.id, status: 'done' });
      }
    } catch (err) {
      const { status, retry } = classify(err, job.attempts);
      const message = redact(err?.message || String(err), [cfg.apiKey]);
      await store.updateJob(job.id, {
        status,
        last_error: message,
        error_kind: err?.kind || 'unknown',
        locked_at: null,
        next_retry_at: retry ? new Date(now().getTime() + backoffMs(job.attempts)).toISOString() : null,
        ...(status === 'skipped' ? { completed_at: now().toISOString() } : {}),
      });
      log(status === 'skipped' ? 'info' : 'warn', 'odoo sync job did not complete', {
        job: job.id, payment: job.whop_payment_id, status, kind: err?.kind || 'unknown',
      });
      results.push({ id: job.id, status, kind: err?.kind || 'unknown' });
    }
  }
  return { processed: results.length, results };
}
