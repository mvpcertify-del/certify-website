import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Wand2 } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, today } from './qmsLib';

// QMS > Management Review (Super Admin), clause 9.3.
// "Collect inputs" takes a snapshot of the QMS (open nonconformities, KPI results, audit findings, risks, documents due)
// so the review starts from facts. A review can be marked held only with decisions recorded. A held review is a record.

const EMPTY = { review_date: today(), attendees: '' };

function Inputs({ inputs }) {
  if (!inputs || !inputs.snapshot_date) return <p className="ntf__muted" style={{ margin: 0 }}>No inputs collected yet. Use "Collect inputs".</p>;
  const f = inputs.audits?.findings || {};
  return (
    <ul className="q-trail" style={{ fontSize: 'var(--font-size-sm)' }}>
      <li><b>Snapshot</b> {fmtDate(inputs.snapshot_date)}. Previous review: {inputs.previous_review || 'none'}.</li>
      <li><b>Nonconformities</b> {inputs.nonconformities.open} open ({inputs.nonconformities.overdue} overdue), {inputs.nonconformities.closed_last_12_months} closed in the last 12 months. Open actions: {inputs.actions.open}.</li>
      <li><b>Objectives</b> {inputs.kpis.met} of {inputs.kpis.measured} measured KPIs met{inputs.kpis.not_met.length ? `. Not met: ${inputs.kpis.not_met.join(', ')}` : ''}.</li>
      <li><b>Internal audits</b> {inputs.audits.completed_last_12_months} completed in the last 12 months. Findings: {Object.keys(f).length ? Object.entries(f).map(([k, n]) => `${n} ${k.replace(/_/g, ' ')}`).join(', ') : 'none'}.</li>
      <li><b>Risks</b> {inputs.risks.open} open{inputs.risks.high.length ? `, high: ${inputs.risks.high.join(', ')}` : ''}.</li>
      {inputs.customers && <li><b>Customers</b> {inputs.customers.feedback_last_12_months} feedback records in the last 12 months, {inputs.customers.complaints} complaints ({inputs.customers.open_complaints} open). Average rating: {inputs.customers.average_rating ?? 'none recorded'}.</li>}
      {inputs.providers && <li><b>External providers</b> {inputs.providers.approved} approved{inputs.providers.not_approved.length ? `. Not approved: ${inputs.providers.not_approved.join(', ')}` : ''}{inputs.providers.certificate_or_evaluation_due.length ? `. Certificate or evaluation due: ${inputs.providers.certificate_or_evaluation_due.join(', ')}` : ''}.</li>}
      {inputs.competence && <li><b>Competence</b> {inputs.competence.completed} training records completed, {inputs.competence.overdue_or_expiring} overdue or expiring.</li>}
      {inputs.equipment && <li><b>Equipment</b> {inputs.equipment.calibration_due.length ? `Calibration due: ${inputs.equipment.calibration_due.join(', ')}` : 'All calibrations up to date'}.</li>}
      <li><b>Documents</b> {inputs.documents.approved} approved{inputs.documents.review_due.length ? `. Due for review: ${inputs.documents.review_due.join(', ')}` : ''}.</li>
    </ul>
  );
}

