import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileCheck2, RefreshCw, Wand2 } from 'lucide-react';
import { Chip, Alerts } from './qmsUi';
import { call, useRunner } from './qmsLib';

// QMS > Overview (Super Admin): how ready the system is for an ISO 9001 audit, clause by clause.
// Readiness is worked out from the records themselves (approved documents, a completed internal audit, a held management
// review...). Nobody can tick a clause as "ready" by hand.

const NEED = {
  doc: 'An approved document', risk: 'A risk or opportunity in the register', kpi: 'A quality objective (KPI)',
  kpiData: 'A KPI with a recorded result', audit: 'A completed internal audit', review: 'A held management review',
};

export default function QmsOverview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [show, setShow] = useState('all');
  const { busy, error, notice, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { setData(await call('qms-overview')); setError(''); } catch (e) { setError(e.message || 'Could not load the QMS.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    const out = await run(() => call('qms-generate'), (o) => `${o.created} documents created as drafts${o.skipped ? `, ${o.skipped} already existed` : ''}.`);
    if (out) load();
  };

  const c = data?.counts;
  const rows = (data?.readiness || []).filter((r) => show === 'all' || (show === 'open' ? r.level !== 'ready' : r.level === 'ready'));

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">QMS overview</h1>
          <p className="page-subtitle">Audit readiness for {data?.edition || 'ISO 9001'}, worked out from your real records. A clause is ready only when the documents and records it needs exist and are approved.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={generate} disabled={busy}><Wand2 size={15} /> Generate ISO 9001 documents</button>
          <Link to="/qms/audit-pack" className="ntf__btn"><FileCheck2 size={15} /> Audit pack</Link>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error} notice={notice} />
      {loading && !data && <p className="ntf__muted">Loading...</p>}

      {data && (
        <>
          <section className="q-score">
            <div className="q-score__ring" style={{ '--p': data.percent }}><span>{data.percent}%</span></div>
            <div>
              <h2 className="ntf__h2" style={{ margin: 0 }}>{data.readiness.filter((r) => r.level === 'ready').length} of {data.readiness.length} clauses ready</h2>
              <p>The score counts every requirement of every clause. It reaches 100% only when all documents are approved and the records exist: risks, objectives with results, a completed internal audit and a held management review.</p>
              <p>{c.documents === 0 ? 'No documents yet. Use "Generate ISO 9001 documents" to create the full set as drafts, then review and approve each one.' : `${c.approved} of ${c.documents} documents approved. Generated documents are drafts until you review and approve them.`}</p>
            </div>
          </section>

          <div className="q-grid">
            <Link className="q-stat" to="/qms/documents"><b>{c.approved}/{c.documents}</b><span>Documents approved</span></Link>
            <Link className={`q-stat${c.reviewDue ? ' q-stat--bad' : ''}`} to="/qms/documents"><b>{c.reviewDue}</b><span>Documents due for review</span></Link>
            <Link className={`q-stat${c.overdueNc ? ' q-stat--bad' : ''}`} to="/qms/capa"><b>{c.openNc}</b><span>Open nonconformities{c.overdueNc ? ` (${c.overdueNc} overdue)` : ''}</span></Link>
            <Link className={`q-stat${c.overdueActions ? ' q-stat--bad' : ''}`} to="/qms/capa"><b>{c.openActions}</b><span>Open actions{c.overdueActions ? ` (${c.overdueActions} overdue)` : ''}</span></Link>
            <Link className="q-stat" to="/qms/audits"><b>{c.auditsCompleted}/{c.audits}</b><span>Internal audits completed</span></Link>
            <Link className={`q-stat${c.highRisks ? ' q-stat--bad' : ''}`} to="/qms/risks"><b>{c.risks}</b><span>Risks and opportunities{c.highRisks ? ` (${c.highRisks} high)` : ''}</span></Link>
            <Link className="q-stat" to="/qms/risks"><b>{c.kpis}</b><span>Objectives and KPIs</span></Link>
            <Link className="q-stat" to="/qms/management-review"><b>{c.reviews}</b><span>Management reviews</span></Link>
          </div>

          <div className="q-tabs">
            {[['all', 'All clauses'], ['open', 'Needs work'], ['done', 'Ready']].map(([k, t]) => (
              <button key={k} type="button" className={`q-tab${show === k ? ' q-tab--on' : ''}`} onClick={() => setShow(k)}>{t}</button>
            ))}
          </div>

          <div className="ntf__table-wrap">
            <table className="ntf__table q-table">
              <thead><tr><th>Clause</th><th>Requirement</th><th>Status</th><th>Still needed</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.no}>
                    <td className="q-no">{r.no}</td>
                    <td>{r.title}{r.documents.length > 0 && <span className="q-sub">{r.documents.join(', ')}</span>}</td>
                    <td><Chip value={r.level} /></td>
                    <td>{r.missing.length ? r.missing.map((m) => NEED[m]).join('. ') : <span className="ntf__muted">Nothing</span>}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={4} className="ntf__muted">No clauses in this view.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
