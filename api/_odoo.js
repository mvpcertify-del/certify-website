// ============================================================================
// Odoo connector (Accounting MVP)
// ============================================================================
// Server-side only. Nothing here is imported by the browser bundle, and the API
// key is read from the environment, never from a request.
//
// Two transports behind one small interface, because the Odoo.com version
// decides which one exists:
//   - 'json2'   Odoo 19+ : POST /json/2/<model>/<method>, bearer API key,
//                          X-Odoo-Database header.
//   - 'jsonrpc' Odoo 14-18: POST /jsonrpc (common.authenticate, then
//                          object.execute_kw). Deprecated upstream.
// ODOO_API_STYLE picks one (default json2). The rest of the integration only
// uses searchRead / create / read / execute, so changing transport touches only
// this file.
//
// Underscore-prefixed on purpose: api/ is at the Vercel Hobby ceiling of 12
// functions, and a file starting with `_` is not deployed as one.
// ============================================================================

/** Error with a `kind` the sync layer uses to decide: retry, or ask a person. */
export class OdooError extends Error {
  constructor(kind, message, { status = null, retryable = false } = {}) {
    super(message);
    this.name = 'OdooError';
    this.kind = kind; // config | auth | network | timeout | server | validation | client
    this.status = status;
    this.retryable = retryable;
  }
}

const MAX_MESSAGE = 500;

