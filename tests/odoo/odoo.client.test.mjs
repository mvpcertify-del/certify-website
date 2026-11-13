import test from 'node:test';
import assert from 'node:assert/strict';
import { loadOdooConfig, createOdooClient, describeConfig, OdooError } from '../../api/_odoo.js';

const GOOD_ENV = {
  ODOO_URL: 'https://acme.odoo.com',
  ODOO_DB: 'acme',
  ODOO_API_KEY: 'sekret-key-123',
  ODOO_ENV: 'sandbox',
  ODOO_SALES_JOURNAL_ID: '1',
  ODOO_PAYMENT_JOURNAL_ID: '7',
  ODOO_INCOME_ACCOUNT_ID: '400',
};

// A fetch double that records requests and replays canned responses.
function fakeFetch(...responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init, body: init?.body ? JSON.parse(init.body) : null });
    const r = responses.shift();
    if (r instanceof Error) throw r;
    const body = typeof r.body === 'string' ? r.body : JSON.stringify(r.body ?? null);
    return { ok: (r.status ?? 200) < 400, status: r.status ?? 200, text: async () => body };
  };
  return { impl, calls };
}

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------
test('integration is OFF and unconfigured by default', () => {
  const cfg = loadOdooConfig({});
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.configured, false);
  assert.ok(cfg.missing.includes('ODOO_URL'));
});

test('a complete environment is configured but still not enabled until ODOO_SYNC_ENABLED=true', () => {
  const cfg = loadOdooConfig(GOOD_ENV);
  assert.equal(cfg.configured, true);
  assert.equal(cfg.enabled, false);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_SYNC_ENABLED: 'true' }).enabled, true);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_SYNC_ENABLED: '1' }).enabled, false);
});

test('taxes are not invented: empty unless ODOO_TAX_IDS is set', () => {
  assert.deepEqual(loadOdooConfig(GOOD_ENV).taxIds, []);
  assert.deepEqual(loadOdooConfig({ ...GOOD_ENV, ODOO_TAX_IDS: '3, 5' }).taxIds, [3, 5]);
});

test('an income account or a product is required, never defaulted', () => {
  const env = { ...GOOD_ENV };
  delete env.ODOO_INCOME_ACCOUNT_ID;
  const cfg = loadOdooConfig(env);
  assert.equal(cfg.configured, false);
  assert.ok(cfg.missing.some((m) => m.includes('ODOO_INCOME_ACCOUNT_ID')));
});

test('http URLs are rejected, https accepted, the host is normalised', () => {
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_URL: 'http://acme.odoo.com' }).configured, false);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_URL: 'https://acme.odoo.com/some/path/' }).baseUrl, 'https://acme.odoo.com');
});

test('jsonrpc needs a login; json2 does not', () => {
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_API_STYLE: 'jsonrpc' }).configured, false);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_API_STYLE: 'jsonrpc', ODOO_LOGIN: 'bot@x.com' }).configured, true);
  assert.equal(loadOdooConfig(GOOD_ENV).style, 'json2');
});

test('a preview deployment may never use the production Odoo database, nor production the sandbox', () => {
  const prodOnPreview = loadOdooConfig({ ...GOOD_ENV, ODOO_ENV: 'production', VERCEL_ENV: 'preview' });
  assert.ok(prodOnPreview.blocked);
  assert.equal(prodOnPreview.configured, false);
  const sandboxOnProd = loadOdooConfig({ ...GOOD_ENV, ODOO_ENV: 'sandbox', VERCEL_ENV: 'production' });
  assert.ok(sandboxOnProd.blocked);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_ENV: 'sandbox', VERCEL_ENV: 'preview' }).blocked, null);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_ENV: 'production', VERCEL_ENV: 'production' }).blocked, null);
});

test('describeConfig never exposes the API key', () => {
  const text = JSON.stringify(describeConfig(loadOdooConfig({ ...GOOD_ENV, ODOO_SYNC_ENABLED: 'true' })));
  assert.ok(!text.includes('sekret-key-123'));
  assert.ok(text.includes('acme.odoo.com'));
});

test('an unconfigured client cannot be built', () => {
  assert.throws(() => createOdooClient(loadOdooConfig({})), (e) => e instanceof OdooError && e.kind === 'config');
});

