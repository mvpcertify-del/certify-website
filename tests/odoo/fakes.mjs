// In-memory stand-ins used by the Odoo tests: a store (instead of Supabase) and
// a fake Odoo (instead of the network), so the sync logic runs end to end with
// no database and no Odoo account.

import { MAX_ATTEMPTS } from '../../api/_odooSync.js';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------
export class MemoryStore {
  constructor({ dbEnabled = true } = {}) {
    this.settings = { enabled: dbEnabled };
    this.jobs = new Map();
    this.events = new Map();
    this.apps = new Map();
    this.profiles = new Map();
    this.records = new Map();
    this.seq = 0;
  }

  addEvent(id, payload) { this.events.set(id, { id, payload }); }
  addApp(app) { this.apps.set(app.id, { payment_status: 'paid', ...app }); }
  addProfile(p) { this.profiles.set(p.id, p); }
  addJob(partial) {
    const id = `00000000-0000-4000-8000-${String(++this.seq).padStart(12, '0')}`;
    const job = {
      id, status: 'pending', step: 'queued', attempts: 0, next_retry_at: null, locked_at: null,
      last_error: null, error_kind: null, created_at: new Date(2026, 10, 10, 0, 0, this.seq).toISOString(), ...partial,
    };
    this.jobs.set(id, job);
    return job;
  }

  async getSettings() { return this.settings; }

  async claimNext({ now, staleBefore }) {
    const due = [...this.jobs.values()]
      .filter((j) => (
        (['pending', 'failed'].includes(j.status) && (!j.next_retry_at || new Date(j.next_retry_at) <= now))
        || (j.status === 'running' && new Date(j.locked_at) < staleBefore)
      ))
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    const job = due[0];
    if (!job) return null;
    job.status = 'running';
    job.locked_at = now.toISOString();
    job.attempts += 1;
    return { ...job };
  }

  async updateJob(id, patch) { Object.assign(this.jobs.get(id), patch); }
  async retryJob(id) {
    const j = this.jobs.get(id);
    if (!j || !['failed', 'needs_review', 'dead'].includes(j.status)) return false;
    Object.assign(j, { status: 'pending', attempts: 0, next_retry_at: null, last_error: null, error_kind: null });
    return true;
  }
  async requeueDryRuns() {
    let n = 0;
    for (const j of this.jobs.values()) {
      if (j.status === 'dry_run') { Object.assign(j, { status: 'pending', attempts: 0, plan: null }); n += 1; }
    }
    return n;
  }
  async getEvent(id) { return this.events.get(id) || null; }
  async loadApplications(ids) { return ids.map((i) => this.apps.get(i)).filter(Boolean).map((a) => ({ ...a })); }
  async loadProfile(id) { return this.profiles.get(id) || null; }
  async getRecord(type, certifyId) { return this.records.get(`${type}:${certifyId}`) || null; }
  async upsertRecord(rec) {
    const key = `${rec.entity_type}:${rec.certify_id}`;
    this.records.set(key, { ...(this.records.get(key) || {}), ...rec });
  }
}

// ---------------------------------------------------------------------------
// Fake Odoo
// ---------------------------------------------------------------------------
export class FakeOdoo {
  constructor({ taxPercent = 0 } = {}) {
    this.partners = [];
    this.moves = [];
    this.wizards = [];
    this.paymentsCreated = 0;
    this.calls = [];
    this.nextId = 100;
    this.taxPercent = taxPercent;
    this.failures = []; // [{ method, error, times }]
  }

  failNext(method, error, times = 1) { this.failures.push({ method, error, times }); }
  _maybeFail(method) {
    const f = this.failures.find((x) => x.method === method && x.times > 0);
    if (f) { f.times -= 1; throw f.error; }
  }
  _match(row, domain) {
    return domain.every(([field, op, value]) => {
      const v = row[field];
      if (op === '=') return v === value;
      if (op === '=ilike') return String(v ?? '').toLowerCase() === String(value).toLowerCase();
      if (op === 'in') return value.includes(v);
      throw new Error(`fake odoo: unsupported operator ${op}`);
    });
  }

  async searchRead(model, domain, fields, opts = {}) {
    this.calls.push(`searchRead:${model}`);
    this._maybeFail(`searchRead:${model}`);
    const limit = opts.limit ?? 80;
    if (model === 'res.partner') return this.partners.filter((p) => this._match(p, domain)).slice(0, limit);
    if (model === 'res.country') return [{ id: 233, code: 'US', name: 'United States' }].filter((c) => this._match(c, domain));
    if (model === 'res.currency') return [{ id: 1, name: 'USD', active: true }].filter((c) => this._match(c, domain));
    if (model === 'account.move') return this.moves.filter((m) => this._match(m, domain)).slice(0, limit);
    throw new Error(`fake odoo: unsupported model ${model}`);
  }