/** Remove secrets and cap length before an error text is stored or logged. */
export function redact(text, secrets = []) {
  let out = String(text ?? '');
  for (const s of secrets) {
    if (s && String(s).length >= 4) out = out.split(String(s)).join('[redacted]');
  }
  out = out.replace(/bearer\s+[A-Za-z0-9._~+/=-]+/gi, 'bearer [redacted]');
  return out.length > MAX_MESSAGE ? `${out.slice(0, MAX_MESSAGE)}…` : out;
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const REQUIRED = ['ODOO_URL', 'ODOO_DB', 'ODOO_API_KEY', 'ODOO_ENV', 'ODOO_SALES_JOURNAL_ID', 'ODOO_PAYMENT_JOURNAL_ID'];

function intList(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map(Number)
    .filter((n) => Number.isInteger(n) && n > 0);
}

/**
 * Read and validate the Odoo settings. Never throws; returns what is wrong.
 *
 *   enabled     ODOO_SYNC_ENABLED === 'true'  (off unless set)
 *   configured  every required variable is present and valid
 *   blocked     a safety rule forbids using these settings here
 */
export function loadOdooConfig(env = process.env) {
  const enabled = env.ODOO_SYNC_ENABLED === 'true';
  // DRY-RUN IS THE DEFAULT. Nothing is sent to Odoo and no Odoo credential is
  // needed: the sync runs every check and records the exact operations it WOULD
  // perform. Going live takes an explicit ODOO_DRY_RUN=false.
  const dryRun = String(env.ODOO_DRY_RUN ?? 'true').trim().toLowerCase() !== 'false';
  const style = (env.ODOO_API_STYLE || 'json2').toLowerCase();
  const missing = REQUIRED.filter((k) => !env[k] || !String(env[k]).trim());
  if (style === 'jsonrpc' && !env.ODOO_LOGIN) missing.push('ODOO_LOGIN');
  if (!env.ODOO_INCOME_ACCOUNT_ID && !env.ODOO_PRODUCT_ID) {
    missing.push('ODOO_INCOME_ACCOUNT_ID or ODOO_PRODUCT_ID');
  }

  const problems = [];
  let baseUrl = String(env.ODOO_URL || '').trim().replace(/\/+$/, '');
  if (baseUrl) {
    let parsed = null;
    try { parsed = new URL(baseUrl); } catch { problems.push('ODOO_URL is not a valid URL'); }
    if (parsed && parsed.protocol !== 'https:' && env.ODOO_ALLOW_INSECURE_HTTP !== 'true') {
      problems.push('ODOO_URL must use https');
    }
    if (parsed) baseUrl = `${parsed.protocol}//${parsed.host}`;
  }
  if (!['json2', 'jsonrpc'].includes(style)) problems.push('ODOO_API_STYLE must be json2 or jsonrpc');
  const odooEnv = String(env.ODOO_ENV || '').toLowerCase();
  if (odooEnv && !['sandbox', 'production'].includes(odooEnv)) problems.push('ODOO_ENV must be sandbox or production');

  // Safety: a preview/dev deployment must never talk to the production Odoo
  // database, and the production site must never talk to a sandbox one.
  let blocked = null;
  const vercelEnv = env.VERCEL_ENV; // 'production' | 'preview' | 'development' | undefined (local)
  if (odooEnv === 'production' && vercelEnv && vercelEnv !== 'production') {
    blocked = 'ODOO_ENV=production is not allowed outside the production deployment';
  }
  if (odooEnv === 'sandbox' && vercelEnv === 'production') {
    blocked = 'ODOO_ENV=sandbox is not allowed on the production deployment';
  }

  // CONNECTING needs only the address, the database, the key and the environment
  // label. The journals and income account are needed to CREATE invoices, not to
  // reach Odoo, so a connection test must not wait for them.
  const connectMissing = ['ODOO_URL', 'ODOO_DB', 'ODOO_API_KEY', 'ODOO_ENV']
    .filter((k) => !env[k] || !String(env[k]).trim());
  if (style === 'jsonrpc' && !env.ODOO_LOGIN) connectMissing.push('ODOO_LOGIN');
  const connectable = connectMissing.length === 0 && problems.length === 0 && !blocked;

  const sales = Number(env.ODOO_SALES_JOURNAL_ID);
  const pay = Number(env.ODOO_PAYMENT_JOURNAL_ID);
  const configured = missing.length === 0 && problems.length === 0 && !blocked;

  return {
    enabled,
    dryRun,
    configured,
    connectable,
    connectMissing,
    // Usable by the worker: live needs a complete, unblocked configuration;
    // dry-run needs nothing because it never contacts Odoo.
    ready: dryRun || configured,
    missing,
    problems,
    blocked,
    baseUrl,
    db: env.ODOO_DB || '',
    login: env.ODOO_LOGIN || '',
    apiKey: env.ODOO_API_KEY || '',
    style,
    env: odooEnv || null,
    salesJournalId: Number.isInteger(sales) && sales > 0 ? sales : null,
    paymentJournalId: Number.isInteger(pay) && pay > 0 ? pay : null,
    incomeAccountId: Number(env.ODOO_INCOME_ACCOUNT_ID) || null,
    productId: Number(env.ODOO_PRODUCT_ID) || null,
    // Taxes are NOT invented: empty unless the owner sets ODOO_TAX_IDS.
    taxIds: intList(env.ODOO_TAX_IDS),
  };
}

/** A safe, secret-free summary for the admin screen. */
export function describeConfig(cfg) {
  return {
    enabled: cfg.enabled,
    dryRun: cfg.dryRun,
    ready: cfg.ready,
    configured: cfg.configured,
    connectable: cfg.connectable,
    env: cfg.env,
    style: cfg.style,
    host: cfg.baseUrl ? new URL(cfg.baseUrl).host : null,
    missing: cfg.missing,
    problems: cfg.problems,
    blocked: cfg.blocked,
  };
}

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

function classifyHttp(status, bodyText) {
  if (status === 401 || status === 403) return new OdooError('auth', `Odoo rejected the credentials (HTTP ${status})`, { status });
  if (status === 404) return new OdooError('client', `Odoo endpoint or model not found (HTTP 404): ${bodyText}`, { status });
  if (status === 408 || status === 429) return new OdooError('network', `Odoo is busy (HTTP ${status})`, { status, retryable: true });
  if (status >= 500) return new OdooError('server', `Odoo server error (HTTP ${status}): ${bodyText}`, { status, retryable: true });
  return new OdooError('validation', `Odoo refused the request (HTTP ${status}): ${bodyText}`, { status });
}

function classifyRpcError(err) {
  const name = String(err?.data?.name || err?.name || '');
  const msg = String(err?.data?.message || err?.message || 'Odoo error');
  if (/AccessDenied|AccessError/i.test(name)) return new OdooError('auth', `Odoo denied access: ${msg}`);
  if (/ValidationError|UserError|MissingError/i.test(name)) return new OdooError('validation', `Odoo validation: ${msg}`);
  return new OdooError('server', `Odoo error: ${msg}`, { retryable: true });
}

/**
 * Build a client. `fetchImpl` is injectable so tests never touch the network.
 * Methods take plain JS values and return plain JS values.
 */
export function createOdooClient(cfg, { fetchImpl = globalThis.fetch, timeoutMs = 15000 } = {}) {
  if (!cfg.connectable) {
    throw new OdooError('config', `Odoo is not configured: ${[...cfg.connectMissing, ...cfg.problems, cfg.blocked].filter(Boolean).join('; ')}`);
  }
  const secrets = [cfg.apiKey];
  let uid = null; // jsonrpc only

  async function request(method, path, body, headers = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let res;
    try {
      res = await fetchImpl(`${cfg.baseUrl}${path}`, {
        method,
        headers: { ...(method === 'POST' ? { 'Content-Type': 'application/json; charset=utf-8' } : {}), ...headers },
        ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
        signal: controller.signal,
      });
    } catch (e) {
      if (e?.name === 'AbortError') throw new OdooError('timeout', `Odoo did not answer within ${timeoutMs} ms`, { retryable: true });
      throw new OdooError('network', redact(`Could not reach Odoo: ${e?.message || e}`, secrets), { retryable: true });
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* not JSON */ }
    return { status: res.status, ok: res.ok, json, text };
  }
  const post = (path, body, headers) => request('POST', path, body, headers);

  // ---- json2 (Odoo 19+) ---------------------------------------------------
  async function json2(model, method, payload = {}) {
    const { status, ok, json, text } = await post(`/json/2/${model}/${method}`, payload, {
      Authorization: `bearer ${cfg.apiKey}`,
      'X-Odoo-Database': cfg.db,
    });
    if (!ok) {
      const detail = redact(json?.message || json?.name || text, secrets);
      throw classifyHttp(status, detail);
    }
    return json;
  }

  // ---- jsonrpc (Odoo 14-18) -----------------------------------------------
  async function rpc(service, method, args) {
    const { status, ok, json, text } = await post('/jsonrpc', {
      jsonrpc: '2.0', method: 'call', id: 1, params: { service, method, args },
    });
    if (!ok) throw classifyHttp(status, redact(text, secrets));
    if (json?.error) {
      const e = classifyRpcError(json.error);
      e.message = redact(e.message, secrets);
      throw e;
    }
    return json?.result;
  }
  async function ensureUid() {
    if (uid) return uid;
    const result = await rpc('common', 'authenticate', [cfg.db, cfg.login, cfg.apiKey, {}]);
    if (!result) throw new OdooError('auth', 'Odoo authentication failed (wrong login, database or API key)');
    uid = result;
    return uid;
  }
  async function exec(model, method, args = [], kwargs = {}) {
    const u = await ensureUid();
    return rpc('object', 'execute_kw', [cfg.db, u, cfg.apiKey, model, method, args, kwargs]);
  }

  const useJson2 = cfg.style === 'json2';

  return {
    style: cfg.style,

    /**
     * Server version, without authentication. Proves the URL is an Odoo.
     * `/web/version` answers a plain GET (a POST is refused with a CSRF error).
     */
    async version() {
      const res = await request('GET', '/web/version');
      const j = res.json;
      if (!res.ok || !j) throw new OdooError('network', `Could not read the Odoo version (HTTP ${res.status})`, { retryable: res.status >= 500 });
      return { server_version: j.version || null, serie: Array.isArray(j.version_info) ? `${j.version_info[0]}.${j.version_info[1]}` : null };
    },

    /** Proves the credentials work by reading the integration user's own record. */
    async whoami() {
      if (useJson2) {
        const rows = await json2('res.users', 'search_read', { domain: [['login', '=', cfg.login || '']], fields: ['id', 'login'], limit: 1 }).catch(() => null);
        // json2 has no separate login step; a cheap authenticated read is the check.
        if (rows === null) await json2('res.currency', 'search_read', { domain: [], fields: ['id'], limit: 1 });
        return { ok: true };
      }
      await ensureUid();
      return { ok: true };
    },

    async searchRead(model, domain, fields, { limit = 80, context } = {}) {
      if (useJson2) return json2(model, 'search_read', { domain, fields, limit, ...(context ? { context } : {}) });
      return exec(model, 'search_read', [domain], { fields, limit, ...(context ? { context } : {}) });
    },

    /** Create one record, return its id. */
    async create(model, vals, { context } = {}) {
      if (useJson2) {
        const ids = await json2(model, 'create', { vals_list: [vals], ...(context ? { context } : {}) });
        return Array.isArray(ids) ? ids[0] : ids;
      }
      const id = await exec(model, 'create', [vals], context ? { context } : {});
      return Array.isArray(id) ? id[0] : id;
    },

    async read(model, ids, fields, { context } = {}) {
      if (useJson2) return json2(model, 'read', { ids, fields, ...(context ? { context } : {}) });
      return exec(model, 'read', [ids], { fields, ...(context ? { context } : {}) });
    },

    /** Call a method on existing records (e.g. account.move.action_post). */
    async execute(model, method, ids, kwargs = {}, { context } = {}) {
      if (useJson2) return json2(model, method, { ids, ...kwargs, ...(context ? { context } : {}) });
      return exec(model, method, [ids], { ...kwargs, ...(context ? { context } : {}) });
    },
  };
}