test('connecting needs only the address, database, key and environment label', () => {
  const only = { ODOO_URL: 'https://certify.odoo.com', ODOO_DB: 'certify', ODOO_API_KEY: 'sekret-key-123', ODOO_ENV: 'production' };
  const cfg = loadOdooConfig(only);
  assert.equal(cfg.connectable, true);
  assert.equal(cfg.configured, false); // journals and income account still missing
  assert.doesNotThrow(() => createOdooClient(cfg, { fetchImpl: async () => ({ ok: true, status: 200, text: async () => '[]' }) }));
  assert.equal(loadOdooConfig({ ...only, ODOO_DB: '' }).connectable, false);
  assert.equal(loadOdooConfig({ ...only, ODOO_API_KEY: '' }).connectable, false);
  assert.deepEqual(loadOdooConfig({}).connectMissing, ['ODOO_URL', 'ODOO_DB', 'ODOO_API_KEY', 'ODOO_ENV']);
});

test('a production label on a preview deployment is still refused for connecting', () => {
  const cfg = loadOdooConfig({ ODOO_URL: 'https://certify.odoo.com', ODOO_DB: 'certify', ODOO_API_KEY: 'sekret-key-123', ODOO_ENV: 'production', VERCEL_ENV: 'preview' });
  assert.equal(cfg.connectable, false);
});

// ---------------------------------------------------------------------------
// json2 transport
// ---------------------------------------------------------------------------
test('json2: sends bearer key and database header to the model/method path', async () => {
  const f = fakeFetch({ body: [{ id: 7 }] });
  const client = createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: f.impl });
  const rows = await client.searchRead('res.partner', [['ref', '=', 'X']], ['id'], { limit: 2 });
  assert.deepEqual(rows, [{ id: 7 }]);
  const c = f.calls[0];
  assert.equal(c.url, 'https://acme.odoo.com/json/2/res.partner/search_read');
  assert.equal(c.init.headers.Authorization, 'bearer sekret-key-123');
  assert.equal(c.init.headers['X-Odoo-Database'], 'acme');
  assert.deepEqual(c.body, { domain: [['ref', '=', 'X']], fields: ['id'], limit: 2 });
});

test('json2: create returns the new id, execute passes ids and context', async () => {
  const f = fakeFetch({ body: [42] }, { body: true });
  const client = createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: f.impl });
  assert.equal(await client.create('account.move', { ref: 'R' }), 42);
  await client.execute('account.move', 'action_post', [42], {}, { context: { a: 1 } });
  assert.deepEqual(f.calls[0].body, { vals_list: [{ ref: 'R' }] });
  assert.equal(f.calls[1].url, 'https://acme.odoo.com/json/2/account.move/action_post');
  assert.deepEqual(f.calls[1].body, { ids: [42], context: { a: 1 } });
});

test('json2: 401/403 is an auth error and is not retried', async () => {
  const client = createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: fakeFetch({ status: 401, body: { message: 'no' } }).impl });
  await assert.rejects(() => client.read('account.move', [1], ['id']), (e) => e.kind === 'auth' && e.retryable === false);
});

test('json2: 5xx and 429 are retryable, 400 is a validation error', async () => {
  const mk = (status) => createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: fakeFetch({ status, body: { message: 'x' } }).impl });
  await assert.rejects(() => mk(502).read('account.move', [1], ['id']), (e) => e.kind === 'server' && e.retryable);
  await assert.rejects(() => mk(429).read('account.move', [1], ['id']), (e) => e.kind === 'network' && e.retryable);
  await assert.rejects(() => mk(400).read('account.move', [1], ['id']), (e) => e.kind === 'validation' && !e.retryable);
});

test('network failures and timeouts are retryable', async () => {
  const down = createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: fakeFetch(new Error('ECONNRESET')).impl });
  await assert.rejects(() => down.read('account.move', [1], ['id']), (e) => e.kind === 'network' && e.retryable);

  const hang = (url, init) => new Promise((_, reject) => {
    init.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  });
  const slow = createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: hang, timeoutMs: 20 });
  await assert.rejects(() => slow.read('account.move', [1], ['id']), (e) => e.kind === 'timeout' && e.retryable);
});

test('an error that echoes the API key is redacted', async () => {
  const client = createOdooClient(loadOdooConfig(GOOD_ENV), {
    fetchImpl: fakeFetch({ status: 400, body: { message: 'bad key sekret-key-123 supplied' } }).impl,
  });
  await assert.rejects(() => client.read('account.move', [1], ['id']), (e) => !e.message.includes('sekret-key-123'));
});

