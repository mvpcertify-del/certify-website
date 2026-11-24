// Finance ERP: General Ledger journals (Super Admin only).
//
// Handled through api/notify-event.js (no new serverless function): every action that starts with "gl-".
//   gl-list          journals, newest first (filter by status, entity, search)
//   gl-get           one journal with its lines
//   gl-create        save a DRAFT journal (human entry or a template), unique reference, validated
//   gl-post          approve and post a draft. The database refuses an unbalanced entry.
//   gl-reverse       correct a posted journal: post the opposite entry, mark the original reversed
//   gl-delete-draft  delete a draft (posted journals can never be deleted)
//   gl-trial-balance every account with debit, credit and balance, per entity, up to a date
//   gl-ledger        the posted lines of one account with a running balance
//   gl-statements    statement of profit or loss for a period and statement of financial position at its end date
//
// Approval control: an entry is created as a draft and only becomes part of the books when it is explicitly posted.
// Who created and who posted it are both recorded. Entries made by an automated source (source other than "manual")
// are flagged for review in the screen.

import { getAdmin, verifyAdmin } from './_verifyAdmin.js';
import { buildStatements, sumLines } from './_financeStatements.js';

export const CURRENCY_RE = /^[A-Z]{3}$/;
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
const fail = (status, message) => Object.assign(new Error(message), { status });
const clean = (v, max) => Array.from(String(v == null ? '' : v), (c) => (c.charCodeAt(0) < 32 ? ' ' : c)).join('').trim().slice(0, max) || null;

/**
 * Validates a journal before it is saved. Pure (tested).
 * input: { entity_id, entry_date, description, currency, fx_rate, source, lines: [{ account_code, debit, credit, memo, department, cost_centre, project }] }
 * Amounts are in the entry currency; fx_rate converts to the entity's base currency (1 when they are the same).
 * Returns { errors: string[], value } where value has the converted lines ready to store.
 */
export function validateJournal(input, accountsByCode) {
  const errors = [];
  const currency = String(input.currency || 'USD').toUpperCase();
  if (!CURRENCY_RE.test(currency)) errors.push('Use a three-letter currency code, for example USD.');
  const fx = Number(input.fx_rate == null || input.fx_rate === '' ? 1 : input.fx_rate);
  if (!(fx > 0)) errors.push('The exchange rate must be above zero.');
  if (!/^[0-9a-f-]{36}$/i.test(String(input.entity_id || ''))) errors.push('Choose the legal entity.');
  const date = String(input.entry_date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(Date.parse(date))) errors.push('Enter a valid date.');

  const raw = Array.isArray(input.lines) ? input.lines : [];
  const lines = [];
  raw.forEach((l, i) => {
    const n = i + 1;
    const debit = r2(l.debit || 0);
    const credit = r2(l.credit || 0);
    if (!debit && !credit && !l.account_code) return; // an untouched blank row
    const acc = accountsByCode[String(l.account_code || '')];
    if (!acc) { errors.push(`Line ${n}: choose an account.`); return; }
    if (acc.is_header || !acc.allow_posting) errors.push(`Line ${n}: ${acc.code} ${acc.name} is a group or does not allow posting.`);
    else if (!acc.is_active) errors.push(`Line ${n}: ${acc.code} ${acc.name} is inactive.`);
    if (acc.currency && acc.currency !== currency) errors.push(`Line ${n}: ${acc.code} only accepts ${acc.currency}.`);
    if (debit < 0 || credit < 0) errors.push(`Line ${n}: amounts cannot be negative.`);
    if ((debit > 0) === (credit > 0)) errors.push(`Line ${n}: enter either a debit or a credit, not both and not neither.`);
    const orig = debit || credit;
    lines.push({
      account_code: acc.code,
      debit: debit ? r2(debit * fx) : 0,
      credit: credit ? r2(credit * fx) : 0,
      currency,
      fx_rate: fx,
      amount_original: orig,
      department: clean(l.department, 100),
      cost_centre: clean(l.cost_centre, 100),
      project: clean(l.project, 100),
      memo: clean(l.memo, 200),
      _d: debit,
      _c: credit,
    });
  });
  if (lines.length < 2) errors.push('A journal needs at least two lines.');

  const od = r2(lines.reduce((s, l) => s + l._d, 0));
  const oc = r2(lines.reduce((s, l) => s + l._c, 0));
  const bd = r2(lines.reduce((s, l) => s + l.debit, 0));
  const bc = r2(lines.reduce((s, l) => s + l.credit, 0));
  if (od !== oc) errors.push(`The journal is not balanced: debits ${od.toFixed(2)}, credits ${oc.toFixed(2)}.`);
  else if (bd !== bc) errors.push(`After conversion at ${fx} the base amounts differ by ${Math.abs(bd - bc).toFixed(2)}. Adjust the rate or an amount.`);
  if (od === 0) errors.push('The journal has no amount.');

  const value = {
    entity_id: input.entity_id,
    entry_date: date,
    description: clean(input.description, 300),
    currency,
    source: clean(input.source, 40) || 'manual',
    lines: lines.map((l) => { const out = { ...l }; delete out._d; delete out._c; return out; }),
    totals: { debit: bd, credit: bc },
  };
  return { errors, value };
}

