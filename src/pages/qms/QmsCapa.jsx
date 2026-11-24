import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Trash2 } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select, ClauseSelect } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label, today } from './qmsLib';

// QMS > Non-Conformance & CAPA (Super Admin).
// Open -> Contained -> Root cause -> Action -> Verification -> Closed. A nonconformity can be closed only with a recorded
// root cause, every action done, and an effectiveness check. The database repeats that rule. A closed case is a record.

const SOURCES = ['internal_audit', 'external_audit', 'customer_complaint', 'process', 'supplier', 'other'];
const STEPS = ['open', 'contained', 'root_cause', 'action', 'verification', 'closed'];
const EMPTY = { title: '', source: 'process', severity: 'minor', clause: '', description: '', owner_name: '', due_date: '' };
const EMPTY_ACTION = { kind: 'corrective', description: '', owner_name: '', due_date: '' };

export default function QmsCapa() {
  const [rows, setRows] = useState([]);
  const [acts, setActs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fStatus, setFStatus] = useState('open');
  const [adding, setAdding] = useState(null);
  const [open, setOpen] = useState(null); // { row, actions, trail }
  const [edit, setEdit] = useState(null);
  const [act, setAct] = useState(null);
  const [ver, setVer] = useState(null); // { id, note }: verifying an action
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { const o = await call('qms-list', { entity: 'nc' }); setRows(o.rows); setActs(o.actions); setError(''); } catch (e) { setError(e.message || 'Could not load the nonconformities.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((n) => (fStatus === 'all' ? true : fStatus === 'open' ? n.status !== 'closed' : n.status === 'closed')), [rows, fStatus]);
  const progress = (n) => { const a = acts.filter((x) => x.nc_id === n.id); return a.length ? `${a.filter((x) => x.status !== 'open').length}/${a.length}` : ''; };

  const openNc = async (id) => {
    const out = await run(() => call('qms-get', { entity: 'nc', id }));
    if (!out) return;
    setOpen(out);
    const r = out.row;
    setEdit({ title: r.title, source: r.source, severity: r.severity, clause: r.clause || '', description: r.description || '', containment: r.containment || '', root_cause: r.root_cause || '', owner_name: r.owner_name || '', due_date: r.due_date || '', status: r.status, effectiveness_note: r.effectiveness_note || '' });
    setAct(null);
  };
  const refresh = async () => { await openNc(open.row.id); load(); };

  const create = async () => {
    const out = await run(() => call('qms-save', { entity: 'nc', record: adding }), 'Nonconformity raised.');
    if (out) { setAdding(null); load(); if (out.row) openNc(out.row.id); }
  };
  const save = async (msg = 'Saved.') => {
    const out = await run(() => call('qms-save', { entity: 'nc', id: open.row.id, record: edit }), msg);
    if (out) refresh();
  };
  const addAction = async () => {
    const out = await run(() => call('qms-child-save', { entity: 'action', record: { ...act, nc_id: open.row.id } }), 'Action added.');
    if (out) { setAct(null); refresh(); }
  };
  const setActionStatus = async (a, status, note) => {
    const out = await run(() => call('qms-child-save', { entity: 'action', id: a.id, record: { status, ...(note !== undefined ? { verified_note: note } : {}) } }), 'Action updated.');
    if (out) { setVer(null); refresh(); }
  };
  const delAction = async (a) => {
    const out = await run(() => call('qms-child-delete', { entity: 'action', id: a.id }), 'Action removed.');
    if (out) refresh();
  };

  const closed = open?.row.status === 'closed';
  const overdue = (n) => n.status !== 'closed' && n.due_date && n.due_date < today();

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Non-conformance & CAPA</h1>
          <p className="page-subtitle">Record a nonconformity, find the root cause, carry out the corrective and preventive actions and check that they worked. It can be closed only when all of that is recorded.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setAdding({ ...EMPTY })}><Plus size={15} /> Raise nonconformity</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !open && !adding ? error : ''} notice={notice && !open && !adding ? notice : ''} />

      <div className="q-tabs">
        {[['open', 'Open'], ['closed', 'Closed'], ['all', 'All']].map(([k, t]) => <button key={k} type="button" className={`q-tab${fStatus === k ? ' q-tab--on' : ''}`} onClick={() => setFStatus(k)}>{t}</button>)}
      </div>

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Number</th><th>Title</th><th>Source</th><th>Severity</th><th>Status</th><th>Actions</th><th>Due</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="ntf__muted">{loading ? 'Loading...' : 'Nothing here.'}</td></tr>}
            {shown.map((n) => (
              <tr key={n.id} className="q-click" onClick={() => openNc(n.id)}>
                <td className="q-no">{n.nc_no}</td><td>{n.title}{n.clause && <span className="q-sub">Clause {n.clause}</span>}</td><td>{label(n.source)}</td>
                <td><Chip value={n.severity} /></td><td><Chip value={n.status} /></td><td>{progress(n)}</td>
                <td>{fmtDate(n.due_date)} {overdue(n) && <Chip value="high" text="Overdue" />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <Panel title="Raise a nonconformity" onClose={() => setAdding(null)}>
          <Alerts error={error} />
          <div className="q-form">
            <Field label="Title" error={errors.title} wide><input className="q-input" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} placeholder="What went wrong" /></Field>
            <Field label="Source"><Select value={adding.source} onChange={(v) => setAdding({ ...adding, source: v })} options={SOURCES} /></Field>
            <Field label="Severity"><Select value={adding.severity} onChange={(v) => setAdding({ ...adding, severity: v })} options={['minor', 'major']} /></Field>
            <Field label="Clause" error={errors.clause}><ClauseSelect value={adding.clause} onChange={(v) => setAdding({ ...adding, clause: v })} /></Field>
            <Field label="Due date" error={errors.due_date}><input className="q-input" type="date" value={adding.due_date} onChange={(e) => setAdding({ ...adding, due_date: e.target.value })} /></Field>
            <Field label="Owner" wide><input className="q-input" value={adding.owner_name} onChange={(e) => setAdding({ ...adding, owner_name: e.target.value })} /></Field>
            <Field label="Description" wide><textarea className="q-input" value={adding.description} onChange={(e) => setAdding({ ...adding, description: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={create}>Raise</button></div>
        </Panel>
      )}

      {open && edit && (
        <Panel wide title={`${open.row.nc_no}  ${open.row.title}`} onClose={() => { setOpen(null); setError(''); }}>
          <Alerts error={error} notice={notice} />
          <div className="q-flow">{STEPS.map((s, i) => <span key={s} className={edit.status === s ? 'is-on' : i < STEPS.indexOf(edit.status) ? 'is-done' : ''}>{label(s)}</span>)}</div>
          {closed && <p className="ntf__muted" style={{ margin: 0 }}>Closed {fmtTime(open.row.closed_at)}. A closed nonconformity is a record and cannot be changed or reopened. Raise a new one if the problem comes back.</p>}

          <div className="q-form">
            <Field label="Status"><Select value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={STEPS} /></Field>
            <Field label="Severity"><Select value={edit.severity} onChange={(v) => setEdit({ ...edit, severity: v })} options={['minor', 'major']} /></Field>
            <Field label="Owner"><input className="q-input" value={edit.owner_name} disabled={closed} onChange={(e) => setEdit({ ...edit, owner_name: e.target.value })} /></Field>
            <Field label="Due date"><input className="q-input" type="date" value={edit.due_date} disabled={closed} onChange={(e) => setEdit({ ...edit, due_date: e.target.value })} /></Field>
            <Field label="Description" wide><textarea className="q-input" value={edit.description} disabled={closed} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></Field>
            <Field label="Immediate containment / correction" wide><textarea className="q-input" value={edit.containment} disabled={closed} onChange={(e) => setEdit({ ...edit, containment: e.target.value })} /></Field>
            <Field label="Root cause" wide hint="Why did it happen? Ask why until you reach something you can fix."><textarea className="q-input" value={edit.root_cause} disabled={closed} onChange={(e) => setEdit({ ...edit, root_cause: e.target.value })} /></Field>
            <Field label="Effectiveness check" wide hint="How do you know the actions worked and the problem has not come back?"><textarea className="q-input" value={edit.effectiveness_note} disabled={closed} onChange={(e) => setEdit({ ...edit, effectiveness_note: e.target.value })} /></Field>
          </div>
          {!closed && <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => save()}>Save</button></div>}

          <div className="q-box">
            <h3>Corrective and preventive actions</h3>
            <table className="ntf__table">
              <thead><tr><th>Type</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th><th /></tr></thead>
              <tbody>
                {open.actions.length === 0 && <tr><td colSpan={6} className="ntf__muted">No actions yet.</td></tr>}
                {open.actions.map((a) => (
                  <tr key={a.id}>
                    <td>{label(a.kind)}</td><td>{a.description}{a.verified_note && <span className="q-sub">Verified: {a.verified_note}</span>}</td><td>{a.owner_name}</td><td>{fmtDate(a.due_date)}</td><td><Chip value={a.status} /></td>
                    <td>{!closed && <div className="q-actions">
                      {a.status === 'open' && <button type="button" className="ntf__btn" disabled={busy} onClick={() => setActionStatus(a, 'done')}>Done</button>}
                      {a.status === 'done' && ver?.id !== a.id && <button type="button" className="ntf__btn" disabled={busy} onClick={() => setVer({ id: a.id, note: '' })}>Verify</button>}
                      <button type="button" className="q-x" aria-label="Remove action" disabled={busy} onClick={() => delAction(a)}><Trash2 size={15} /></button>
                    </div>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {ver && (
              <div className="q-form">
                <Field label="How was the action verified?" wide><input className="q-input" value={ver.note} onChange={(e) => setVer({ ...ver, note: e.target.value })} placeholder="What you checked and saw" /></Field>
                <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => setActionStatus({ id: ver.id }, 'verified', ver.note)}>Mark verified</button><button type="button" className="ntf__btn" onClick={() => setVer(null)}>Cancel</button></div>
              </div>
            )}
            {!closed && !act && <div className="q-actions"><button type="button" className="ntf__btn" onClick={() => setAct({ ...EMPTY_ACTION })}><Plus size={14} /> Add action</button></div>}
            {act && (
              <>
                <div className="q-form">
                  <Field label="Type"><Select value={act.kind} onChange={(v) => setAct({ ...act, kind: v })} options={['correction', 'corrective', 'preventive']} /></Field>
                  <Field label="Due date"><input className="q-input" type="date" value={act.due_date} onChange={(e) => setAct({ ...act, due_date: e.target.value })} /></Field>
                  <Field label="Action" error={errors.description} wide><input className="q-input" value={act.description} onChange={(e) => setAct({ ...act, description: e.target.value })} /></Field>
                  <Field label="Owner" wide><input className="q-input" value={act.owner_name} onChange={(e) => setAct({ ...act, owner_name: e.target.value })} /></Field>
                </div>
                <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={addAction}>Add</button><button type="button" className="ntf__btn" onClick={() => setAct(null)}>Cancel</button></div>
              </>
            )}
          </div>

          <div className="q-box"><h3>Trail</h3><ul className="q-trail">{open.trail.length === 0 && <li>No history yet.</li>}{open.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>
        </Panel>
      )}
    </div>
  );
}
