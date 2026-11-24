import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select, ClauseSelect } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label } from './qmsLib';

// QMS > Risks & Objectives (Super Admin): the risk and opportunity register (clause 6.1) and the quality objectives with
// their results (clauses 6.2 and 9.1). The score is likelihood x impact (1 to 25): 15 and above is high, 8 to 14 medium.

const level = (s) => (s >= 15 ? 'high' : s >= 8 ? 'medium' : 'low');
const EMPTY_R = { kind: 'risk', title: '', description: '', clause: '', likelihood: 3, impact: 3, treatment: '', owner_name: '', status: 'open', review_date: '' };
const EMPTY_K = { name: '', period: '', unit: '', direction: 'higher', target: '', actual: '', owner_name: '', notes: '' };
const kpiMet = (k) => (k.target == null || k.actual == null ? null : k.direction === 'lower' ? Number(k.actual) <= Number(k.target) : Number(k.actual) >= Number(k.target));

export default function QmsRisks() {
  const [tab, setTab] = useState('risks');
  const [risks, setRisks] = useState([]);
  const [kpis, setKpis] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(null); // { entity, id?, record }
  const [trail, setTrail] = useState([]);
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, k] = await Promise.all([call('qms-list', { entity: 'risk' }), call('qms-list', { entity: 'kpi' })]);
      setRisks(r.rows); setKpis(k.rows); setError('');
    } catch (e) { setError(e.message || 'Could not load the register.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const openRisk = async (r) => {
    const out = await run(() => call('qms-get', { entity: 'risk', id: r.id }));
    if (!out) return;
    setTrail(out.trail);
    setForm({ entity: 'risk', id: r.id, record: { kind: r.kind, title: r.title, description: r.description || '', clause: r.clause || '', likelihood: r.likelihood, impact: r.impact, treatment: r.treatment || '', owner_name: r.owner_name || '', status: r.status, review_date: r.review_date || '' } });
  };
  const openKpi = (k) => { setTrail([]); setForm({ entity: 'kpi', id: k.id, record: { name: k.name, period: k.period, unit: k.unit || '', direction: k.direction, target: k.target ?? '', actual: k.actual ?? '', owner_name: k.owner_name || '', notes: k.notes || '' } }); };

  const save = async () => {
    const out = await run(() => call('qms-save', { entity: form.entity, id: form.id, record: form.record }), 'Saved.');
    if (out) { setForm(null); load(); }
  };
  const set = (patch) => setForm((f) => ({ ...f, record: { ...f.record, ...patch } }));
  const rec = form?.record;
  const score = rec ? Number(rec.likelihood) * Number(rec.impact) : 0;

  const matrix = Array.from({ length: 5 }, (_, i) => 5 - i).map((imp) => Array.from({ length: 5 }, (_, j) => j + 1).map((lik) => risks.filter((r) => r.status !== 'closed' && r.impact === imp && r.likelihood === lik).length));
  const tone = (imp, lik) => { const s = imp * lik; return s >= 15 ? 'rgba(239,68,68,.28)' : s >= 8 ? 'rgba(224,161,0,.25)' : 'rgba(62,207,142,.2)'; };

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Risks & objectives</h1>
          <p className="page-subtitle">The risk and opportunity register, and the quality objectives (KPIs) with their results. Both are inputs to the management review.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => { setTrail([]); setForm(tab === 'risks' ? { entity: 'risk', record: { ...EMPTY_R } } : { entity: 'kpi', record: { ...EMPTY_K } }); }}><Plus size={15} /> {tab === 'risks' ? 'Add risk or opportunity' : 'Add KPI result'}</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !form ? error : ''} notice={notice && !form ? notice : ''} />

      <div className="q-tabs">
        <button type="button" className={`q-tab${tab === 'risks' ? ' q-tab--on' : ''}`} onClick={() => setTab('risks')}>Risk and opportunity register</button>
        <button type="button" className={`q-tab${tab === 'kpis' ? ' q-tab--on' : ''}`} onClick={() => setTab('kpis')}>Objectives and KPIs</button>
      </div>

      {tab === 'risks' && (
        <>
          <div className="q-box" style={{ marginBottom: 16 }}>
            <h3>Heat map of open items (likelihood across, impact up)</h3>
            <div className="q-matrix">
              {matrix.flatMap((row, i) => row.map((n, j) => <div key={`${i}-${j}`} style={{ background: tone(5 - i, j + 1) }}>{n || ''}</div>))}
            </div>
          </div>
          <div className="ntf__table-wrap">
            <table className="ntf__table q-table">
              <thead><tr><th>Number</th><th>Type</th><th>Title</th><th>Clause</th><th>Score</th><th>Owner</th><th>Status</th><th>Review</th></tr></thead>
              <tbody>
                {risks.length === 0 && <tr><td colSpan={8} className="ntf__muted">{loading ? 'Loading...' : 'No entries yet. Clause 6.1 needs at least one.'}</td></tr>}
                {risks.map((r) => (
                  <tr key={r.id} className="q-click" onClick={() => openRisk(r)}>
                    <td className="q-no">{r.risk_no}</td><td>{label(r.kind)}</td><td>{r.title}</td><td>{r.clause}</td>
                    <td><Chip value={level(r.score)} text={`${r.score} ${level(r.score)}`} /></td><td>{r.owner_name}</td><td><Chip value={r.status} /></td><td>{fmtDate(r.review_date)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'kpis' && (
        <div className="ntf__table-wrap">
          <table className="ntf__table q-table">
            <thead><tr><th>Objective / KPI</th><th>Period</th><th>Target</th><th>Actual</th><th>Result</th><th>Owner</th></tr></thead>
            <tbody>
              {kpis.length === 0 && <tr><td colSpan={6} className="ntf__muted">{loading ? 'Loading...' : 'No KPIs yet. Clause 6.2 needs an objective and clause 9.1 needs a result.'}</td></tr>}
              {kpis.map((k) => {
                const m = kpiMet(k);
                return (
                  <tr key={k.id} className="q-click" onClick={() => openKpi(k)}>
                    <td>{k.name}</td><td>{k.period}</td><td>{k.direction === 'lower' ? '≤ ' : '≥ '}{k.target ?? ''} {k.unit}</td><td>{k.actual ?? ''} {k.actual != null ? k.unit : ''}</td>
                    <td>{m === null ? <span className="ntf__muted">No result yet</span> : <Chip value={m ? 'ready' : 'none'} text={m ? 'Met' : 'Not met'} />}</td><td>{k.owner_name}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {form && (
        <Panel title={form.entity === 'risk' ? (form.id ? 'Risk or opportunity' : 'Add risk or opportunity') : (form.id ? 'KPI result' : 'Add KPI result')} onClose={() => { setForm(null); setError(''); }}>
          <Alerts error={error} />
          {form.entity === 'risk' ? (
            <div className="q-form">
              <Field label="Type"><Select value={rec.kind} onChange={(v) => set({ kind: v })} options={['risk', 'opportunity']} /></Field>
              <Field label="Status"><Select value={rec.status} onChange={(v) => set({ status: v })} options={['open', 'mitigating', 'accepted', 'closed']} /></Field>
              <Field label="Title" error={errors.title} wide><input className="q-input" value={rec.title} onChange={(e) => set({ title: e.target.value })} /></Field>
              <Field label="Likelihood (1 to 5)" error={errors.likelihood}><Select value={rec.likelihood} onChange={(v) => set({ likelihood: Number(v) })} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} /></Field>
              <Field label="Impact (1 to 5)" error={errors.impact}><Select value={rec.impact} onChange={(v) => set({ impact: Number(v) })} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} /></Field>
              <Field label="Score" wide><Chip value={level(score)} text={`${score}: ${level(score)}`} /></Field>
              <Field label="Clause"><ClauseSelect value={rec.clause} onChange={(v) => set({ clause: v })} /></Field>
              <Field label="Review date" error={errors.review_date}><input className="q-input" type="date" value={rec.review_date} onChange={(e) => set({ review_date: e.target.value })} /></Field>
              <Field label="Owner" wide><input className="q-input" value={rec.owner_name} onChange={(e) => set({ owner_name: e.target.value })} /></Field>
              <Field label="Description" wide><textarea className="q-input" value={rec.description} onChange={(e) => set({ description: e.target.value })} /></Field>
              <Field label="Treatment (what will be done)" wide><textarea className="q-input" value={rec.treatment} onChange={(e) => set({ treatment: e.target.value })} /></Field>
            </div>
          ) : (
            <div className="q-form">
              <Field label="Objective / KPI" error={errors.name} wide><input className="q-input" value={rec.name} onChange={(e) => set({ name: e.target.value })} placeholder="For example: Certificates delivered on time" /></Field>
              <Field label="Period" error={errors.period}><input className="q-input" value={rec.period} onChange={(e) => set({ period: e.target.value })} placeholder="2026-Q4" /></Field>
              <Field label="Unit"><input className="q-input" value={rec.unit} onChange={(e) => set({ unit: e.target.value })} placeholder="%" /></Field>
              <Field label="Better when"><Select value={rec.direction} onChange={(v) => set({ direction: v })} options={[['higher', 'Higher is better'], ['lower', 'Lower is better']]} /></Field>
              <Field label="Target" error={errors.target}><input className="q-input" type="number" step="any" value={rec.target} onChange={(e) => set({ target: e.target.value })} /></Field>
              <Field label="Actual result" error={errors.actual}><input className="q-input" type="number" step="any" value={rec.actual} onChange={(e) => set({ actual: e.target.value })} /></Field>
              <Field label="Owner"><input className="q-input" value={rec.owner_name} onChange={(e) => set({ owner_name: e.target.value })} /></Field>
              <Field label="Notes" wide><textarea className="q-input" value={rec.notes} onChange={(e) => set({ notes: e.target.value })} /></Field>
            </div>
          )}
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={save}>Save</button></div>
          {trail.length > 0 && <div className="q-box"><h3>Trail</h3><ul className="q-trail">{trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>}
        </Panel>
      )}
    </div>
  );
}