/** Template: the marketplace example. Customer pays `amount`; `cbShare` is payable to the certification body, the rest is commission. */
export function marketplaceTemplate({ amount, cbShare }) {
  const total = r2(amount);
  const cb = r2(cbShare);
  if (!(total > 0) || !(cb >= 0) || cb > total) return { error: 'The certification body share must be between 0 and the amount paid.' };
  const commission = r2(total - cb);
  const lines = [{ account_code: '1120', debit: total, credit: 0, memo: 'Customer payment received (payment gateway)' }];
  if (cb > 0) lines.push({ account_code: '2110', debit: 0, credit: cb, memo: 'Payable to the certification body (agent, not revenue)' });
  if (commission > 0) lines.push({ account_code: '4101', debit: 0, credit: commission, memo: 'Certify.cx marketplace commission' });
  return { description: 'Marketplace payment: certification body funds and commission (IFRS 15 agent)', lines };
}

/** Template: annual subscription. `kind` is receipt (cash in, deferred) or recognition (one month released to revenue). */
export function subscriptionTemplate({ kind, amount, revenueAccount = '4201' }) {
  const total = r2(amount);
  if (!(total > 0)) return { error: 'Enter the amount.' };
  if (kind === 'receipt') {
    return { description: 'Subscription received in advance', lines: [
      { account_code: '1120', debit: total, credit: 0, memo: 'Subscription payment received' },
      { account_code: '2140', debit: 0, credit: total, memo: 'Deferred until the service is delivered' },
    ] };
  }
  return { description: 'Subscription revenue recognised for the month', lines: [
    { account_code: '2140', debit: total, credit: 0, memo: 'Release from deferred revenue' },
    { account_code: revenueAccount, debit: 0, credit: total, memo: 'Subscription revenue earned' },
  ] };
}

/** The opposite of a posted journal, as draft input. */
export function reversalLines(lines) {
  return lines.map((l) => ({ account_code: l.account_code, debit: Number(l.credit), credit: Number(l.debit), memo: l.memo ? `Reversal: ${l.memo}` : 'Reversal', department: l.department, cost_centre: l.cost_centre, project: l.project }));
}

async function chart(db) {
  const { data, error } = await db.from('coa_accounts').select('code, name, category, normal_balance, is_header, allow_posting, is_active, currency');
  if (error) throw fail(409, 'The ledger is not set up yet. Run supabase/phase51_chart_of_accounts.sql in Supabase.');
  return Object.fromEntries((data || []).map((a) => [a.code, a]));
}

async function nextReference(db, year) {
  const prefix = `JE-${year}-`;
  const { data } = await db.from('fin_journal_entries').select('reference').like('reference', `${prefix}%`).order('reference', { ascending: false }).limit(1);
  const last = data?.[0]?.reference ? Number(data[0].reference.slice(prefix.length)) : 0;
  return `${prefix}${String((Number.isFinite(last) ? last : 0) + 1).padStart(5, '0')}`;
}

async function saveDraft(db, value, userId, extra = {}) {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const reference = await nextReference(db, value.entry_date.slice(0, 4));
    const { data: entry, error } = await db.from('fin_journal_entries').insert({
      entity_id: value.entity_id, reference, entry_date: value.entry_date, description: value.description, currency: value.currency,
      status: 'draft', source: value.source, created_by: userId, ...extra,
    }).select('id, reference').single();
    if (error) { if (String(error.code) === '23505') continue; throw error; } // another entry took that number: try the next
    const { error: le } = await db.from('fin_journal_lines').insert(value.lines.map((l) => ({ ...l, entry_id: entry.id })));
    if (le) { await db.from('fin_journal_entries').delete().eq('id', entry.id); throw le; }
    return entry;
  }
  throw fail(409, 'Could not allocate a reference number. Try again.');
}

async function post(db, id, userId) {
  const { error } = await db.from('fin_journal_entries').update({ status: 'posted', posted_by: userId }).eq('id', id).eq('status', 'draft');
  if (error) throw fail(409, error.message.replace(/^.*?exception:?\s*/i, ''));
}

