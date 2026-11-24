import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Download, Printer, RefreshCw } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import '../admin/AdminNotifications.css';
import './FinancialStatements.css';

// Finance ERP > Financial Statements (Super Admin).
// Statement of profit or loss (IFRS 18 categories) for a period, and the statement of financial position at its end date,
// both built from POSTED journals only. Nothing is typed in here, so the statements always agree with the ledger.

const call = (action, body = {}) => apiPost('/api/notify-event', { action, ...body });
const today = () => new Date().toISOString().slice(0, 10);
const money = (n) => {
  const v = Math.abs(Number(n || 0)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return Number(n) < 0 ? `(${v})` : v;
};
const TABS = [['pnl', 'Profit or loss'], ['position', 'Financial position']];

function Row({ code, name, amount, total, sub, strong }) {
  return (
    <tr className={`fs__row${total ? ' fs__row--total' : ''}${strong ? ' fs__row--strong' : ''}${sub ? ' fs__row--sub' : ''}`}>
      <td className="fs__code">{code}</td><td>{name}</td><td className="fs__num">{amount === null ? '' : money(amount)}</td>
    </tr>
  );
}

function Block({ title, s }) {
  if (!s || !s.lines.length) return null;
  return (
    <>
      {title && <tr className="fs__head"><td colSpan={3}>{title}</td></tr>}
      {s.lines.map((l) => <Row key={l.code} code={l.code} name={l.name} amount={l.amount} sub />)}
      <Row name={`Total ${title ? title.toLowerCase() : ''}`.trim()} amount={s.total} total />
    </>
  );
}

export default function FinancialStatements() {
  const [tab, setTab] = useState('pnl');
  const [entities, setEntities] = useState([]);
  const [entity, setEntity] = useState('');
  const [from, setFrom] = useState(`${today().slice(0, 4)}-01-01`);
  const [to, setTo] = useState(today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => { call('gl-list').then((o) => setEntities(o.entities || [])).catch(() => {}); }, []);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const out = await call('gl-statements', { entity_id: entity || undefined, from, to });
      if (out.ok === false) { setError(out.errors?.from || 'Check the dates.'); setData(null); } else setData(out);
    } catch (e) { setError(e.message || 'Could not build the statements.'); } finally { setLoading(false); }
  }, [entity, from, to]);
  useEffect(() => { load(); }, [load]);

  const entityName = entities.find((e) => e.id === entity);

  const exportCsv = () => {
    if (!data) return;
    const rows = [['Statement', 'Code', 'Line', 'Amount']];
    const add = (st, s) => s?.lines?.forEach((l) => rows.push([st, l.code, l.name, l.amount]));
    const p = data.pnl;
    add('Revenue', p.revenue); add('Cost of revenue', p.costOfRevenue); rows.push(['Profit or loss', '', 'Gross profit', p.grossProfit]);
    add('Operating expenses', p.operatingExpenses); add('Other operating items', p.operatingOther); rows.push(['Profit or loss', '', 'Operating profit', p.operatingProfit]);
    add('Investing', p.investing); add('Financing', p.financing); rows.push(['Profit or loss', '', 'Profit before tax', p.profitBeforeTax]);
    add('Income tax', p.incomeTax); add('Discontinued', p.discontinued); rows.push(['Profit or loss', '', 'Profit for the period', p.profit]);
    add('OCI', p.oci); rows.push(['Profit or loss', '', 'Total comprehensive income', p.totalComprehensive]);
    data.position.assets.groups.forEach((g) => g.lines.forEach((l) => rows.push(['Assets', l.code, l.name, l.amount])));
    rows.push(['Financial position', '', 'Total assets', data.position.assets.total]);
    data.position.liabilities.groups.forEach((g) => g.lines.forEach((l) => rows.push(['Liabilities', l.code, l.name, l.amount])));
    rows.push(['Financial position', '', 'Total liabilities', data.position.liabilities.total]);
    data.position.equity.lines.forEach((l) => rows.push(['Equity', l.code, l.name, l.amount]));
    rows.push(['Financial position', '', 'Total equity', data.position.equity.total]);
    const csv = rows.map((r) => r.map((c) => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob(['﻿', csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url; a.download = `financial-statements-${data.period.from}-to-${data.period.to}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const p = data?.pnl;
  const pos = data?.position;

  return (
    <div className="page-container ntf fs">
      <div className="page-header fs__noprint">
        <div>
          <h1 className="page-title">Financial statements</h1>
          <p className="page-subtitle">Profit or loss (IFRS 18 categories) and the statement of financial position, built from posted journals only. Nothing is typed in here, so the statements always agree with the ledger.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn" onClick={exportCsv} disabled={!data}><Download size={15} /> Export CSV</button>
          <button type="button" className="ntf__btn" onClick={() => window.print()} disabled={!data}><Printer size={15} /> Print or PDF</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <div className="ntf__filters fs__noprint">
        <select className="ntf__select" value={entity} onChange={(e) => setEntity(e.target.value)} aria-label="Entity">
          <option value="">All entities</option>
          {entities.map((e) => <option key={e.id} value={e.id}>{e.code} {e.name}</option>)}
        </select>
        <label className="fs__date">From <input type="date" value={from} max={to} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="fs__date">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
      </div>

      <div className="fs__tabs fs__noprint">{TABS.map(([k, t]) => <button key={k} type="button" className={`fs__tab${tab === k ? ' fs__tab--on' : ''}`} onClick={() => setTab(k)}>{t}</button>)}</div>

      {error && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> {error}</div>}
      {loading && !data && <p className="ntf__muted">Building...</p>}

      {data && (
        <>
          {data.warnings.length > 0 && <div className="ntf__alert ntf__alert--bad fs__noprint"><AlertCircle size={16} /> {data.warnings.join(' ')}</div>}
          <div className="fs__title">
            <h2>{tab === 'pnl' ? 'Statement of profit or loss' : 'Statement of financial position'}</h2>
            <p>{entityName ? `${entityName.code} ${entityName.name}` : 'All entities'}. {tab === 'pnl' ? `For the period ${data.period.from} to ${data.period.to}.` : `As at ${data.period.to}.`} Amounts in the entity base currency. {data.entries} posted journals included.</p>
          </div>

          {tab === 'pnl' && (
            <div className="ntf__table-wrap">
              <table className="ntf__table fs__table">
                <tbody>
                  <Block title="Revenue" s={p.revenue} />
                  <Block title="Cost of revenue" s={p.costOfRevenue} />
                  <Row name="Gross profit" amount={p.grossProfit} total strong />
                  <Block title="Operating expenses" s={p.operatingExpenses} />
                  <Block title="Other operating items" s={p.operatingOther} />
                  <Row name="Operating profit" amount={p.operatingProfit} total strong />
                  <Block title="Investing category" s={p.investing} />
                  <Block title="Financing category" s={p.financing} />
                  <Row name="Profit before income tax" amount={p.profitBeforeTax} total strong />
                  <Block title="Income tax" s={p.incomeTax} />
                  <Row name="Profit from continuing operations" amount={p.profitContinuing} total />
                  <Block title="Discontinued operations" s={p.discontinued} />
                  <Row name="Profit for the period" amount={p.profit} total strong />
                  <Block title="Other comprehensive income" s={p.oci} />
                  <Row name="Total comprehensive income" amount={p.totalComprehensive} total strong />
                </tbody>
              </table>
            </div>
          )}

          {tab === 'position' && (
            <>
              <div className={`fs__check fs__noprint ${pos.balanced ? 'fs__check--ok' : 'fs__check--bad'}`}>
                {pos.balanced ? <><Check size={15} /> Balanced: total assets equal total liabilities and equity.</> : <><AlertCircle size={15} /> Out of balance by {money(pos.difference)}. Check the trial balance.</>}
              </div>
              <div className="ntf__table-wrap">
                <table className="ntf__table fs__table">
                  <tbody>
                    <tr className="fs__head fs__head--big"><td colSpan={3}>Assets</td></tr>
                    {pos.assets.groups.map((g) => (
                      <FragmentGroup key={g.code} g={g} />
                    ))}
                    <Row name="Total assets" amount={pos.assets.total} total strong />

                    <tr className="fs__head fs__head--big"><td colSpan={3}>Liabilities</td></tr>
                    {pos.liabilities.groups.map((g) => (
                      <FragmentGroup key={g.code} g={g} />
                    ))}
                    <Row name="Total liabilities" amount={pos.liabilities.total} total strong />

                    <tr className="fs__head fs__head--big"><td colSpan={3}>Equity</td></tr>
                    {pos.equity.lines.map((l) => <Row key={l.code} code={/^\d/.test(l.code) ? l.code : ''} name={l.name} amount={l.amount} sub />)}
                    <Row name="Total equity" amount={pos.equity.total} total strong />
                    <Row name="Total liabilities and equity" amount={pos.totalLiabilitiesAndEquity} total strong />
                  </tbody>
                </table>
              </div>
              <p className="ntf__muted fs__note">There are no year-end closing entries yet, so the result of the period is shown in equity as "Result not yet closed to retained earnings".</p>
            </>
          )}
        </>
      )}
    </div>
  );
}

function FragmentGroup({ g }) {
  return (
    <>
      <tr className="fs__head"><td colSpan={3}>{g.name}</td></tr>
      {g.lines.map((l) => <Row key={l.code} code={l.code} name={l.name} amount={l.amount} sub />)}
      <Row name={`Total ${g.name.toLowerCase()}`} amount={g.total} total />
    </>
  );
}
