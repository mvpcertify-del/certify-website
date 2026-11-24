import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, RefreshCw, TriangleAlert } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label, today } from './qmsLib';

// QMS > Customer feedback (Super Admin), clause 9.1.2: complaints, compliments, survey answers and suggestions.
// A complaint can raise a nonconformity (the CAPA process). Feedback is resolved only with a recorded response. The average
// rating and the complaints feed the management review.

const EMPTY = { kind: 'complaint', customer_name: '', received_on: today(), rating: '', subject: '', details: '' };

export default function QmsFeedback() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fKind, setFKind] = useState('all');
  const [form, setForm] = useState(null); // { id?, record, nc_id?, trail? }
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await call('qms-list', { entity: 'feedback' })).rows); setError(''); } catch (e) { setError(e.message || 'Could not load the feedback.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((f) => fKind === 'all' || (fKind === 'open' ? f.status === 'new' || f.status === 'investigating' : f.kind === fKind)), [rows, fKind]);
  const rated = rows.filter((f) => f.rating != null);
  const average = rated.length ? Math.round((rated.reduce((s, f) => s + f.rating, 0) / rated.length) * 10) / 10 : null;
  const openComplaints = rows.filter((f) => f.kind === 'complaint' && (f.status === 'new' || f.status === 'investigating')).length;

  const openRow = async (f) => {
    const out = await run(() => call('qms-get', { entity: 'feedback', id: f.id }));
    if (!out) return;
    setForm({ id: f.id, nc_id: f.nc_id, no: f.feedback_no, trail: out.trail, record: { kind: f.kind, customer_name: f.customer_name || '', received_on: f.received_on, rating: f.rating ?? '', subject: f.subject, details: f.details || '', status: f.status, response: f.response || '' } });
  };
  const set = (patch) => setForm((f) => ({ ...f, record: { ...f.record, ...patch } }));
  const save = async () => {
    const out = await run(() => call('qms-save', { entity: 'feedback', id: form.id, record: form.record }), 'Saved.');
    if (out) { setForm(null); load(); }
  };
  const raiseNc = async () => {
    const out = await run(() => call('qms-feedback-to-nc', { id: form.id }), (o) => `Nonconformity ${o.row.nc_no} raised. Work on it in "Non-conformance & CAPA".`);
    if (out) { await openRow({ id: form.id, feedback_no: form.no, ...form.record, nc_id: out.row.id }); load(); }
  };
  const rec = form?.record;

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Customer feedback & complaints</h1>
          <p className="page-subtitle">Record what customers tell you: complaints, praise, survey answers and ideas. A complaint can start a corrective action. Resolve each one with a response.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setForm({ record: { ...EMPTY } })}><Plus size={15} /> Add feedback</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !form ? error : ''} notice={notice && !form ? notice : ''} />

      <div className="q-grid">
        <div className="q-stat"><b>{rows.length}</b><span>Feedback records</span></div>
        <div className={`q-stat${openComplaints ? ' q-stat--bad' : ''}`}><b>{openComplaints}</b><span>Open complaints</span></div>
        <div className="q-stat"><b>{average ?? '-'}</b><span>Average rating (out of 5)</span></div>
      </div>

      <div className="q-tabs">
        {[['all', 'All'], ['open', 'Open'], ['complaint', 'Complaints'], ['compliment', 'Compliments'], ['survey', 'Surveys'], ['suggestion', 'Suggestions']].map(([k, t]) => <button key={k} type="button" className={`q-tab${fKind === k ? ' q-tab--on' : ''}`} onClick={() => setFKind(k)}>{t}</button>)}
      </div>

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Subject</th><th>Type</th><th>Rating</th><th>Status</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="ntf__muted">{loading ? 'Loading...' : 'No feedback here. Clause 9.1 needs customer feedback on record.'}</td></tr>}
            {shown.map((f) => (
              <tr key={f.id} className="q-click" onClick={() => openRow(f)}>
                <td className="q-no">{f.feedback_no}</td><td>{fmtDate(f.received_on)}</td><td>{f.customer_name}</td><td>{f.subject}</td><td>{label(f.kind)}</td><td>{f.rating ?? ''}</td>
                <td><Chip value={f.status === 'new' ? 'open' : f.status} text={label(f.status)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {form && (
        <Panel title={form.id ? `${form.no}  ${rec.subject}` : 'Add feedback'} onClose={() => { setForm(null); setError(''); }}>
          <Alerts error={error} notice={notice} />
          <div className="q-form">
            <Field label="Type"><Select value={rec.kind} onChange={(v) => set({ kind: v })} options={['complaint', 'compliment', 'survey', 'suggestion']} /></Field>
            <Field label="Received on" error={errors.received_on}><input className="q-input" type="date" value={rec.received_on} onChange={(e) => set({ received_on: e.target.value })} /></Field>
            <Field label="Customer" wide><input className="q-input" value={rec.customer_name} onChange={(e) => set({ customer_name: e.target.value })} /></Field>
            <Field label="Subject" error={errors.subject} wide><input className="q-input" value={rec.subject} onChange={(e) => set({ subject: e.target.value })} /></Field>
            <Field label="Rating (1 to 5, optional)" error={errors.rating}><Select value={rec.rating} onChange={(v) => set({ rating: v === '' ? '' : Number(v) })} empty="No rating" options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} /></Field>
            {form.id && <Field label="Status"><Select value={rec.status} onChange={(v) => set({ status: v })} options={['new', 'investigating', 'resolved', 'closed']} /></Field>}
            <Field label="Details" wide><textarea className="q-input" value={rec.details} onChange={(e) => set({ details: e.target.value })} /></Field>
            {form.id && <Field label="Response to the customer" wide hint="Required to resolve or close."><textarea className="q-input" value={rec.response} onChange={(e) => set({ response: e.target.value })} /></Field>}
          </div>
          <div className="q-actions">
            <button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={form.id ? save : async () => { const out = await run(() => call('qms-save', { entity: 'feedback', record: rec }), 'Feedback recorded.'); if (out) { setForm(null); load(); } }}>{form.id ? 'Save' : 'Add feedback'}</button>
            {form.id && rec.kind === 'complaint' && !form.nc_id && <button type="button" className="ntf__btn" disabled={busy} onClick={raiseNc}><TriangleAlert size={14} /> Raise nonconformity</button>}
            {form.nc_id && <Link className="ntf__btn" to="/qms/capa">Nonconformity raised</Link>}
          </div>
          {form.trail?.length > 0 && <div className="q-box"><h3>Trail</h3><ul className="q-trail">{form.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>}
        </Panel>
      )}
    </div>
  );
}
