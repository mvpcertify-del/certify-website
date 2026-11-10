// Entry points for the Odoo sync: admin actions and the cron sweep.
//
// There is no new serverless function. The Vercel Hobby plan allows 12 and the
// project uses all 12, so api/notify-event.js (already the cron route) hands
// anything starting with "odoo-" to this file.

import { verifyAdmin, getAdmin } from './_verifyAdmin.js';
import { createOdooClient, describeConfig, loadOdooConfig, redact, OdooError } from './_odoo.js';
import { runWorker } from './_odooSync.js';
import { createSupabaseStore } from './_odooStore.js';

function makeLog(secrets) {
  return (level, message, fields = {}) => {
    // Ids and statuses only: no customer names, emails or amounts in logs.
    const safe = Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, redact(v, secrets)]));
    (level === 'warn' ? console.warn : console.log)(`[odoo-sync] ${message}`, safe);
  };
}

function buildContext() {
  const cfg = loadOdooConfig();
  const store = createSupabaseStore(getAdmin());
  let client = null;
  return {
    cfg,
    store,
    now: () => new Date(),
    log: makeLog([cfg.apiKey]),
    getOdoo: () => (client ||= createOdooClient(cfg)),
  };
}

/** Read-only checks against the Odoo database: nothing is created or changed. */
async function testConnection(ctx) {
  const { cfg } = ctx;
  const checks = [];
  const record = (name, ok, detail) => checks.push({ name, ok, detail: detail || null });

  if (cfg.dryRun) {
    // Never contact Odoo in dry-run, even if credentials happen to be present.
    return {
      ok: true, dryRun: true, config: describeConfig(cfg),
      checks: [{ name: 'dry-run mode', ok: true, detail: 'No connection is made and nothing is sent to Odoo. Set ODOO_DRY_RUN=false to test the live connection.' }],
    };
  }

  if (!cfg.configured) {
    return { ok: false, config: describeConfig(cfg), checks: [{ name: 'configuration', ok: false, detail: [...cfg.missing, ...cfg.problems, cfg.blocked].filter(Boolean).join('; ') }] };
  }
  const odoo = ctx.getOdoo();
  try {
    const v = await odoo.version();
    record('reach Odoo', true, v.server_version);
    await odoo.whoami();
    record('credentials', true);

    const journals = await odoo.searchRead('account.journal', [['id', 'in', [cfg.salesJournalId, cfg.paymentJournalId]]], ['id', 'name', 'type'], { limit: 5 });
    record('sales journal', journals.some((j) => j.id === cfg.salesJournalId), journals.find((j) => j.id === cfg.salesJournalId)?.type);
    record('payment journal', journals.some((j) => j.id === cfg.paymentJournalId), journals.find((j) => j.id === cfg.paymentJournalId)?.type);

    if (cfg.incomeAccountId) {
      const acc = await odoo.searchRead('account.account', [['id', '=', cfg.incomeAccountId]], ['id'], { limit: 1 });
      record('income account', acc.length === 1);
    }
    if (cfg.productId) {
      const prod = await odoo.searchRead('product.product', [['id', '=', cfg.productId]], ['id'], { limit: 1 });
      record('product', prod.length === 1);
    }
    const usd = await odoo.searchRead('res.currency', [['name', '=', 'USD']], ['id', 'active'], { limit: 1 });
    record('USD enabled', usd.length === 1 && usd[0].active !== false);
  } catch (e) {
    record('error', false, redact(e?.message || e, [cfg.apiKey]));
  }
  return { ok: checks.every((c) => c.ok), config: describeConfig(cfg), checks };
}

/** POST /api/notify-event { action: 'odoo-...' } — Super Admin only. */
export async function handleOdooAdminAction(req, res) {
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status || 403).json({ error: auth.error });

  const action = String(req.body?.action || '');
  try {
    const ctx = buildContext();

    if (action === 'odoo-config-status') {
      const settings = await ctx.store.getSettings();
      return res.status(200).json({ ...describeConfig(ctx.cfg), dbEnabled: Boolean(settings?.enabled) });
    }
    if (action === 'odoo-test-connection') {
      return res.status(200).json(await testConnection(ctx));
    }
    if (action === 'odoo-sync-now') {
      const out = await runWorker(ctx, { limit: 5, deadlineMs: 8000 });
      return res.status(200).json(out);
    }
    if (action === 'odoo-requeue-dry-runs') {
      if (ctx.cfg.dryRun) return res.status(409).json({ error: 'Still in dry-run mode; nothing to requeue for live sync yet.' });
      return res.status(200).json({ requeued: await ctx.store.requeueDryRuns() });
    }
    if (action === 'odoo-retry') {
      const jobId = String(req.body?.jobId || '');
      if (!/^[0-9a-f-]{36}$/i.test(jobId)) return res.status(400).json({ error: 'Missing or invalid jobId' });
      const reset = await ctx.store.retryJob(jobId);
      return res.status(200).json({ ok: reset });
    }
    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    const kind = e instanceof OdooError ? e.kind : 'error';
    console.error('[odoo-sync] admin action failed:', action, kind, redact(e?.message || e));
    return res.status(500).json({ error: redact(e?.message || 'Odoo action failed'), kind });
  }
}

/**
 * Called from the daily cron. A strict no-op unless ODOO_SYNC_ENABLED=true, the
 * configuration is valid and the database switch is on; never throws, and
 * stays inside a small time budget so it cannot starve the renewal sweep.
 */
export async function runOdooSyncIfEnabled({ budgetMs = 4000 } = {}) {
  try {
    if (process.env.ODOO_SYNC_ENABLED !== 'true') return null;
    const ctx = buildContext();
    return await runWorker(ctx, { limit: 5, deadlineMs: budgetMs });
  } catch (e) {
    console.error('[odoo-sync] cron sweep failed:', redact(e?.message || e));
    return null;
  }
}
