import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, Check, Plus, RefreshCw, Trash2, Undo2 } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import './AdminNotifications.css';
import './AdminChartOfAccounts.css';

// Finance ERP > Journals (Super Admin): the General Ledger.
// New entries are saved as drafts and only enter the books when they are posted (approved). A posted journal is never
// edited or deleted: a mistake is corrected with a reversal. Reports read posted entries only.

const call = (action, body = {}) => apiPost('/api/notify-event', { action, ...body });
const money = (n) => Number(n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const today = () => new Date().toISOString().slice(0, 10);
const blankLine = () => ({ account_code: '', debit: '', credit: '', memo: '', department: '', cost_centre: '', project: '' });
const STATUS = { draft: 'Draft', posted: 'Posted', reversed: 'Reversed' };
const TABS = [['journals', 'Journals'], ['new', 'New journal'], ['tb', 'Trial balance'], ['ledger', 'General ledger']];

export default function AdminJournals() {
  const { user } = useAuth();
  const [tab, setTab] = useState('journals');
  const [entities, setEntities] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('all');
  const [fEntity, setFEntity] = useState('');
  const [open, setOpen] = useState(null); // { id, entry, lines }

  const [form, setForm] = useState({ entity_id: '', entry_date: today(), description: '', currency: 'USD', fx_rate: '1', lines: [blankLine(), blankLine()] });
  const [errs, setErrs] = useState([]);
  const [tpl, setTpl] = useState({ template: 'marketplace', amount: '1000', cbShare: '800', kind: 'receipt', revenueAccount: '4201' });

  const [tbEntity, setTbEntity] = useState('');
  const [tbDate, setTbDate] = useState(today());
  const [tb, setTb] = useState(null);
  const [ledgerCode, setLedgerCode] = useState('');
  const [ledger, setLedger] = useState(null);

  const postable = useMemo(() => accounts.filter((a) => !a.is_header && a.allow_posting && a.is_active), [accounts]);
  const nameOf = useMemo(() => Object.fromEntries(accounts.map((a) => [a.code, a.name])), [accounts]);

  const loadEntries = useCallback(async () => {
    setLoading(true);
    try {
      const out = await call('gl-list', { status: fStatus === 'all' ? undefined : fStatus, entity_id: fEntity || undefined });
      setEntries(out.entries);
      setEntities(out.entities);
      setForm((f) => (f.entity_id || !out.entities[0] ? f : { ...f, entity_id: out.entities[0].id }));
      setTbEntity((t) => t || out.entities[0]?.id || '');
    } catch (e) { setError(e.message || 'Could not load the journals.'); } finally { setLoading(false); }
  }, [fStatus, fEntity]);
  useEffect(() => { loadEntries(); }, [loadEntries]);
  useEffect(() => { call('coa-list').then((o) => setAccounts(o.accounts)).catch((e) => setError(e.message)); }, []);

  const run = async (fn, okMsg) => {
    setBusy(true); setError(''); setNotice('');
    try { const out = await fn(); if (okMsg) setNotice(typeof okMsg === 'function' ? okMsg(out) : okMsg); return out; } catch (e) { setError(e.message || 'That did not work.'); return null; } finally { setBusy(false); }
  };

  const openEntry = async (id) => {
    if (open?.id === id) { setOpen(null); return; }
    setOpen({ id });
    const out = await run(() => call('gl-get', { id }));
    if (out) setOpen({ id, ...out });
  };

  const setLine = (i, patch) => setForm((f) => ({ ...f, lines: f.lines.map((l, j) => (j === i ? { ...l, ...patch } : l)) }));
  const sumD = form.lines.reduce((s, l) => s + Number(l.debit || 0), 0);
  const sumC = form.lines.reduce((s, l) => s + Number(l.credit || 0), 0);
  const balanced = Math.round(sumD * 100) === Math.round(sumC * 100) && sumD > 0;

  const applyTemplate = async () => {
    const params = tpl.template === 'marketplace' ? { amount: Number(tpl.amount), cbShare: Number(tpl.cbShare) } : { kind: tpl.kind, amount: Number(tpl.amount), revenueAccount: tpl.revenueAccount };
    const out = await run(() => call('gl-template', { template: tpl.template, params }));
    if (!out) return;
    if (out.ok === false) { setErrs(out.errors); return; }
    setErrs([]);
    setForm((f) => ({ ...f, description: out.description, currency: 'USD', fx_rate: '1', lines: out.lines.map((l) => ({ ...blankLine(), account_code: l.account_code, debit: l.debit || '', credit: l.credit || '', memo: l.memo })) }));
  };

  const submit = async (postNow) => {
    setErrs([]);
    const out = await run(() => call('gl-create', { post: postNow, entry: { ...form, lines: form.lines.map((l) => ({ ...l, debit: Number(l.debit || 0), credit: Number(l.credit || 0) })) } }));
    if (!out) return;
    if (out.ok === false) { setErrs(out.errors); return; }
    setNotice(`${out.reference} ${out.posted ? 'posted' : 'saved as a draft'}.`);
    setForm((f) => ({ ...f, description: '', lines: [blankLine(), blankLine()] }));
    setTab('journals');
    loadEntries();
  };

  const postEntry = async (e) => { if (await run(() => call('gl-post', { id: e.id }), `${e.reference} posted.`)) { setOpen(null); loadEntries(); } };
  const delDraft = async (e) => { if (await run(() => call('gl-delete-draft', { id: e.id }), `Draft ${e.reference} deleted.`)) { setOpen(null); loadEntries(); } };
  const reverse = async (e) => {
    const reason = window.prompt(`Reverse ${e.reference}? A new journal that undoes it will be posted. Reason (optional):`, '');
    if (reason === null) return;
    if (await run(() => call('gl-reverse', { id: e.id, reason }), (o) => `${e.reference} reversed by ${o.reference}.`)) { setOpen(null); loadEntries(); }
  };

  const loadTb = async () => { const out = await run(() => call('gl-trial-balance', { entity_id: tbEntity || undefined, as_of: tbDate })); if (out) setTb(out); };
  const loadLedger = async () => { if (!ledgerCode) return; const out = await run(() => call('gl-ledger', { code: ledgerCode, entity_id: tbEntity || undefined, as_of: tbDate })); if (out) setLedger(out.rows); };

  if (user?.role !== ROLES.SUPER_ADMIN) return <div className="page-container"><p>You do not have access to this page.</p></div>;

  const entName = (id) => entities.find((e) => e.id === id)?.code || '';
  const tbRows = (tb?.rows || []).slice().sort((a, b) => a.code.localeCompare(b.code));
  const tbD = tbRows.reduce((s, r) => s + r.debit, 0);
  const tbC = tbRows.reduce((s, r) => s + r.credit, 0);

  return (
    <div className="page-container ntf coa">
      <div className="page-header">
        <div>
          <h1 className="page-title">Journals and ledger</h1>
          <p className="page-subtitle">Every journal is double-entry and has a unique reference. A draft only enters the books when it is posted. A posted journal is never edited or deleted: it is corrected with a reversal.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn" onClick={loadEntries} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setTab('new')}><Plus size={15} /> New journal</button>
        </div>
      </div>

      {error && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> {error}</div>}
      {notice && !error && <div className="ntf__alert ntf__alert--ok"><Check size={16} /> {notice}</div>}

      <div className="coa__chips" role="tablist">
        {TABS.map(([k, label]) => <button key={k} type="button" role="tab" aria-selected={tab === k} className={`coa__chip${tab === k ? ' coa__chip--on' : ''}`} onClick={() => setTab(k)}>{label}</button>)}
      </div>

      {tab === 'journals' && (
        <>
          <div className="ntf__filters">
            <select className="ntf__select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status">
              <option value="all">All statuses</option><option value="draft">Draft</option><option value="posted">Posted</option><option value="reversed">Reversed</option>
            </select>
            <select className="ntf__select" value={fEntity} onChange={(e) => setFEntity(e.target.value)} aria-label="Entity">
              <option value="">All entities</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.code} {e.name}</option>)}
            </select>
          </div>
          <div className="ntf__table-wrap">
            <table className="ntf__table coa__table">
              <thead><tr><th>Reference</th><th>Date</th><th>Entity</th><th>Description</th><th>Status</th><th className="coa__num">Debit</th><th className="coa__num">Credit</th><th /></tr></thead>
              <tbody>
                {entries.length === 0 && <tr><td colSpan={8} className="ntf__muted">{loading ? 'Loading...' : 'No journals yet. All account balances are 0.00 until the first journal is posted.'}</td></tr>}
                {entries.map((e) => (
                  <Fragment key={e.id}>
                    <tr className={e.status === 'reversed' ? 'coa__row--off' : ''}>
                      <td className="coa__code">{e.reference}</td>
                      <td>{e.entry_date}</td>
                      <td>{entName(e.entity_id)}</td>
                      <td>{e.description || ''}{e.source && e.source !== 'manual' && <span className="coa__tag">{e.source}</span>}</td>
                      <td><span className={`coa__dr coa__dr--${e.status === 'posted' ? 'dr' : e.status === 'draft' ? 'both' : 'cr'}`}>{STATUS[e.status]}</span></td>
                      <td className="coa__num">{money(e.debit)}</td>
                      <td className="coa__num">{money(e.credit)}</td>
                      <td><button type="button" className="ntf__btn" onClick={() => openEntry(e.id)}>{open?.id === e.id ? 'Close' : 'Open'}</button></td>
                    </tr>
                    {open?.id === e.id && (
                      <tr><td colSpan={8}>
                        <div className="ntf__panel coa__panel">
                          {!open.lines ? <p className="ntf__muted">Loading...</p> : (
                            <>
                              <table className="ntf__table">
                                <thead><tr><th>Account</th><th>Memo</th><th className="coa__num">Debit</th><th className="coa__num">Credit</th></tr></thead>
                                <tbody>{open.lines.map((l) => <tr key={l.id}><td>{l.account_code} {nameOf[l.account_code]}</td><td>{l.memo || ''}</td><td className="coa__num">{Number(l.debit) ? money(l.debit) : ''}</td><td className="coa__num">{Number(l.credit) ? money(l.credit) : ''}</td></tr>)}</tbody>
                              </table>
                              <p className="ntf__muted">Currency {open.entry.currency}{open.lines[0] && Number(open.lines[0].fx_rate) !== 1 ? ` at ${open.lines[0].fx_rate}` : ''}. Created {new Date(open.entry.created_at).toLocaleString('en-GB')}{open.entry.posted_at ? `, posted ${new Date(open.entry.posted_at).toLocaleString('en-GB')}` : ''}.{open.entry.reverses_id ? ' This journal reverses an earlier one.' : ''}</p>
                              <div className="ntf__actions">
                                {e.status === 'draft' && <button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => postEntry(e)}><Check size={14} /> Approve and post</button>}
                                {e.status === 'draft' && <button type="button" className="ntf__btn" disabled={busy} onClick={() => delDraft(e)}><Trash2 size={14} /> Delete draft</button>}
                                {e.status === 'posted' && <button type="button" className="ntf__btn" disabled={busy} onClick={() => reverse(e)}><Undo2 size={14} /> Reverse</button>}
                              </div>
                            </>
                          )}
                        </div>
                      </td></tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'new' && (
        <section className="ntf__panel coa__panel">
          <strong>Start from a template (optional)</strong>
          <div className="coa__form">
            <label className="coa__f"><span>Template</span>
              <select value={tpl.template} onChange={(e) => setTpl({ ...tpl, template: e.target.value })}>
                <option value="marketplace">Marketplace payment (certification body and commission)</option>
                <option value="subscription">Subscription (deferred revenue)</option>
              </select>
            </label>
            <label className="coa__f"><span>{tpl.template === 'marketplace' ? 'Customer paid' : 'Amount'}</span><input type="number" min="0" step="0.01" value={tpl.amount} onChange={(e) => setTpl({ ...tpl, amount: e.target.value })} /></label>
            {tpl.template === 'marketplace' ? (
              <label className="coa__f"><span>Payable to the certification body</span><input type="number" min="0" step="0.01" value={tpl.cbShare} onChange={(e) => setTpl({ ...tpl, cbShare: e.target.value })} /></label>
            ) : (
              <>
                <label className="coa__f"><span>Step</span>
                  <select value={tpl.kind} onChange={(e) => setTpl({ ...tpl, kind: e.target.value })}><option value="receipt">Received in advance (deferred)</option><option value="recognition">Monthly recognition (revenue)</option></select>
                </label>
                {tpl.kind === 'recognition' && (
                  <label className="coa__f"><span>Revenue account</span>
                    <select value={tpl.revenueAccount} onChange={(e) => setTpl({ ...tpl, revenueAccount: e.target.value })}>
                      {postable.filter((a) => a.code >= '4200' && a.code < '4300').map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}
                    </select>
                  </label>
                )}
              </>
            )}
          </div>
          <div className="ntf__actions"><button type="button" className="ntf__btn" disabled={busy} onClick={applyTemplate}>Fill the lines</button></div>

          <strong>Journal</strong>
          <div className="coa__form">
            <label className="coa__f"><span>Legal entity</span>
              <select value={form.entity_id} onChange={(e) => setForm({ ...form, entity_id: e.target.value })}>{entities.map((e) => <option key={e.id} value={e.id}>{e.code} {e.name}</option>)}</select>
            </label>
            <label className="coa__f"><span>Date</span><input type="date" value={form.entry_date} onChange={(e) => setForm({ ...form, entry_date: e.target.value })} /></label>
            <label className="coa__f"><span>Currency</span><input value={form.currency} maxLength={3} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })} /></label>
            <label className="coa__f"><span>Rate to {entities.find((e) => e.id === form.entity_id)?.base_currency || 'USD'}</span><input type="number" min="0" step="0.00000001" value={form.fx_rate} onChange={(e) => setForm({ ...form, fx_rate: e.target.value })} /></label>
            <label className="coa__f coa__f--wide"><span>Description</span><input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          </div>

          <div className="ntf__table-wrap">
            <table className="ntf__table">
              <thead><tr><th>Account</th><th>Memo</th><th>Department</th><th>Cost centre</th><th>Project</th><th className="coa__num">Debit</th><th className="coa__num">Credit</th><th /></tr></thead>
              <tbody>
                {form.lines.map((l, i) => (
                  <tr key={i}>
                    <td><select value={l.account_code} onChange={(e) => setLine(i, { account_code: e.target.value })} aria-label={`Account, line ${i + 1}`}>
                      <option value="">Choose</option>{postable.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name} ({a.normal_balance})</option>)}
                    </select></td>
                    <td><input value={l.memo} onChange={(e) => setLine(i, { memo: e.target.value })} aria-label={`Memo, line ${i + 1}`} /></td>
                    <td><input value={l.department} onChange={(e) => setLine(i, { department: e.target.value })} aria-label={`Department, line ${i + 1}`} /></td>
                    <td><input value={l.cost_centre} onChange={(e) => setLine(i, { cost_centre: e.target.value })} aria-label={`Cost centre, line ${i + 1}`} /></td>
                    <td><input value={l.project} onChange={(e) => setLine(i, { project: e.target.value })} aria-label={`Project, line ${i + 1}`} /></td>
                    <td><input className="coa__num" type="number" min="0" step="0.01" value={l.debit} onChange={(e) => setLine(i, { debit: e.target.value, credit: e.target.value ? '' : l.credit })} aria-label={`Debit, line ${i + 1}`} /></td>
                    <td><input className="coa__num" type="number" min="0" step="0.01" value={l.credit} onChange={(e) => setLine(i, { credit: e.target.value, debit: e.target.value ? '' : l.debit })} aria-label={`Credit, line ${i + 1}`} /></td>
                    <td>{form.lines.length > 2 && <button type="button" className="ntf__btn" onClick={() => setForm({ ...form, lines: form.lines.filter((_, j) => j !== i) })} aria-label={`Remove line ${i + 1}`}><Trash2 size={13} /></button>}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr><td colSpan={5}><button type="button" className="ntf__btn" onClick={() => setForm({ ...form, lines: [...form.lines, blankLine()] })}><Plus size={13} /> Add line</button></td>
                <td className="coa__num"><strong>{money(sumD)}</strong></td><td className="coa__num"><strong>{money(sumC)}</strong></td><td /></tr></tfoot>
            </table>
          </div>
          <p className={balanced ? 'coa__ok' : 'coa__bad'}>{balanced ? 'Balanced: debits equal credits.' : `Not balanced yet. Difference ${money(Math.abs(sumD - sumC))}.`}</p>
          {errs.length > 0 && <ul className="coa__err" role="alert">{errs.map((e) => <li key={e}>{e}</li>)}</ul>}
          <div className="ntf__actions">
            <button type="button" className="ntf__btn" disabled={busy} onClick={() => submit(false)}>Save as draft</button>
            <button type="button" className="ntf__btn ntf__btn--primary" disabled={busy || !balanced} onClick={() => submit(true)}>Save and post</button>
          </div>
        </section>
      )}

      {(tab === 'tb' || tab === 'ledger') && (
        <>
          <div className="ntf__filters">
            <select className="ntf__select" value={tbEntity} onChange={(e) => setTbEntity(e.target.value)} aria-label="Entity"><option value="">All entities</option>{entities.map((e) => <option key={e.id} value={e.id}>{e.code} {e.name}</option>)}</select>
            <label className="coa__toggle">As of <input type="date" value={tbDate} onChange={(e) => setTbDate(e.target.value)} /></label>
            {tab === 'ledger' && (
              <select className="ntf__select" value={ledgerCode} onChange={(e) => setLedgerCode(e.target.value)} aria-label="Account"><option value="">Choose an account</option>{postable.map((a) => <option key={a.code} value={a.code}>{a.code} {a.name}</option>)}</select>
            )}
            <button type="button" className="ntf__btn ntf__btn--primary" disabled={busy || (tab === 'ledger' && !ledgerCode)} onClick={tab === 'tb' ? loadTb : loadLedger}>Run report</button>
          </div>

          {tab === 'tb' && tb && (
            <div className="ntf__table-wrap">
              <table className="ntf__table coa__table">
                <thead><tr><th>Code</th><th>Account</th><th className="coa__num">Debit</th><th className="coa__num">Credit</th></tr></thead>
                <tbody>
                  {tbRows.length === 0 && <tr><td colSpan={4} className="ntf__muted">Nothing posted yet. Every balance is 0.00.</td></tr>}
                  {tbRows.map((r) => { const net = r.debit - r.credit; return <tr key={r.code}><td className="coa__code">{r.code}</td><td>{nameOf[r.code]}</td><td className="coa__num">{net > 0 ? money(net) : ''}</td><td className="coa__num">{net < 0 ? money(-net) : ''}</td></tr>; })}
                </tbody>
                <tfoot><tr><td colSpan={2}><strong>Total</strong> ({tb.entries} posted journals)</td><td className="coa__num"><strong>{money(tbRows.reduce((s, r) => s + Math.max(0, r.debit - r.credit), 0))}</strong></td><td className="coa__num"><strong>{money(tbRows.reduce((s, r) => s + Math.max(0, r.credit - r.debit), 0))}</strong></td></tr></tfoot>
              </table>
              <p className={Math.round((tbD - tbC) * 100) === 0 ? 'coa__ok' : 'coa__bad'}>{Math.round((tbD - tbC) * 100) === 0 ? 'The trial balance is balanced.' : 'The trial balance is OUT OF BALANCE.'}</p>
            </div>
          )}

          {tab === 'ledger' && ledger && (
            <div className="ntf__table-wrap">
              <table className="ntf__table coa__table">
                <thead><tr><th>Date</th><th>Reference</th><th>Description</th><th className="coa__num">Debit</th><th className="coa__num">Credit</th><th className="coa__num">Balance (Dr positive)</th></tr></thead>
                <tbody>
                  {ledger.length === 0 && <tr><td colSpan={6} className="ntf__muted">No posted lines on this account.</td></tr>}
                  {ledger.map((r, i) => <tr key={`${r.reference}-${i}`}><td>{r.entry_date}</td><td className="coa__code">{r.reference}</td><td>{r.memo || r.description || ''}</td><td className="coa__num">{r.debit ? money(r.debit) : ''}</td><td className="coa__num">{r.credit ? money(r.credit) : ''}</td><td className="coa__num">{money(r.running)}</td></tr>)}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