// ---------------------------------------------------------------------------
// jsonrpc transport
// ---------------------------------------------------------------------------
test('jsonrpc: authenticates once, then uses execute_kw with the uid', async () => {
  const env = { ...GOOD_ENV, ODOO_API_STYLE: 'jsonrpc', ODOO_LOGIN: 'bot@acme.com' };
  const f = fakeFetch({ body: { result: 9 } }, { body: { result: [{ id: 1 }] } }, { body: { result: [{ id: 2 }] } });
  const client = createOdooClient(loadOdooConfig(env), { fetchImpl: f.impl });
  await client.searchRead('res.partner', [['ref', '=', 'X']], ['id'], { limit: 1 });
  await client.searchRead('res.partner', [['ref', '=', 'Y']], ['id'], { limit: 1 });
  assert.equal(f.calls.length, 3); // one authenticate, two reads
  assert.equal(f.calls[0].url, 'https://acme.odoo.com/jsonrpc');
  assert.deepEqual(f.calls[0].body.params.args, ['acme', 'bot@acme.com', 'sekret-key-123', {}]);
  assert.deepEqual(f.calls[1].body.params.args.slice(0, 5), ['acme', 9, 'sekret-key-123', 'res.partner', 'search_read']);
});

test('jsonrpc: AccessDenied maps to auth, ValidationError to validation', async () => {
  const env = { ...GOOD_ENV, ODOO_API_STYLE: 'jsonrpc', ODOO_LOGIN: 'bot@acme.com' };
  const denied = createOdooClient(loadOdooConfig(env), {
    fetchImpl: fakeFetch({ body: { error: { data: { name: 'odoo.exceptions.AccessDenied', message: 'Access Denied' } } } }).impl,
  });
  await assert.rejects(() => denied.searchRead('res.partner', [], ['id']), (e) => e.kind === 'auth');
  const invalid = createOdooClient(loadOdooConfig(env), {
    fetchImpl: fakeFetch({ body: { result: 9 } }, { body: { error: { data: { name: 'odoo.exceptions.ValidationError', message: 'bad' } } } }).impl,
  });
  await assert.rejects(() => invalid.create('account.move', {}), (e) => e.kind === 'validation' && !e.retryable);
});

test('jsonrpc: a failed authenticate (false) is an auth error', async () => {
  const env = { ...GOOD_ENV, ODOO_API_STYLE: 'jsonrpc', ODOO_LOGIN: 'bot@acme.com' };
  const client = createOdooClient(loadOdooConfig(env), { fetchImpl: fakeFetch({ body: { result: false } }).impl });
  await assert.rejects(() => client.searchRead('res.partner', [], ['id']), (e) => e.kind === 'auth');
});

// ---------------------------------------------------------------------------
// Dry-run default
// ---------------------------------------------------------------------------
test('dry-run is ON by default and needs no Odoo settings', () => {
  const cfg = loadOdooConfig({});
  assert.equal(cfg.dryRun, true);
  assert.equal(cfg.ready, true);
  assert.equal(cfg.configured, false);
});

test('only an explicit ODOO_DRY_RUN=false goes live', () => {
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_DRY_RUN: 'false' }).dryRun, false);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_DRY_RUN: 'FALSE' }).dryRun, false);
  for (const v of ['true', '', '0', 'no', undefined]) {
    assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_DRY_RUN: v }).dryRun, true, `value ${v}`);
  }
});

test('live mode is only ready with a complete configuration', () => {
  assert.equal(loadOdooConfig({ ODOO_DRY_RUN: 'false' }).ready, false);
  assert.equal(loadOdooConfig({ ...GOOD_ENV, ODOO_DRY_RUN: 'false' }).ready, true);
});

// ---------------------------------------------------------------------------
// Version probe (GET, as Odoo answers it)
// ---------------------------------------------------------------------------
test('version() reads /web/version with a GET and no credentials', async () => {
  const f = fakeFetch({ body: { version_info: [20, 0, 0, 'final', 0, 'e'], version: '20.0+e' } });
  const client = createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: f.impl });
  const v = await client.version();
  assert.equal(v.server_version, '20.0+e');
  assert.equal(v.serie, '20.0');
  assert.equal(f.calls[0].url, 'https://acme.odoo.com/web/version');
  assert.equal(f.calls[0].init.method, 'GET');
  assert.equal(f.calls[0].init.body, undefined);
  assert.equal(f.calls[0].init.headers.Authorization, undefined);
});

test('version() reports an unreachable or non-Odoo address', async () => {
  const client = createOdooClient(loadOdooConfig(GOOD_ENV), { fetchImpl: fakeFetch({ status: 404, body: 'nope' }).impl });
  await assert.rejects(() => client.version(), (e) => e.kind === 'network');
});
