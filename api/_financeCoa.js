// Finance ERP: the Chart of Accounts (Super Admin only).
//
// No new serverless function (the Hobby plan allows 12): api/notify-event.js hands every action that starts with "coa-"
// to this file.
//   coa-list     the active version, the entities and every account with its balance
//   coa-save     add an account, or change one (the code is never changed)
//   coa-history  the audit trail of one account
//
// Rules from the client spec: accounts are added without changing existing codes; every change is kept in an audit trail;
// a revision of the structure is a new version (V1.1), not a silent overwrite of V1.0. This file never touches journals:
// the ledger is posted to through controlled interfaces, and balances here are read from POSTED lines only.

import { getAdmin, verifyAdmin } from './_verifyAdmin.js';
import { CATEGORY_BY_DIGIT } from './_coaMaster.js';

export const IFRS_CLASSES = ['operating', 'investing', 'financing', 'income_tax', 'discontinued', 'oci', 'none'];
export const NORMAL = ['Dr', 'Cr', 'Dr/Cr'];

const TEXT_FIELDS = ['department', 'cost_centre', 'project', 'tax_treatment'];
const fail = (status, message) => Object.assign(new Error(message), { status });
const text = (v, max) => {
  const s = Array.from(String(v == null ? '' : v), (ch) => (ch.charCodeAt(0) < 32 ? ' ' : ch)).join('').trim().slice(0, max);
  return s || null;
};

/**
 * Checks an account being created or changed. Pure, so it is easy to test.
 *   mode 'create': input holds every field; `byCode` is the existing chart.
 *   mode 'update': input holds only the fields to change; `current` is the stored account.
 * Returns { errors, values } where values is what may be written.
 */
export function validateAccount(input, { mode, byCode = {}, current = null, hasPostings = false, netBalance = 0, activeChildren = 0 }) {
  const errors = {};
  const v = {};

  if (mode === 'create') {
    const code = String(input.code || '').trim();
    if (!/^[1-9]\d{3}$/.test(code)) errors.code = 'The code is four digits and starts with 1 to 9 (1 assets, 2 liabilities, 3 equity, 4 revenue, 5 cost of revenue, 6 expenses, 7 finance and tax, 8 OCI, 9 control).';
    else if (byCode[code]) errors.code = `Account ${code} already exists. Codes are never reused or changed.`;
    else { v.code = code; v.category = CATEGORY_BY_DIGIT[code[0]]; }
    v.is_header = input.is_header === true;
  }

  if ('name' in input || mode === 'create') {
    const name = text(input.name, 160);
    if (!name || name.length < 2) errors.name = 'Enter the account name.';
    else v.name = name;
  }

  if ('normal_balance' in input || mode === 'create') {
    if (!NORMAL.includes(input.normal_balance)) errors.normal_balance = 'Choose Dr, Cr or Dr/Cr.';
    else if (mode === 'update' && hasPostings && input.normal_balance !== current.normal_balance) errors.normal_balance = 'This account already has postings, so its normal balance cannot change.';
    else v.normal_balance = input.normal_balance;
  }

  if ('parent_code' in input || mode === 'create') {
    const parent = input.parent_code ? String(input.parent_code) : null;
    const code = v.code || current?.code;
    if (parent) {
      if (!byCode[parent]) errors.parent_code = 'The parent account does not exist.';
      else if (parent === code) errors.parent_code = 'An account cannot be its own parent.';
      else if (code && parent[0] !== code[0]) errors.parent_code = 'The parent must be in the same main category (same first digit).';
      else v.parent_code = parent;
    } else if (mode === 'create') errors.parent_code = 'Choose the parent account.';
    else if (current?.parent_code) errors.parent_code = 'Every account except a top-level group needs a parent.';
  }

  if ('ifrs_class' in input || mode === 'create') {
    const cls = input.ifrs_class || 'none';
    if (!IFRS_CLASSES.includes(cls)) errors.ifrs_class = 'Choose a valid IFRS 18 class.';
    else v.ifrs_class = cls;
  }

  if ('currency' in input) {
    const cur = input.currency ? String(input.currency).trim().toUpperCase() : null;
    if (cur && !/^[A-Z]{3}$/.test(cur)) errors.currency = 'Use a three-letter currency code, for example USD, or leave it empty for any currency.';
    else v.currency = cur;
  }
  if ('entity_id' in input) {
    const e = input.entity_id ? String(input.entity_id) : null;
    if (e && !/^[0-9a-f-]{36}$/i.test(e)) errors.entity_id = 'Invalid entity.';
    else v.entity_id = e;
  }
  for (const f of TEXT_FIELDS) if (f in input) v[f] = text(input[f], 100);

  if ('allow_posting' in input) {
    const isHeader = mode === 'create' ? v.is_header : current?.is_header;
    if (isHeader && input.allow_posting === true) errors.allow_posting = 'A group account cannot be posted to.';
    else v.allow_posting = input.allow_posting === true;
  } else if (mode === 'create') v.allow_posting = !v.is_header;

  if ('is_active' in input) {
    if (input.is_active === false && mode === 'update') {
      if (netBalance !== 0) errors.is_active = 'This account has a balance. Clear it before making the account inactive.';
      else if (activeChildren > 0) errors.is_active = 'This account still has active sub-accounts.';
    }
    v.is_active = input.is_active !== false;
  }

  return { errors, values: v };
}

