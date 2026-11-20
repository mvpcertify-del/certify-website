import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Download, History, Pencil, Plus, RefreshCw, Search, X } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import './AdminNotifications.css';
import './AdminChartOfAccounts.css';

// Finance ERP > Chart of Accounts (Super Admin).
// The approved Master COA, IFRS edition V1.0: every account with its normal balance (Dr or Cr), parent, currency,
// IFRS 18 class and status. Balances come from POSTED journal lines only, so until something is posted every balance is 0.00.
// Accounts are added without changing existing codes, and every change is kept in the account's history.

const call = (action, body = {}) => apiPost('/api/notify-event', { action, ...body });
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

const CATEGORY = {
  asset: 'Assets', liability: 'Liabilities', equity: 'Equity', revenue: 'Revenue', cost_of_revenue: 'Cost of revenue',
  expense: 'Operating expenses', finance_other: 'Finance, investing and tax', oci: 'Other comprehensive income', control: 'Control and clearing',
};
const IFRS = {
  operating: 'Operating', investing: 'Investing', financing: 'Financing', income_tax: 'Income tax',
  discontinued: 'Discontinued operations', oci: 'Other comprehensive income', none: 'Balance sheet / none',
};
const TEXT_FIELDS = [['department', 'Department'], ['cost_centre', 'Cost centre'], ['project', 'Project'], ['tax_treatment', 'Tax treatment']];
const EMPTY_NEW = { code: '', name: '', parent_code: '', normal_balance: 'Dr', is_header: false, ifrs_class: 'none', currency: '', department: '', cost_centre: '', project: '', tax_treatment: '' };

const csvCell = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };

export default function AdminChartOfAccounts() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('active');
  const [accountsOnly, setAccountsOnly] = useState(false);
  const [edit, setEdit] = useState(null); // { code, fields }
  const [adding, setAdding] = useState(null);
  const [errors, setErrors] = useState({});
  const [hist, setHist] = useState(null); // { code, rows }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setData(await call('coa-list')); } catch (e) { setError(e.message || 'Could not load the chart of accounts.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const accounts = useMemo(() => data?.accounts || [], [data]);
  const byCode = useMemo(() => Object.fromEntries(accounts.map((a) => [a.code, a])), [accounts]);
  const depth = (a) => { let d = 0; let p = a.parent_code; while (p && byCode[p] && d < 6) { d += 1; p = byCode[p].parent_code; } return d; };

  // A group's balance is the sum of the accounts under it.
  const groupNet = useMemo(() => {
    const kids = {};
    for (const a of accounts) if (a.parent_code) (kids[a.parent_code] ||= []).push(a.code);
    const total = (code) => (byCode[code].is_header || (kids[code] || []).length
      ? (kids[code] || []).reduce((s, c) => s + total(c), byCode[code].is_header ? 0 : byCode[code].net)
      : byCode[code].net);
    return Object.fromEntries(accounts.filter((a) => a.is_header).map((a) => [a.code, Math.round(total(a.code) * 100) / 100]));
  }, [accounts, byCode]);

  const counts = useMemo(() => {
    const c = { all: 0 };
    for (const a of accounts) if (!a.is_header && a.is_active) { c.all += 1; c[a.category] = (c[a.category] || 0) + 1; }
    return c;
  }, [accounts]);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return accounts.filter((a) => (
      (cat === 'all' || a.category === cat)
      && (status === 'all' || (status === 'active' ? a.is_active : !a.is_active))
      && (!accountsOnly || !a.is_header)
      && (!t || a.code.includes(t) || a.name.toLowerCase().includes(t))
    ));
  }, [accounts, cat, status, accountsOnly, q]);

  const balanceText = (a) => {
    const net = a.is_header ? groupNet[a.code] : a.net;
    if (!net) return '0.00';
    return `${money(Math.abs(net))} ${net > 0 ? 'Dr' : 'Cr'}`;
  };

  const startEdit = (a) => {
    setErrors({});
    setAdding(null);
    setEdit({
      code: a.code,
      fields: {
        name: a.name, parent_code: a.parent_code || '', normal_balance: a.normal_balance, ifrs_class: a.ifrs_class, currency: a.currency || '',
        entity_id: a.entity_id || '', department: a.department || '', cost_centre: a.cost_centre || '', project: a.project || '',
        tax_treatment: a.tax_treatment || '', allow_posting: a.allow_posting, is_active: a.is_active,
      },
    });
  };

  const save = async (mode) => {
    setBusy(true);
    setError('');
    setNotice('');
    setErrors({});
    try {
      const account = mode === 'create' ? { ...adding, parent_code: adding.parent_code || null, currency: adding.currency || null } : { code: edit.code, ...edit.fields, parent_code: edit.fields.parent_code || null, currency: edit.fields.currency || null, entity_id: edit.fields.entity_id || null };
      const out = await call('coa-save', { mode, account });
      if (out.ok === false) { setErrors(out.errors || {}); return; }
      setNotice(mode === 'create' ? `Account ${account.code} added.` : out.unchanged ? 'No change to save.' : `Account ${edit.code} saved.`);
      setEdit(null);
      setAdding(null);
      await load();
    } catch (e) { setError(e.message || 'That did not work.'); } finally { setBusy(false); }
  };

  const openHistory = async (code) => {
    setHist({ code, rows: null });
    try { setHist({ code, rows: (await call('coa-history', { code })).history || [] }); } catch (e) { setError(e.message || 'Could not load the history.'); setHist(null); }
  };

  const exportCsv = () => {
    const head = ['Code', 'Account', 'Type', 'Category', 'Parent', 'Normal balance', 'Currency', 'IFRS 18 class', 'Department', 'Cost centre', 'Project', 'Tax treatment', 'Posting allowed', 'Active', 'Balance (net Dr minus Cr)'];
    const rows = accounts.map((a) => [a.code, a.name, a.is_header ? 'Group' : 'Account', CATEGORY[a.category], a.parent_code || '', a.normal_balance, a.currency || 'Any', IFRS[a.ifrs_class], a.department || '', a.cost_centre || '', a.project || '', a.tax_treatment || '', a.allow_posting ? 'Yes' : 'No', a.is_active ? 'Yes' : 'No', a.is_header ? groupNet[a.code] : a.net]);
    const blob = new Blob(['﻿', `${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `certify-chart-of-accounts-${data?.version?.version || 'V1.0'}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (user?.role !== ROLES.SUPER_ADMIN) return <div className="page-container"><p>You do not have access to this page.</p></div>;

  const balanced = data && Math.round((data.totals.debit - data.totals.credit) * 100) === 0;
  const fieldErr = (k) => errors[k] && <span className="coa__err" role="alert">{errors[k]}</span>;

  const form = (f, set, { isNew = false, isHeader = false } = {}) => (
    <div className="coa__form">
      {isNew && (
        <>
          <label className="coa__f"><span>Code</span><input value={f.code} onChange={(e) => set({ ...f, code: e.target.value })} placeholder="4 digits, for example 1115" maxLength={4} />{fieldErr('code')}</label>
          <label className="coa__f coa__f--check"><input type="checkbox" checked={f.is_header} onChange={(e) => set({ ...f, is_header: e.target.checked })} /><span>This is a group (cannot be posted to)</span></label>
        </>
      )}
      <label className="coa__f coa__f--wide"><span>Account name</span><input value={f.name} onChange={(e) => set({ ...f, name: e.target.value })} />{fieldErr('name')}</label>
      <label className="coa__f"><span>Parent account</span>
        <select value={f.parent_code} onChange={(e) => set({ ...f, parent_code: e.target.value })}>
          <option value="">{isNew ? 'Choose' : 'None (top-level group)'}</option>
          {accounts.filter((a) => a.code !== f.code && (!f.code || a.code[0] === f.code[0] || !isNew) && a.is_active).map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
        </select>{fieldErr('parent_code')}
      </label>
      <label className="coa__f"><span>Normal balance</span>
        <select value={f.normal_balance} onChange={(e) => set({ ...f, normal_balance: e.target.value })}>
          <option value="Dr">Debit (Dr)</option><option value="Cr">Credit (Cr)</option><option value="Dr/Cr">Dr or Cr, by movement</option>
        </select>{fieldErr('normal_balance')}
      </label>
      <label className="coa__f"><span>IFRS 18 class</span>
        <select value={f.ifrs_class} onChange={(e) => set({ ...f, ifrs_class: e.target.value })}>{Object.entries(IFRS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>{fieldErr('ifrs_class')}
      </label>
      <label className="coa__f"><span>Currency</span><input value={f.currency} onChange={(e) => set({ ...f, currency: e.target.value.toUpperCase() })} placeholder="Any, or USD, EUR..." maxLength={3} />{fieldErr('currency')}</label>
      {!isNew && (
        <label className="coa__f"><span>Entity</span>
          <select value={f.entity_id} onChange={(e) => set({ ...f, entity_id: e.target.value })}>
            <option value="">All entities</option>
            {(data?.entities || []).map((en) => <option key={en.id} value={en.id}>{en.code} {en.name}</option>)}
          </select>
        </label>
      )}
      {TEXT_FIELDS.map(([k, label]) => <label key={k} className="coa__f"><span>{label}</span><input value={f[k]} onChange={(e) => set({ ...f, [k]: e.target.value })} />{fieldErr(k)}</label>)}
      {!isNew && (
        <>
          <label className="coa__f coa__f--check"><input type="checkbox" checked={f.allow_posting} disabled={isHeader} onChange={(e) => set({ ...f, allow_posting: e.target.checked })} /><span>Posting allowed</span>{fieldErr('allow_posting')}</label>
          <label className="coa__f coa__f--check"><input type="checkbox" checked={f.is_active} onChange={(e) => set({ ...f, is_active: e.target.checked })} /><span>Active</span>{fieldErr('is_active')}</label>
        </>
      )}
    </div>
  );

  return (
    <div className="page-container ntf coa">
      <div className="page-header">
        <div>
          <h1 className="page-title">Chart of Accounts</h1>
          <p className="page-subtitle">Certify.cx™ Master Chart of Accounts, IFRS edition. Every account has a normal balance (Dr or Cr). Balances come from posted journals only, so until something is posted they all show 0.00.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn" onClick={exportCsv} disabled={!data}><Download size={15} /> Export CSV</button>
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => { setEdit(null); setErrors({}); setAdding({ ...EMPTY_NEW }); }}><Plus size={15} /> Add account</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      {error && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> {error}</div>}
      {notice && !error && <div className="ntf__alert ntf__alert--ok"><Check size={16} /> {notice}</div>}
      {loading && !data && <p className="ntf__muted">Loading...</p>}

      {data && (
        <>
          <section className="coa__status" aria-label="Chart status">
            <div><span className="coa__badge coa__badge--ok">{data.version?.version || 'V1.0'} active</span> <span className="ntf__muted">IFRS · multi-currency · double-entry · IFRS 18-ready</span></div>
            <div className="coa__totals">
              <span>Total debits <strong>{money(data.totals.debit)}</strong></span>
              <span>Total credits <strong>{money(data.totals.credit)}</strong></span>
              <span className={balanced ? 'coa__ok' : 'coa__bad'}>{balanced ? 'Trial balance: balanced' : 'Trial balance: OUT OF BALANCE'}</span>
            </div>
          </section>
          <p className="ntf__muted coa__note">A change to the structure of the chart is released as a new version (V1.1) and never overwrites V1.0. Account codes are never changed. Every edit is kept in the account&apos;s history. IFRS 18 classes are starting points to be validated by the finance team.</p>

          <div className="coa__chips" role="group" aria-label="Filter by category">
            <button type="button" className={`coa__chip${cat === 'all' ? ' coa__chip--on' : ''}`} onClick={() => setCat('all')}>All <em>{counts.all}</em></button>
            {Object.entries(CATEGORY).map(([k, label]) => <button key={k} type="button" className={`coa__chip${cat === k ? ' coa__chip--on' : ''}`} onClick={() => setCat(k)}>{label} <em>{counts[k] || 0}</em></button>)}
          </div>

          <div className="ntf__filters">
            <label className="ntf__search"><Search size={15} /><input type="search" placeholder="Search a code or an account name" value={q} onChange={(e) => setQ(e.target.value)} /></label>
            <select className="ntf__select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Status">
              <option value="active">Active</option><option value="inactive">Inactive</option><option value="all">All</option>
            </select>
            <label className="coa__toggle"><input type="checkbox" checked={accountsOnly} onChange={(e) => setAccountsOnly(e.target.checked)} /> Accounts only (hide groups)</label>
          </div>

          {adding && (
            <section className="ntf__panel coa__panel">
              <strong>Add an account</strong>
              <p className="ntf__muted">The category comes from the first digit of the code. Existing codes are never changed or reused.</p>
              {form(adding, setAdding, { isNew: true })}
              <div className="ntf__actions">
                <button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => save('create')}>{busy ? 'Saving...' : 'Add account'}</button>
                <button type="button" className="ntf__btn" disabled={busy} onClick={() => setAdding(null)}>Cancel</button>
              </div>
            </section>
          )}

          <div className="ntf__table-wrap">
            <table className="ntf__table coa__table">
              <thead><tr><th>Code</th><th>Account</th><th>Normal</th><th>Currency</th><th>IFRS 18 class</th><th>Status</th><th className="coa__num">Balance</th><th /></tr></thead>
              <tbody>
                {shown.map((a) => (
                  <Fragment key={a.code}>
                    <tr className={`${a.is_header ? 'coa__row--group' : ''}${a.is_active ? '' : ' coa__row--off'}`}>
                      <td className="coa__code">{a.code}</td>
                      <td style={{ paddingLeft: 12 + depth(a) * 18 }}>
                        <span className={a.is_header ? 'coa__name coa__name--group' : 'coa__name'}>{a.name}</span>
                        {a.is_contra && <span className="coa__tag">contra</span>}
                        {a.is_header && <span className="coa__tag coa__tag--group">group</span>}
                        {!a.is_header && !a.allow_posting && <span className="coa__tag">no posting</span>}
                      </td>
                      <td><span className={`coa__dr coa__dr--${a.normal_balance === 'Dr' ? 'dr' : a.normal_balance === 'Cr' ? 'cr' : 'both'}`}>{a.normal_balance}</span></td>
                      <td>{a.currency || <span className="ntf__muted">Any</span>}</td>
                      <td>{a.ifrs_class === 'none' ? <span className="ntf__muted">-</span> : IFRS[a.ifrs_class]}</td>
                      <td>{a.is_active ? 'Active' : <span className="coa__bad">Inactive</span>}</td>
                      <td className="coa__num">{balanceText(a)}</td>
                      <td className="ntf__actions">
                        <button type="button" className="ntf__btn" onClick={() => startEdit(a)} aria-label={`Edit ${a.code}`}><Pencil size={13} /></button>
                        <button type="button" className="ntf__btn" onClick={() => openHistory(a.code)} aria-label={`History of ${a.code}`}><History size={13} /></button>
                      </td>
                    </tr>
                    {edit?.code === a.code && (
                      <tr>
                        <td colSpan={8}>
                          <div className="ntf__panel coa__panel">
                            <strong>{a.code} {a.name}</strong>
                            <p className="ntf__muted">The code and the type (group or account) cannot be changed. {a.introduced_in && `Introduced in ${a.introduced_in}.`}</p>
                            {form(edit.fields, (f) => setEdit({ ...edit, fields: f }), { isHeader: a.is_header })}
                            <div className="ntf__actions">
                              <button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => save('update')}>{busy ? 'Saving...' : 'Save changes'}</button>
                              <button type="button" className="ntf__btn" disabled={busy} onClick={() => setEdit(null)}>Cancel</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    {hist?.code === a.code && (
                      <tr>
                        <td colSpan={8}>
                          <div className="ntf__panel coa__panel">
                            <div className="coa__histhead"><strong>History of {a.code} {a.name}</strong><button type="button" className="ntf__btn" onClick={() => setHist(null)}><X size={13} /> Close</button></div>
                            {hist.rows === null ? <p className="ntf__muted">Loading...</p> : hist.rows.length === 0 ? <p className="ntf__muted">No change since the account was created in {a.introduced_in || 'V1.0'}.</p> : (
                              <ul className="coa__hist">
                                {hist.rows.map((h) => (
                                  <li key={h.id}><strong>{h.action === 'create' ? 'Created' : 'Changed'}</strong> {when(h.created_at)}
                                    {h.action === 'update' && <span className="ntf__muted"> {Object.keys(h.after || {}).map((k) => `${k}: ${h.before?.[k] ?? 'empty'} to ${h.after[k] ?? 'empty'}`).join('; ')}</span>}
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="ntf__muted">{shown.length} of {accounts.length} rows shown. {counts.all} active accounts.</p>
        </>
      )}
    </div>
  );
}