export default function QmsReview() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await call('qms-list', { entity: 'review' })).rows); setError(''); } catch (e) { setError(e.message || 'Could not load the reviews.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const openReview = async (id) => {
    const out = await run(() => call('qms-get', { entity: 'review', id }));
    if (!out) return;
    setOpen(out);
    const r = out.row;
    setEdit({ review_date: r.review_date, attendees: r.attendees || '', status: r.status, customer_feedback: r.customer_feedback || '', provider_performance: r.provider_performance || '', resources: r.resources || '', decisions: r.decisions || '' });
  };
  const refresh = async () => { await openReview(open.row.id); load(); };

  const create = async () => {
    const out = await run(() => call('qms-save', { entity: 'review', record: adding }), 'Review planned.');
    if (out) { setAdding(null); load(); if (out.row) openReview(out.row.id); }
  };
  const save = async () => {
    const out = await run(() => call('qms-save', { entity: 'review', id: open.row.id, record: edit }), 'Saved.');
    if (out) refresh();
  };
  const collect = async () => {
    const out = await run(() => call('qms-review-snapshot', { id: open.row.id }), 'Inputs collected from the current records.');
    if (out) refresh();
  };

  const held = open?.row.status === 'held';

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Management review & KPIs</h1>
          <p className="page-subtitle">Top management reviews the QMS at least once a year. Collect the inputs from your records, add what the system cannot know (customer feedback, provider performance, resources) and record the decisions.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setAdding({ ...EMPTY })}><Plus size={15} /> Plan review</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !open && !adding ? error : ''} notice={notice && !open && !adding ? notice : ''} />

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Number</th><th>Date</th><th>Attendees</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} className="ntf__muted">{loading ? 'Loading...' : 'No reviews yet. Clause 9.3 needs at least one held review.'}</td></tr>}
            {rows.map((r) => <tr key={r.id} className="q-click" onClick={() => openReview(r.id)}><td className="q-no">{r.review_no}</td><td>{fmtDate(r.review_date)}</td><td>{r.attendees}</td><td><Chip value={r.status} /></td></tr>)}
          </tbody>
        </table>
      </div>

      {adding && (
        <Panel title="Plan a management review" onClose={() => setAdding(null)}>
          <Alerts error={error} />
          <div className="q-form">
            <Field label="Date" error={errors.review_date}><input className="q-input" type="date" value={adding.review_date} onChange={(e) => setAdding({ ...adding, review_date: e.target.value })} /></Field>
            <Field label="Attendees" wide><textarea className="q-input" value={adding.attendees} onChange={(e) => setAdding({ ...adding, attendees: e.target.value })} placeholder="Top management and the Quality Manager" /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={create}>Plan review</button></div>
        </Panel>
      )}

      {open && edit && (
        <Panel wide title={`${open.row.review_no}  ${fmtDate(open.row.review_date)}`} onClose={() => { setOpen(null); setError(''); }}>
          <Alerts error={error} notice={notice} />
          {held && <p className="ntf__muted" style={{ margin: 0 }}>This review was held. It is a record and cannot be changed.</p>}

          <div className="q-box">
            <h3>Inputs from the QMS</h3>
            <Inputs inputs={open.row.inputs} />
            {!held && <div className="q-actions"><button type="button" className="ntf__btn" disabled={busy} onClick={collect}><Wand2 size={14} /> Collect inputs</button></div>}
          </div>

          <div className="q-form">
            <Field label="Status"><Select value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={['planned', 'held']} /></Field>
            <Field label="Date"><input className="q-input" type="date" value={edit.review_date} disabled={held} onChange={(e) => setEdit({ ...edit, review_date: e.target.value })} /></Field>
            <Field label="Attendees" wide><textarea className="q-input" value={edit.attendees} disabled={held} onChange={(e) => setEdit({ ...edit, attendees: e.target.value })} /></Field>
            <Field label="Customer satisfaction and feedback" wide><textarea className="q-input" value={edit.customer_feedback} disabled={held} onChange={(e) => setEdit({ ...edit, customer_feedback: e.target.value })} /></Field>
            <Field label="Performance of external providers" wide><textarea className="q-input" value={edit.provider_performance} disabled={held} onChange={(e) => setEdit({ ...edit, provider_performance: e.target.value })} /></Field>
            <Field label="Adequacy of resources" wide><textarea className="q-input" value={edit.resources} disabled={held} onChange={(e) => setEdit({ ...edit, resources: e.target.value })} /></Field>
            <Field label="Decisions and actions (improvement, changes to the QMS, resource needs)" error={errors.decisions} wide><textarea className="q-input" value={edit.decisions} disabled={held} onChange={(e) => setEdit({ ...edit, decisions: e.target.value })} /></Field>
          </div>
          {!held && <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={save}>Save</button></div>}

          <div className="q-box"><h3>Trail</h3><ul className="q-trail">{open.trail.length === 0 && <li>No history yet.</li>}{open.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>
        </Panel>
      )}
    </div>
  );
}