export async function handleGlAction(req, res) {
  const body = req.body || {};
  const action = String(body.action || '');
  const auth = await verifyAdmin(req, { requireSuperAdmin: true });
  if (auth.error) return res.status(auth.status || 403).json({ error: auth.error });
  const uid = auth.caller.id;

  try {
    const db = getAdmin();

    if (action === 'gl-list') {
      let q = db.from('fin_journal_entries').select('id, entity_id, reference, entry_date, description, currency, status, source, reverses_id, created_by, created_at, posted_at, posted_by').order('entry_date', { ascending: false }).order('reference', { ascending: false }).limit(500);
      if (['draft', 'posted', 'reversed'].includes(body.status)) q = q.eq('status', body.status);
      if (/^[0-9a-f-]{36}$/i.test(String(body.entity_id || ''))) q = q.eq('entity_id', body.entity_id);
      const { data: entries, error } = await q;
      if (error) throw fail(409, 'The ledger is not set up yet. Run supabase/phase51_chart_of_accounts.sql in Supabase.');
      const ids = (entries || []).map((e) => e.id);
      const totals = {};
      if (ids.length) {
        const { data: ls } = await db.from('fin_journal_lines').select('entry_id, debit, credit').in('entry_id', ids);
        for (const l of ls || []) { const t = (totals[l.entry_id] ||= { debit: 0, credit: 0 }); t.debit += Number(l.debit); t.credit += Number(l.credit); }
      }
      const { data: entities } = await db.from('fin_entities').select('id, code, name, base_currency').order('code');
      return res.status(200).json({ entries: (entries || []).map((e) => ({ ...e, debit: r2(totals[e.id]?.debit || 0), credit: r2(totals[e.id]?.credit || 0) })), entities: entities || [] });
    }

    if (action === 'gl-get') {
      const id = String(body.id || '');
      const { data: entry } = await db.from('fin_journal_entries').select('*').eq('id', id).maybeSingle();
      if (!entry) throw fail(404, 'Journal not found.');
      const { data: lines } = await db.from('fin_journal_lines').select('*').eq('entry_id', id).order('debit', { ascending: false });
      return res.status(200).json({ entry, lines: lines || [] });
    }

    if (action === 'gl-template') {
      const t = body.template === 'subscription' ? subscriptionTemplate(body.params || {}) : marketplaceTemplate(body.params || {});
      if (t.error) return res.status(200).json({ ok: false, errors: [t.error] });
      return res.status(200).json({ ok: true, ...t });
    }

    if (action === 'gl-create') {
      const accounts = await chart(db);
      const { errors, value } = validateJournal(body.entry || {}, accounts);
      if (errors.length) return res.status(200).json({ ok: false, errors });
      const { data: ent } = await db.from('fin_entities').select('id, is_active').eq('id', value.entity_id).maybeSingle();
      if (!ent || !ent.is_active) return res.status(200).json({ ok: false, errors: ['That legal entity does not exist or is inactive.'] });
      const entry = await saveDraft(db, value, uid);
      if (body.post === true) await post(db, entry.id, uid);
      return res.status(200).json({ ok: true, id: entry.id, reference: entry.reference, posted: body.post === true });
    }

    if (action === 'gl-post') {
      await post(db, String(body.id || ''), uid);
      return res.status(200).json({ ok: true });
    }

    if (action === 'gl-delete-draft') {
      const { data: e } = await db.from('fin_journal_entries').select('status').eq('id', String(body.id || '')).maybeSingle();
      if (!e) throw fail(404, 'Journal not found.');
      if (e.status !== 'draft') throw fail(409, 'Only a draft can be deleted. Correct a posted journal with a reversal.');
      const { error } = await db.from('fin_journal_entries').delete().eq('id', String(body.id));
      if (error) throw error;
      return res.status(200).json({ ok: true });
    }

    if (action === 'gl-reverse') {
      const id = String(body.id || '');
      const { data: orig } = await db.from('fin_journal_entries').select('*').eq('id', id).maybeSingle();
      if (!orig) throw fail(404, 'Journal not found.');
      if (orig.status !== 'posted') throw fail(409, 'Only a posted journal that has not been reversed can be reversed.');
      const { data: lines } = await db.from('fin_journal_lines').select('*').eq('entry_id', id);
      const accounts = await chart(db);
      const date = /^\d{4}-\d{2}-\d{2}$/.test(String(body.entry_date || '')) ? body.entry_date : new Date().toISOString().slice(0, 10);
      // reuse stored base amounts exactly so the reversal nets to zero whatever the exchange rate
      const value = {
        entity_id: orig.entity_id, entry_date: date, currency: orig.currency, source: 'reversal',
        description: clean(`Reversal of ${orig.reference}${body.reason ? `: ${body.reason}` : ''}`, 300),
        lines: (lines || []).map((l) => ({
          account_code: l.account_code, debit: Number(l.credit), credit: Number(l.debit), currency: l.currency, fx_rate: l.fx_rate,
          amount_original: l.amount_original, department: l.department, cost_centre: l.cost_centre, project: l.project, memo: l.memo ? `Reversal: ${l.memo}` : 'Reversal',
        })),
      };
      if (!value.lines.length || value.lines.some((l) => !accounts[l.account_code])) throw fail(409, 'The journal has no lines to reverse.');
      const entry = await saveDraft(db, value, uid, { reverses_id: orig.id });
      await post(db, entry.id, uid);
      const { error } = await db.from('fin_journal_entries').update({ status: 'reversed' }).eq('id', orig.id).eq('status', 'posted');
      if (error) throw error;
      return res.status(200).json({ ok: true, reference: entry.reference });
    }

    if (action === 'gl-statements') {
      const DATE = /^\d{4}-\d{2}-\d{2}$/;
      const entity = /^[0-9a-f-]{36}$/i.test(String(body.entity_id || '')) ? body.entity_id : null;
      const to = DATE.test(String(body.to || '')) ? body.to : new Date().toISOString().slice(0, 10);
      const from = DATE.test(String(body.from || '')) ? body.from : `${to.slice(0, 4)}-01-01`;
      if (from > to) return res.status(200).json({ ok: false, errors: { from: 'The start date must not be after the end date.' } });
      let q = db.from('fin_journal_entries').select('id, entry_date').in('status', ['posted', 'reversed']).lte('entry_date', to);
      if (entity) q = q.eq('entity_id', entity);
      const { data: entries } = await q.limit(20000);
      const dateOf = Object.fromEntries((entries || []).map((e) => [e.id, e.entry_date]));
      const ids = Object.keys(dateOf);
      let lines = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data } = await db.from('fin_journal_lines').select('entry_id, account_code, debit, credit').in('entry_id', ids.slice(i, i + 200));
        lines = lines.concat(data || []);
      }
      const { data: accounts, error: accErr } = await db.from('coa_accounts').select('code, name, category, parent_code, is_header, ifrs_class').order('code');
      if (accErr) throw accErr;
      const out = buildStatements({
        accounts: accounts || [],
        cumulative: sumLines(lines),
        movement: sumLines(lines.filter((l) => dateOf[l.entry_id] >= from)),
      });
      return res.status(200).json({ ...out, period: { from, to }, entries: ids.length });
    }

    if (action === 'gl-trial-balance' || action === 'gl-ledger') {
      const entity = /^[0-9a-f-]{36}$/i.test(String(body.entity_id || '')) ? body.entity_id : null;
      const asOf = /^\d{4}-\d{2}-\d{2}$/.test(String(body.as_of || '')) ? body.as_of : null;
      const from = /^\d{4}-\d{2}-\d{2}$/.test(String(body.from || '')) ? body.from : null;
      let q = db.from('fin_journal_entries').select('id, reference, entry_date, description, status').in('status', ['posted', 'reversed']);
      if (entity) q = q.eq('entity_id', entity);
      if (asOf) q = q.lte('entry_date', asOf);
      if (from && action === 'gl-ledger') q = q.gte('entry_date', from);
      const { data: entries } = await q.limit(5000);
      const byId = Object.fromEntries((entries || []).map((e) => [e.id, e]));
      const ids = Object.keys(byId);
      let lines = [];
      for (let i = 0; i < ids.length; i += 200) {
        let lq = db.from('fin_journal_lines').select('entry_id, account_code, debit, credit, memo').in('entry_id', ids.slice(i, i + 200));
        if (action === 'gl-ledger') lq = lq.eq('account_code', String(body.code || ''));
        const { data } = await lq;
        lines = lines.concat(data || []);
      }
      if (action === 'gl-ledger') {
        const rows = lines.map((l) => ({ ...byId[l.entry_id], debit: Number(l.debit), credit: Number(l.credit), memo: l.memo }))
          .sort((a, b) => (a.entry_date + a.reference).localeCompare(b.entry_date + b.reference));
        let run = 0;
        return res.status(200).json({ rows: rows.map((r) => { run = r2(run + r.debit - r.credit); return { ...r, running: run }; }) });
      }
      const acc = {};
      for (const l of lines) { const a = (acc[l.account_code] ||= { debit: 0, credit: 0 }); a.debit += Number(l.debit); a.credit += Number(l.credit); }
      return res.status(200).json({ rows: Object.entries(acc).map(([code, v]) => ({ code, debit: r2(v.debit), credit: r2(v.credit) })), entries: ids.length });
    }

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (e) {
    console.error('[gl]', action, e?.message || e);
    return res.status(e?.status || 500).json({ error: e?.message || 'Request failed' });
  }
}