  async create(model, vals, opts = {}) {
    this.calls.push(`create:${model}`);
    this._maybeFail(`create:${model}`);
    const id = this.nextId++;
    if (model === 'res.partner') { this.partners.push({ id, ...vals }); return id; }
    if (model === 'account.move') {
      const net = vals.invoice_line_ids.reduce((s, [, , l]) => s + l.price_unit * (l.quantity ?? 1), 0);
      this.moves.push({
        id, ...vals, name: '/', state: 'draft', payment_state: 'not_paid',
        amount_total: Math.round(net * (1 + this.taxPercent / 100) * 100) / 100,
      });
      return id;
    }
    if (model === 'account.payment.register') { this.wizards.push({ id, ...vals, context: opts.context }); return id; }
    throw new Error(`fake odoo: cannot create ${model}`);
  }

  async read(model, ids, fields) {
    this.calls.push(`read:${model}`);
    this._maybeFail(`read:${model}`);
    if (model !== 'account.move') throw new Error(`fake odoo: cannot read ${model}`);
    return ids.map((id) => this.moves.find((m) => m.id === id)).filter(Boolean)
      .map((m) => Object.fromEntries(fields.map((f) => [f, m[f]])));
  }

  async execute(model, method, ids, kwargs = {}, opts = {}) {
    this.calls.push(`execute:${model}.${method}`);
    this._maybeFail(`execute:${model}.${method}`);
    if (model === 'account.move' && method === 'action_post') {
      const m = this.moves.find((x) => x.id === ids[0]);
      m.state = 'posted';
      m.name = `INV/2026/${String(m.id).padStart(5, '0')}`;
      return true;
    }
    if (model === 'account.payment.register' && method === 'action_create_payments') {
      const w = this.wizards.find((x) => x.id === ids[0]);
      const m = this.moves.find((x) => x.id === w.context.active_ids[0]);
      m.payment_state = 'in_payment';
      this.paymentsCreated += 1;
      return { type: 'ir.actions.act_window_close' };
    }
    throw new Error(`fake odoo: unsupported ${model}.${method}`);
  }
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------
export const CFG = {
  enabled: true, dryRun: false, ready: true, configured: true, blocked: null, missing: [], problems: [],
  baseUrl: 'https://example.odoo.com', db: 'test', apiKey: 'sekret-key-123', style: 'json2', env: 'sandbox',
  salesJournalId: 1, paymentJournalId: 7, incomeAccountId: 400, productId: null, taxIds: [],
};

export function whopEvent({ paymentId = 'pay_AAA', total = '1200.00', currency = 'usd', appIds = ['app-1'], clientId = 'user-1', type = undefined, status = 'paid', refunded = null } = {}) {
  return {
    type: 'payment.succeeded',
    timestamp: '2026-11-10T09:30:00Z',
    data: {
      id: paymentId, status, currency,
      total: { amount: total, currency, decimals: 2, display_decimals: 2 },
      refunded_amount: refunded,
      paid_at: '2026-11-10T09:29:00Z',
      metadata: { applicationIds: appIds.join(','), clientId, ...(type ? { type } : {}) },
    },
  };
}

/** A store + fake Odoo + ctx with one standard paid order, ready to run. */
export function scenario({ apps, event, dbEnabled = true, taxPercent = 0, cfg = {} } = {}) {
  const store = new MemoryStore({ dbEnabled });
  const odoo = new FakeOdoo({ taxPercent });
  store.addProfile({ id: 'user-1', email: 'buyer@example.com', full_name: 'Bea Buyer', company_name: 'Acme Ltd', phone: '+1 555', country: 'US' });
  for (const a of apps || [{ id: 'app-1', client_id: 'user-1', company_name: 'Acme Ltd', recommended_iso: 'ISO 9001:2015', total_amount: 1200 }]) store.addApp(a);
  const ev = event || whopEvent({});
  store.addEvent('ev-1', ev);
  const job = store.addJob({ idempotency_key: `whop_payment:${ev.data.id}`, whop_payment_id: ev.data.id, source_event_id: 'ev-1' });
  let clock = new Date('2026-11-10T10:00:00Z');
  const ctx = {
    store, cfg: { ...CFG, ...cfg }, getOdoo: () => odoo,
    now: () => new Date(clock),
    log: () => {},
  };
  return { store, odoo, ctx, job, advance: (ms) => { clock = new Date(clock.getTime() + ms); }, MAX_ATTEMPTS };
}