const toNum = (x) => Number(x || 0);

async function loadChart(db) {
  const { data: accounts, error } = await db.from('coa_accounts').select('*').order('code');
  if (error) throw fail(409, 'The chart of accounts is not set up yet. Run supabase/phase51_chart_of_accounts.sql in Supabase.');
  const { data: bal } = await db.from('coa_balances').select('code, debit_total, credit_total').limit(5000);
  const balances = Object.fromEntries((bal || []).map((b) => [b.code, { debit: toNum(b.debit_total), credit: toNum(b.credit_total) }]));
  return { accounts: accounts || [], balances };
}

export async function handleCoaAction(req, res) {
  const body = req.body || {};
  const action = String(body.action || '');
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status || 403).json({ error: auth.error });

  try {
    const db = getAdmin();

    if (action === 'coa-list') {
      const { accounts, balances } = await loadChart(db);
      const { data: versions } = await db.from('coa_versions').select('*').order('created_at', { ascending: false });
      const { data: entities } = await db.from('fin_entities').select('id, code, name, base_currency').order('code');
      const rows = accounts.map((a) => {
        const b = balances[a.code] || { debit: 0, credit: 0 };
        const net = Math.round((b.debit - b.credit) * 100) / 100; // debit minus credit
        return { ...a, debit_total: b.debit, credit_total: b.credit, net };
      });
      const sum = (key) => Math.round(rows.filter((r) => !r.is_header).reduce((s, r) => s + r[key], 0) * 100) / 100;
      return res.status(200).json({
        version: (versions || []).find((v) => v.status === 'active') || null,
        versions: versions || [],
        entities: entities || [],
        accounts: rows,
        totals: { debit: sum('debit_total'), credit: sum('credit_total') },
      });
    }

    if (action === 'coa-history') {
      const code = String(body.code || '');
      if (!/^[1-9]\d{3}$/.test(code)) throw fail(400, 'Missing account.');
      const { data } = await db.from('coa_audit').select('id, action, before, after, actor, created_at').eq('account_code', code).order('created_at', { ascending: false }).limit(100);
      return res.status(200).json({ history: data || [] });
    }

    if (action === 'coa-save') {
      const { accounts, balances } = await loadChart(db);
      const byCode = Object.fromEntries(accounts.map((a) => [a.code, a]));
      const mode = body.mode === 'create' ? 'create' : 'update';
      const input = body.account || {};

      if (mode === 'create') {
        const { errors, values } = validateAccount(input, { mode, byCode });
        if (Object.keys(errors).length) return res.status(200).json({ ok: false, errors });
        const row = { ...values, introduced_in: (await db.from('coa_versions').select('version').eq('status', 'active').maybeSingle()).data?.version || 'V1.0', updated_by: auth.caller.id };
        const { error } = await db.from('coa_accounts').insert(row);
        if (error) throw error;
        await db.from('coa_audit').insert({ account_code: row.code, action: 'create', before: null, after: row, actor: auth.caller.id });
        return res.status(200).json({ ok: true });
      }

      const code = String(input.code || '');
      const current = byCode[code];
      if (!current) throw fail(404, 'Account not found.');
      const b = balances[code] || { debit: 0, credit: 0 };
      const hasPostings = b.debit !== 0 || b.credit !== 0;
      const activeChildren = accounts.filter((a) => a.parent_code === code && a.is_active).length;
      const change = { ...input };
      delete change.code;
      const { errors, values } = validateAccount(change, { mode, byCode, current, hasPostings, netBalance: Math.round((b.debit - b.credit) * 100) / 100, activeChildren });
      if (Object.keys(errors).length) return res.status(200).json({ ok: false, errors });

      const before = {};
      const after = {};
      for (const [k, val] of Object.entries(values)) {
        if ((current[k] ?? null) !== (val ?? null)) { before[k] = current[k] ?? null; after[k] = val ?? null; }
      }
      if (!Object.keys(after).length) return res.status(200).json({ ok: true, unchanged: true });
      const { error } = await db.from('coa_accounts').update({ ...after, updated_at: new Date().toISOString(), updated_by: auth.caller.id }).eq('code', code);
      if (error) throw error;
      await db.from('coa_audit').insert({ account_code: code, action: 'update', before, after, actor: auth.caller.id });
      return res.status(200).json({ ok: true });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('[coa]', action, e?.message || e);
    return res.status(e?.status || 500).json({ error: e?.message || 'Request failed' });
  }
}
