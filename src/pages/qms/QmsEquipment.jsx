import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label, today } from './qmsLib';

// QMS > Equipment & calibration (Super Admin), clause 7.1.5: equipment used to monitor or measure, and its calibration.
// Recording a calibration sets the next due date from the equipment's interval. A failed calibration takes the equipment
// out of service until it passes. The history is kept.

const EMPTY = { name: '', location: '', serial_no: '', owner_name: '', interval_months: 12, notes: '' };
const EMPTY_CAL = { calibrated_on: today(), result: 'pass', certificate_ref: '', notes: '' };
const dueState = (e) => {
  if (e.status !== 'active' || !e.next_due) return null;
  const d = Math.round((Date.parse(`${e.next_due}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000);
  return d < 0 ? ['high', `Overdue by ${-d} days`] : d <= 30 ? ['medium', `Due in ${d} days`] : null;
};

export default function QmsEquipment() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [cal, setCal] = useState(null);
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await call('qms-list', { entity: 'equipment' })).rows); setError(''); } catch (e) { setError(e.message || 'Could not load the equipment.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const openEq = async (id) => {
    const out = await run(() => call('qms-get', { entity: 'equipment', id }));
    if (!out) return;
    setOpen(out); setCal(null);
    const r = out.row;
    setEdit({ name: r.name, location: r.location || '', serial_no: r.serial_no || '', owner_name: r.owner_name || '', interval_months: r.interval_months, status: r.status, notes: r.notes || '' });
  };
  const refresh = async () => { await openEq(open.row.id); load(); };

  const create = async () => {
    const out = await run(() => call('qms-save', { entity: 'equipment', record: adding }), 'Equipment added. Record its first calibration.');
    if (out) { setAdding(null); load(); if (out.row) openEq(out.row.id); }
  };
  const save = async () => { const out = await run(() => call('qms-save', { entity: 'equipment', id: open.row.id, record: edit }), 'Saved.'); if (out) refresh(); };
  const calibrate = async () => {
    const out = await run(() => call('qms-calibrate', { id: open.row.id, ...cal }), (o) => (o.passed ? 'Calibration recorded. The next one is scheduled.' : 'Failed calibration recorded. The equipment is out of service until it passes.'));
    if (out) { setCal(null); refresh(); }
  };

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Equipment & calibration</h1>
          <p className="page-subtitle">List the equipment that monitors or measures quality, calibrate it on schedule and keep the certificates. Overdue items are flagged. A failed calibration takes the item out of service.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setAdding({ ...EMPTY })}><Plus size={15} /> Add equipment</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !open && !adding ? error : ''} notice={notice && !open && !adding ? notice : ''} />

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Number</th><th>Equipment</th><th>Location</th><th>Last calibrated</th><th>Next due</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={6} className="ntf__muted">{loading ? 'Loading...' : 'No equipment yet. Add what you use to measure or monitor.'}</td></tr>}
            {rows.map((e) => { const d = dueState(e); return (
              <tr key={e.id} className="q-click" onClick={() => openEq(e.id)}>
                <td className="q-no">{e.equipment_no}</td><td>{e.name}{e.serial_no && <span className="q-sub">Serial {e.serial_no}</span>}</td><td>{e.location}</td>
                <td>{fmtDate(e.last_calibrated)}</td><td>{fmtDate(e.next_due)} {d && <Chip value={d[0]} text={d[1]} />}</td>
                <td><Chip value={e.status === 'active' ? 'ready' : e.status === 'out_of_service' ? 'none' : 'obsolete'} text={label(e.status)} /></td>
              </tr>); })}
          </tbody>
        </table>
      </div>

      {adding && (
        <Panel title="Add equipment" onClose={() => setAdding(null)}>
          <Alerts error={error} />
          <div className="q-form">
            <Field label="Name" error={errors.name} wide><input className="q-input" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></Field>
            <Field label="Location"><input className="q-input" value={adding.location} onChange={(e) => setAdding({ ...adding, location: e.target.value })} /></Field>
            <Field label="Serial number"><input className="q-input" value={adding.serial_no} onChange={(e) => setAdding({ ...adding, serial_no: e.target.value })} /></Field>
            <Field label="Owner"><input className="q-input" value={adding.owner_name} onChange={(e) => setAdding({ ...adding, owner_name: e.target.value })} /></Field>
            <Field label="Calibrate every (months)" error={errors.interval_months}><input className="q-input" type="number" min="1" max="120" value={adding.interval_months} onChange={(e) => setAdding({ ...adding, interval_months: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={create}>Add equipment</button></div>
        </Panel>
      )}

      {open && edit && (
        <Panel wide title={`${open.row.equipment_no}  ${open.row.name}`} onClose={() => { setOpen(null); setError(''); }}>
          <Alerts error={error} notice={notice} />
          <div className="q-form">
            <Field label="Name" wide><input className="q-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Location"><input className="q-input" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} /></Field>
            <Field label="Serial number"><input className="q-input" value={edit.serial_no} onChange={(e) => setEdit({ ...edit, serial_no: e.target.value })} /></Field>
            <Field label="Owner"><input className="q-input" value={edit.owner_name} onChange={(e) => setEdit({ ...edit, owner_name: e.target.value })} /></Field>
            <Field label="Calibrate every (months)"><input className="q-input" type="number" min="1" max="120" value={edit.interval_months} onChange={(e) => setEdit({ ...edit, interval_months: e.target.value })} /></Field>
            <Field label="Status" hint="Only a passed calibration puts it back in service."><Select value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={['active', 'out_of_service', 'retired']} /></Field>
            <Field label="Notes" wide><textarea className="q-input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={save}>Save</button></div>

          <div className="q-box">
            <h3>Calibration history</h3>
            <table className="ntf__table">
              <thead><tr><th>Date</th><th>Result</th><th>Certificate</th><th>Notes</th></tr></thead>
              <tbody>
                {open.calibrations.length === 0 && <tr><td colSpan={4} className="ntf__muted">Not calibrated yet.</td></tr>}
                {open.calibrations.map((c) => <tr key={c.id}><td>{fmtDate(c.calibrated_on)}</td><td><Chip value={c.result === 'pass' ? 'ready' : 'none'} text={label(c.result)} /></td><td>{c.certificate_ref}</td><td>{c.notes}</td></tr>)}
              </tbody>
            </table>
            {open.row.status !== 'retired' && !cal && <div className="q-actions"><button type="button" className="ntf__btn" onClick={() => setCal({ ...EMPTY_CAL })}><Plus size={14} /> Record calibration</button></div>}
            {cal && (
              <>
                <div className="q-form">
                  <Field label="Calibrated on" error={errors.calibrated_on}><input className="q-input" type="date" max={today()} value={cal.calibrated_on} onChange={(e) => setCal({ ...cal, calibrated_on: e.target.value })} /></Field>
                  <Field label="Result" error={errors.result}><Select value={cal.result} onChange={(v) => setCal({ ...cal, result: v })} options={['pass', 'fail']} /></Field>
                  <Field label="Certificate reference" wide><input className="q-input" value={cal.certificate_ref} onChange={(e) => setCal({ ...cal, certificate_ref: e.target.value })} /></Field>
                  <Field label="Notes" wide><input className="q-input" value={cal.notes} onChange={(e) => setCal({ ...cal, notes: e.target.value })} /></Field>
                </div>
                <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={calibrate}>Record</button><button type="button" className="ntf__btn" onClick={() => setCal(null)}>Cancel</button></div>
              </>
            )}
          </div>
          <div className="q-box"><h3>Trail</h3><ul className="q-trail">{open.trail.length === 0 && <li>No history yet.</li>}{open.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>
        </Panel>
      )}
    </div>
  );
}
