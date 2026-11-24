import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw, Trash2, TriangleAlert } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Chip, Alerts, Panel, Field, Select, ClauseSelect, ClauseMulti } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label, today } from './qmsLib';

// QMS > Internal Audits (Super Admin).
// Plan an audit, record findings against clauses, raise a nonconformity from a finding, then complete the audit.
// A completed audit is a record. A planned audit does not count as evidence for clause 9.2.

const FINDING_KINDS = ['conformity', 'observation', 'minor_nc', 'major_nc', 'opportunity'];
const EMPTY = { title: '', audit_type: 'internal', scope: '', clauses: [], planned_date: '', lead_auditor: '', auditee: '' };
const EMPTY_F = { clause: '', kind: 'conformity', statement: '', evidence: '' };

export default function QmsAudits() {
  const [rows, setRows] = useState([]);
  const [fcount, setFcount] = useState({});
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [fin, setFin] = useState(null);
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const o = await call('qms-list', { entity: 'audit' });
      setRows(o.rows);
      const c = {};
      for (const f of o.findings) c[f.audit_id] = (c[f.audit_id] || 0) + 1;
      setFcount(c); setError('');
    } catch (e) { setError(e.message || 'Could not load the audits.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const openAudit = async (id) => {
    const out = await run(() => call('qms-get', { entity: 'audit', id }));
    if (!out) return;
    setOpen(out);
    const r = out.row;
    setEdit({ title: r.title, audit_type: r.audit_type, scope: r.scope || '', clauses: r.clauses || [], planned_date: r.planned_date || '', completed_date: r.completed_date || '', lead_auditor: r.lead_auditor || '', auditee: r.auditee || '', status: r.status, summary: r.summary || '' });
    setFin(null);
  };
  const refresh = async () => { await openAudit(open.row.id); load(); };

  const create = async () => {
    const out = await run(() => call('qms-save', { entity: 'audit', record: adding }), 'Audit planned.');
    if (out) { setAdding(null); load(); if (out.row) openAudit(out.row.id); }
  };
  const save = async (msg = 'Saved.') => {
    const out = await run(() => call('qms-save', { entity: 'audit', id: open.row.id, record: edit }), msg);
    if (out) refresh();
  };
  const addFinding = async () => {
    const out = await run(() => call('qms-child-save', { entity: 'finding', record: { ...fin, audit_id: open.row.id } }), 'Finding recorded.');
    if (out) { setFin(null); refresh(); }
  };
  const delFinding = async (f) => {
    const out = await run(() => call('qms-child-delete', { entity: 'finding', id: f.id }), 'Finding removed.');
    if (out) refresh();
  };
  const raiseNc = async (f) => {
    const out = await run(() => call('qms-finding-to-nc', { id: f.id }), (o) => `Nonconformity ${o.row.nc_no} raised. Open "Non-conformance & CAPA" to work on it.`);
    if (out) refresh();
  };

  const done = open?.row.status === 'completed';

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Internal audits</h1>
          <p className="page-subtitle">Plan the audit programme, record findings against clauses of the standard and raise nonconformities. Cover every clause within the year. Auditors should not audit their own work.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setAdding({ ...EMPTY })}><Plus size={15} /> Plan audit</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !open && !adding ? error : ''} notice={notice && !open && !adding ? notice : ''} />

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Number</th><th>Audit</th><th>Type</th><th>Clauses</th><th>Planned</th><th>Lead auditor</th><th>Findings</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={8} className="ntf__muted">{loading ? 'Loading...' : 'No audits yet. Plan the first one.'}</td></tr>}
            {rows.map((a) => (
              <tr key={a.id} className="q-click" onClick={() => openAudit(a.id)}>
                <td className="q-no">{a.audit_no}</td><td>{a.title}</td><td>{label(a.audit_type)}</td><td>{(a.clauses || []).join(', ')}</td>
                <td>{fmtDate(a.planned_date)}</td><td>{a.lead_auditor}</td><td>{fcount[a.id] || ''}</td><td><Chip value={a.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <Panel title="Plan an audit" onClose={() => setAdding(null)}>
          <Alerts error={error} />
          <div className="q-form">
            <Field label="Title" error={errors.title} wide><input className="q-input" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} placeholder="For example: Q4 2026 internal audit" /></Field>
            <Field label="Type"><Select value={adding.audit_type} onChange={(v) => setAdding({ ...adding, audit_type: v })} options={['internal', 'supplier', 'external']} /></Field>
            <Field label="Planned date" error={errors.planned_date}><input className="q-input" type="date" value={adding.planned_date} onChange={(e) => setAdding({ ...adding, planned_date: e.target.value })} /></Field>
            <Field label="Lead auditor"><input className="q-input" value={adding.lead_auditor} onChange={(e) => setAdding({ ...adding, lead_auditor: e.target.value })} /></Field>
            <Field label="Area audited"><input className="q-input" value={adding.auditee} onChange={(e) => setAdding({ ...adding, auditee: e.target.value })} /></Field>
            <Field label="Clauses in scope" wide><ClauseMulti value={adding.clauses} onChange={(v) => setAdding({ ...adding, clauses: v })} /></Field>
            <Field label="Scope" wide><textarea className="q-input" value={adding.scope} onChange={(e) => setAdding({ ...adding, scope: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={create}>Plan audit</button></div>
        </Panel>
      )}

      {open && edit && (
        <Panel wide title={`${open.row.audit_no}  ${open.row.title}`} onClose={() => { setOpen(null); setError(''); }}>
          <Alerts error={error} notice={notice} />
          {done && <p className="ntf__muted" style={{ margin: 0 }}>Completed. A completed audit is a record and cannot be changed.</p>}
          <div className="q-form">
            <Field label="Status"><Select value={edit.status} onChange={(v) => setEdit({ ...edit, status: v, completed_date: v === 'completed' && !edit.completed_date ? today() : edit.completed_date })} options={['planned', 'in_progress', 'completed']} /></Field>
            <Field label="Planned date"><input className="q-input" type="date" value={edit.planned_date} disabled={done} onChange={(e) => setEdit({ ...edit, planned_date: e.target.value })} /></Field>
            <Field label="Completed on" error={errors.completed_date}><input className="q-input" type="date" value={edit.completed_date} disabled={done} onChange={(e) => setEdit({ ...edit, completed_date: e.target.value })} /></Field>
            <Field label="Lead auditor"><input className="q-input" value={edit.lead_auditor} disabled={done} onChange={(e) => setEdit({ ...edit, lead_auditor: e.target.value })} /></Field>
            <Field label="Area audited" wide><input className="q-input" value={edit.auditee} disabled={done} onChange={(e) => setEdit({ ...edit, auditee: e.target.value })} /></Field>
            <Field label="Clauses in scope" wide><ClauseMulti value={edit.clauses} onChange={(v) => !done && setEdit({ ...edit, clauses: v })} /></Field>
            <Field label="Scope" wide><textarea className="q-input" value={edit.scope} disabled={done} onChange={(e) => setEdit({ ...edit, scope: e.target.value })} /></Field>
            <Field label="Summary and conclusion" wide><textarea className="q-input" value={edit.summary} disabled={done} onChange={(e) => setEdit({ ...edit, summary: e.target.value })} /></Field>
          </div>
          {!done && <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => save()}>Save</button></div>}

          <div className="q-box">
            <h3>Findings</h3>
            <table className="ntf__table">
              <thead><tr><th>Clause</th><th>Type</th><th>Finding</th><th /></tr></thead>
              <tbody>
                {open.findings.length === 0 && <tr><td colSpan={4} className="ntf__muted">No findings yet.</td></tr>}
                {open.findings.map((f) => (
                  <tr key={f.id}>
                    <td className="q-no">{f.clause}</td><td><Chip value={f.kind} /></td>
                    <td>{f.statement}{f.evidence && <span className="q-sub">Evidence: {f.evidence}</span>}</td>
                    <td><div className="q-actions">
                      {(f.kind === 'minor_nc' || f.kind === 'major_nc') && !f.nc_id && <button type="button" className="ntf__btn" disabled={busy} onClick={() => raiseNc(f)}><TriangleAlert size={14} /> Raise NC</button>}
                      {f.nc_id && <Link className="ntf__btn" to="/qms/capa">NC raised</Link>}
                      {!done && <button type="button" className="q-x" aria-label="Remove finding" disabled={busy} onClick={() => delFinding(f)}><Trash2 size={15} /></button>}
                    </div></td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!done && !fin && <div className="q-actions"><button type="button" className="ntf__btn" onClick={() => setFin({ ...EMPTY_F })}><Plus size={14} /> Add finding</button></div>}
            {fin && (
              <>
                <div className="q-form">
                  <Field label="Clause"><ClauseSelect value={fin.clause} onChange={(v) => setFin({ ...fin, clause: v })} /></Field>
                  <Field label="Type"><Select value={fin.kind} onChange={(v) => setFin({ ...fin, kind: v })} options={FINDING_KINDS} /></Field>
                  <Field label="Finding" error={errors.statement} wide><textarea className="q-input" value={fin.statement} onChange={(e) => setFin({ ...fin, statement: e.target.value })} /></Field>
                  <Field label="Evidence seen" wide><input className="q-input" value={fin.evidence} onChange={(e) => setFin({ ...fin, evidence: e.target.value })} placeholder="Record, document or interview" /></Field>
                </div>
                <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={addFinding}>Add</button><button type="button" className="ntf__btn" onClick={() => setFin(null)}>Cancel</button></div>
              </>
            )}
          </div>

          <div className="q-box"><h3>Trail</h3><ul className="q-trail">{open.trail.length === 0 && <li>No history yet.</li>}{open.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>
        </Panel>
      )}
    </div>
  );
}
