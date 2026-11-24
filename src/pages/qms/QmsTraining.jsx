import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label, today } from './qmsLib';

// QMS > Training & competence (Super Admin), clause 7.2: who has which skill, who still needs training, and when a
// certificate or qualification expires. A completed record needs its completion date. Expiring items (within 60 days)
// and overdue planned training are flagged.

const KINDS = ['training', 'certification', 'induction', 'experience'];
const EMPTY = { person_name: '', role: '', training_title: '', kind: 'training', provider: '', planned_date: '', completed_on: '', expires_on: '', evidence: '', status: 'planned' };
const days = (d) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000);

function flag(t) {
  if (t.status === 'planned' && t.planned_date && t.planned_date < today()) return ['bad', 'Overdue'];
  if (t.status === 'completed' && t.expires_on) { const d = days(t.expires_on); if (d < 0) return ['bad', 'Expired']; if (d <= 60) return ['warn', `Expires in ${d} days`]; }
  return null;
}

export default function QmsTraining() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [form, setForm] = useState(null); // { id?, record, trail? }
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await call('qms-list', { entity: 'training' })).rows); setError(''); } catch (e) { setError(e.message || 'Could not load the records.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((t) => (fStatus === 'all' || (fStatus === 'attention' ? !!flag(t) : t.status === fStatus))
    && (!q || `${t.person_name} ${t.training_title} ${t.role || ''}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, fStatus]);

  const openRow = async (t) => {
    const out = await run(() => call('qms-get', { entity: 'training', id: t.id }));
    if (!out) return;
    setForm({ id: t.id, trail: out.trail, record: { person_name: t.person_name, role: t.role || '', training_title: t.training_title, kind: t.kind, provider: t.provider || '', planned_date: t.planned_date || '', completed_on: t.completed_on || '', expires_on: t.expires_on || '', evidence: t.evidence || '', status: t.status } });
  };
  const set = (patch) => setForm((f) => ({ ...f, record: { ...f.record, ...patch } }));
  const save = async () => {
    const out = await run(() => call('qms-save', { entity: 'training', id: form.id, record: form.record }), 'Saved.');
    if (out) { setForm(null); load(); }
  };
  const rec = form?.record;

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Training & competence</h1>
          <p className="page-subtitle">Record what each person has been trained in, the certificates they hold and when those expire. Plan training for any gap. Keep the evidence an auditor can ask for.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setForm({ record: { ...EMPTY } })}><Plus size={15} /> Add record</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !form ? error : ''} notice={notice && !form ? notice : ''} />

      <div className="ntf__filters">
        <label className="ntf__search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search person or training" /></label>
        <select className="ntf__select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Filter">
          <option value="all">All records</option><option value="attention">Needs attention</option><option value="planned">Planned</option><option value="completed">Completed</option>
        </select>
      </div>

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Person</th><th>Training or qualification</th><th>Type</th><th>Completed</th><th>Expires</th><th>Status</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={6} className="ntf__muted">{loading ? 'Loading...' : 'No records yet. Clause 7.2 needs at least one completed record.'}</td></tr>}
            {shown.map((t) => { const f = flag(t); return (
              <tr key={t.id} className="q-click" onClick={() => openRow(t)}>
                <td>{t.person_name}{t.role && <span className="q-sub">{t.role}</span>}</td><td>{t.training_title}{t.provider && <span className="q-sub">{t.provider}</span>}</td><td>{label(t.kind)}</td>
                <td>{fmtDate(t.completed_on)}{!t.completed_on && t.planned_date ? `Planned ${fmtDate(t.planned_date)}` : ''}</td><td>{fmtDate(t.expires_on)}</td>
                <td><Chip value={t.status} /> {f && <Chip value={f[0] === 'bad' ? 'high' : 'medium'} text={f[1]} />}</td>
              </tr>); })}
          </tbody>
        </table>
      </div>

      {form && (
        <Panel title={form.id ? 'Training record' : 'Add a training record'} onClose={() => { setForm(null); setError(''); }}>
          <Alerts error={error} />
          <div className="q-form">
            <Field label="Person" error={errors.person_name}><input className="q-input" value={rec.person_name} onChange={(e) => set({ person_name: e.target.value })} /></Field>
            <Field label="Role"><input className="q-input" value={rec.role} onChange={(e) => set({ role: e.target.value })} /></Field>
            <Field label="Training or qualification" error={errors.training_title} wide><input className="q-input" value={rec.training_title} onChange={(e) => set({ training_title: e.target.value })} /></Field>
            <Field label="Type"><Select value={rec.kind} onChange={(v) => set({ kind: v })} options={KINDS} /></Field>
            <Field label="Provider"><input className="q-input" value={rec.provider} onChange={(e) => set({ provider: e.target.value })} /></Field>
            <Field label="Status"><Select value={rec.status} onChange={(v) => set({ status: v, completed_on: v === 'completed' && !rec.completed_on ? today() : rec.completed_on })} options={['planned', 'completed']} /></Field>
            <Field label="Planned date" error={errors.planned_date}><input className="q-input" type="date" value={rec.planned_date} onChange={(e) => set({ planned_date: e.target.value })} /></Field>
            <Field label="Completed on" error={errors.completed_on}><input className="q-input" type="date" value={rec.completed_on} onChange={(e) => set({ completed_on: e.target.value })} /></Field>
            <Field label="Expires on" error={errors.expires_on}><input className="q-input" type="date" value={rec.expires_on} onChange={(e) => set({ expires_on: e.target.value })} /></Field>
            <Field label="Evidence" wide hint="Where the certificate or record is kept."><input className="q-input" value={rec.evidence} onChange={(e) => set({ evidence: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={save}>Save</button></div>
          {form.trail?.length > 0 && <div className="q-box"><h3>Trail</h3><ul className="q-trail">{form.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>}
        </Panel>
      )}
    </div>
  );
}
