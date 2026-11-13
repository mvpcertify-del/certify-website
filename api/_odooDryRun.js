// ============================================================================
// Dry-run mode for the Odoo sync
// ============================================================================
// ODOO_DRY_RUN is ON by default. In dry-run the worker runs every real check
// (the order exists and is paid, the amounts add up, the customer is known, the
// payment is verified) and then, instead of calling Odoo, records the exact
// operations it WOULD have performed on the job. No network, no credentials,
// nothing created in Odoo, nothing written to odoo_records.
//
// That lets the whole pipeline be reviewed against real payments before any
// Odoo account is connected. A dry-run job ends as 'dry_run' (not 'done'), so
// switching to live later can process the same payments for real.
// ============================================================================

const round2 = (n) => Math.round(Number(n) * 100) / 100;

/** Stand-in for the Odoo client. Same interface; performs nothing. */
export class DryRunOdoo {
  constructor(cfg, now = () => new Date()) {
    this.cfg = cfg;
    this.now = now;
    this.ops = [];
    this.nextId = -1; // negative ids can never be mistaken for real Odoo ids
    this.moves = new Map();
    this.wizards = new Map();
    this.style = 'dry-run';
  }

  async version() { return { server_version: 'dry-run', serie: null }; }
  async whoami() { return { ok: true }; }

  async searchRead(model, domain) {
    this.ops.push({ op: 'search', model, domain });
    // Currency must "exist" for the pipeline to continue; everything else is
    // reported as not found, so the plan shows the creations it would make.
    if (model === 'res.currency') return [{ id: -100, active: true }];
    return [];
  }

  async create(model, vals, { context } = {}) {
    const id = this.nextId--;
    this.ops.push({ op: 'create', model, values: vals, ...(context ? { context } : {}) });
    if (model === 'account.move') {
      const total = (vals.invoice_line_ids || []).reduce((s, [, , l]) => s + Number(l.price_unit) * Number(l.quantity ?? 1), 0);
      this.moves.set(id, { id, name: '(draft)', state: 'draft', payment_state: 'not_paid', amount_total: round2(total) });
    }
    if (model === 'account.payment.register') this.wizards.set(id, { context });
    return id;
  }

  async read(model, ids, fields) {
    if (model !== 'account.move') return [];
    return ids.map((id) => this.moves.get(id)).filter(Boolean)
      .map((m) => Object.fromEntries(fields.map((f) => [f, m[f]])));
  }

  async execute(model, method, ids, kwargs = {}, { context } = {}) {
    this.ops.push({ op: 'call', model, method, ids, ...(Object.keys(kwargs).length ? { kwargs } : {}), ...(context ? { context } : {}) });
    if (model === 'account.move' && method === 'action_post') {
      const m = this.moves.get(ids[0]);
      if (m) { m.state = 'posted'; m.name = '(dry-run invoice)'; }
    }
    if (model === 'account.payment.register' && method === 'action_create_payments') {
      const w = this.wizards.get(ids[0]);
      const m = this.moves.get(w?.context?.active_ids?.[0]);
      if (m) m.payment_state = 'in_payment';
    }
    return true;
  }

  /** What would have been done, plus the live settings that are still unset. */
  plan() {
    const c = this.cfg;
    const gaps = [];
    if (!c.salesJournalId) gaps.push('ODOO_SALES_JOURNAL_ID');
    if (!c.paymentJournalId) gaps.push('ODOO_PAYMENT_JOURNAL_ID');
    if (!c.incomeAccountId && !c.productId) gaps.push('ODOO_INCOME_ACCOUNT_ID or ODOO_PRODUCT_ID');
    return {
      mode: 'dry-run',
      generated_at: this.now().toISOString(),
      unset_settings: gaps,
      taxes: c.taxIds?.length ? c.taxIds : 'none configured (no tax is added)',
      operations: this.ops,
    };
  }
}

/**
 * Wrap a store so a dry-run leaves no trace in odoo_records: nothing is read as
 * "already created" and nothing is saved as created.
 */
export function dryRunStore(store) {
  return new Proxy(store, {
    get(target, prop) {
      if (prop === 'getRecord') return async () => null;
      if (prop === 'upsertRecord') return async () => {};
      const v = target[prop];
      return typeof v === 'function' ? v.bind(target) : v;
    },
  });
}
