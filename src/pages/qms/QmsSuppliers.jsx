import { useCallback, useEffect, useState } from 'react';
import { Plus, RefreshCw } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label, today } from './qmsLib';

// QMS > Suppliers (Super Admin), clause 8.4: external providers (certification bodies, auditors, contractors, hosting,
// payment and software providers). A supplier is approved only after an evaluation in the last 12 months that scored at
// least 3 out of 5. Evaluations are records: they are added, never edited. Certificates and evaluations that are due soon
// are flagged.

const CATS = ['certification_body', 'auditor', 'contractor', 'hosting', 'payment', 'software', 'other'];
const EMPTY = { name: '', category: 'other', country: '', contact: '', certificate_name: '', certificate_expiry: '', notes: '' };
const EMPTY_EV = { evaluated_on: today(), quality: 4, delivery: 4, responsiveness: 4, notes: '' };
const days = (d) => Math.round((Date.parse(`${d}T00:00:00Z`) - Date.parse(`${today()}T00:00:00Z`)) / 86400000);
const avg = (e) => Math.round(((e.quality + e.delivery + e.responsiveness) / 3) * 10) / 10;

export default function QmsSuppliers() {
  const [rows, setRows] = useState([]);
  const [evals, setEvals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(null);
  const [open, setOpen] = useState(null);
  const [edit, setEdit] = useState(null);
  const [ev, setEv] = useState(null);
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { const o = await call('qms-list', { entity: 'supplier' }); setRows(o.rows); setEvals(o.evaluations); setError(''); } catch (e) { setError(e.message || 'Could not load the suppliers.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const latest = (id) => evals.filter((e) => e.supplier_id === id)[0];
  const openSup = async (id) => {
    const out = await run(() => call('qms-get', { entity: 'supplier', id }));
    if (!out) return;
    setOpen(out); setEv(null);
    const r = out.row;
    setEdit({ name: r.name, category: r.category, country: r.country || '', contact: r.contact || '', certificate_name: r.certificate_name || '', certificate_expiry: r.certificate_expiry || '', status: r.status, next_evaluation: r.next_evaluation || '', notes: r.notes || '' });
  };
  const refresh = async () => { await openSup(open.row.id); load(); };

  const create = async () => {
    const out = await run(() => call('qms-save', { entity: 'supplier', record: adding }), 'Supplier added. Evaluate it, then approve it.');
    if (out) { setAdding(null); load(); if (out.row) openSup(out.row.id); }
  };
  const save = async () => { const out = await run(() => call('qms-save', { entity: 'supplier', id: open.row.id, record: edit }), 'Saved.'); if (out) refresh(); };
  const addEval = async () => {
    const out = await run(() => call('qms-child-save', { entity: 'evaluation', record: { ...ev, supplier_id: open.row.id } }), 'Evaluation recorded.');
    if (out) { setEv(null); refresh(); }
  };

  const attention = (s) => {
    const out = [];
    if (s.certificate_expiry) { const d = days(s.certificate_expiry); if (d < 0) out.push('Certificate expired'); else if (d <= 60) out.push(`Certificate expires in ${d} days`); }
    if (s.next_evaluation && s.next_evaluation <= today()) out.push('Evaluation due');
    return out;
  };

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Suppliers & external providers</h1>
          <p className="page-subtitle">Approve outside providers before you use them, score them, and keep their certificates on file. A supplier is approved only after a recent evaluation scoring at least 3 out of 5.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => setAdding({ ...EMPTY })}><Plus size={15} /> Add supplier</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !open && !adding ? error : ''} notice={notice && !open && !adding ? notice : ''} />

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Number</th><th>Supplier</th><th>Type</th><th>Certificate</th><th>Last score</th><th>Next evaluation</th><th>Status</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} className="ntf__muted">{loading ? 'Loading...' : 'No suppliers yet. Clause 8.4 needs at least one approved supplier.'}</td></tr>}
            {rows.map((s) => {
              const l = latest(s.id); const flags = attention(s);
              return (
                <tr key={s.id} className="q-click" onClick={() => openSup(s.id)}>
                  <td className="q-no">{s.supplier_no}</td>
                  <td>{s.name}{flags.map((f) => <span className="q-sub" style={{ color: 'var(--color-danger)' }} key={f}>{f}</span>)}</td>
                  <td>{label(s.category)}</td><td>{s.certificate_name}{s.certificate_expiry && <span className="q-sub">until {fmtDate(s.certificate_expiry)}</span>}</td>
                  <td>{l ? `${avg(l)} / 5` : ''}</td><td>{fmtDate(s.next_evaluation)}</td><td><Chip value={s.status} /></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {adding && (
        <Panel title="Add a supplier" onClose={() => setAdding(null)}>
          <Alerts error={error} />
          <div className="q-form">
            <Field label="Name" error={errors.name} wide><input className="q-input" value={adding.name} onChange={(e) => setAdding({ ...adding, name: e.target.value })} /></Field>
            <Field label="Type"><Select value={adding.category} onChange={(v) => setAdding({ ...adding, category: v })} options={CATS} /></Field>
            <Field label="Country"><input className="q-input" value={adding.country} onChange={(e) => setAdding({ ...adding, country: e.target.value })} /></Field>
            <Field label="Contact" wide><input className="q-input" value={adding.contact} onChange={(e) => setAdding({ ...adding, contact: e.target.value })} /></Field>
            <Field label="Certificate or accreditation"><input className="q-input" value={adding.certificate_name} onChange={(e) => setAdding({ ...adding, certificate_name: e.target.value })} placeholder="For example ISO/IEC 17021-1" /></Field>
            <Field label="Valid until" error={errors.certificate_expiry}><input className="q-input" type="date" value={adding.certificate_expiry} onChange={(e) => setAdding({ ...adding, certificate_expiry: e.target.value })} /></Field>
            <Field label="Notes" wide><textarea className="q-input" value={adding.notes} onChange={(e) => setAdding({ ...adding, notes: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={create}>Add supplier</button></div>
        </Panel>
      )}

      {open && edit && (
        <Panel wide title={`${open.row.supplier_no}  ${open.row.name}`} onClose={() => { setOpen(null); setError(''); }}>
          <Alerts error={error} notice={notice} />
          <div className="q-form">
            <Field label="Status" hint="Approved needs an evaluation from the last 12 months scoring at least 3."><Select value={edit.status} onChange={(v) => setEdit({ ...edit, status: v })} options={['pending', 'approved', 'conditional', 'disapproved']} /></Field>
            <Field label="Type"><Select value={edit.category} onChange={(v) => setEdit({ ...edit, category: v })} options={CATS} /></Field>
            <Field label="Name" wide><input className="q-input" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Country"><input className="q-input" value={edit.country} onChange={(e) => setEdit({ ...edit, country: e.target.value })} /></Field>
            <Field label="Contact"><input className="q-input" value={edit.contact} onChange={(e) => setEdit({ ...edit, contact: e.target.value })} /></Field>
            <Field label="Certificate or accreditation"><input className="q-input" value={edit.certificate_name} onChange={(e) => setEdit({ ...edit, certificate_name: e.target.value })} /></Field>
            <Field label="Valid until"><input className="q-input" type="date" value={edit.certificate_expiry} onChange={(e) => setEdit({ ...edit, certificate_expiry: e.target.value })} /></Field>
            <Field label="Next evaluation due"><input className="q-input" type="date" value={edit.next_evaluation} onChange={(e) => setEdit({ ...edit, next_evaluation: e.target.value })} /></Field>
            <Field label="Notes" wide><textarea className="q-input" value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={save}>Save</button></div>

          <div className="q-box">
            <h3>Evaluations</h3>
            <table className="ntf__table">
              <thead><tr><th>Date</th><th>Quality</th><th>Delivery</th><th>Responsiveness</th><th>Score</th><th>Notes</th></tr></thead>
              <tbody>
                {open.evaluations.length === 0 && <tr><td colSpan={6} className="ntf__muted">Not evaluated yet.</td></tr>}
                {open.evaluations.map((e) => <tr key={e.id}><td>{fmtDate(e.evaluated_on)}</td><td>{e.quality}</td><td>{e.delivery}</td><td>{e.responsiveness}</td><td><Chip value={avg(e) >= 3 ? 'ready' : 'none'} text={`${avg(e)} / 5`} /></td><td>{e.notes}</td></tr>)}
              </tbody>
            </table>
            {!ev && <div className="q-actions"><button type="button" className="ntf__btn" onClick={() => setEv({ ...EMPTY_EV })}><Plus size={14} /> Add evaluation</button></div>}
            {ev && (
              <>
                <div className="q-form">
                  <Field label="Date" error={errors.evaluated_on}><input className="q-input" type="date" value={ev.evaluated_on} onChange={(e) => setEv({ ...ev, evaluated_on: e.target.value })} /></Field>
                  <Field label="Quality (1 to 5)"><Select value={ev.quality} onChange={(v) => setEv({ ...ev, quality: Number(v) })} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} /></Field>
                  <Field label="Delivery (1 to 5)"><Select value={ev.delivery} onChange={(v) => setEv({ ...ev, delivery: Number(v) })} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} /></Field>
                  <Field label="Responsiveness (1 to 5)"><Select value={ev.responsiveness} onChange={(v) => setEv({ ...ev, responsiveness: Number(v) })} options={[1, 2, 3, 4, 5].map((n) => [n, String(n)])} /></Field>
                  <Field label="Notes" wide><input className="q-input" value={ev.notes} onChange={(e) => setEv({ ...ev, notes: e.target.value })} /></Field>
                </div>
                <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={addEval}>Record evaluation</button><button type="button" className="ntf__btn" onClick={() => setEv(null)}>Cancel</button></div>
              </>
            )}
          </div>
          <div className="q-box"><h3>Trail</h3><ul className="q-trail">{open.trail.length === 0 && <li>No history yet.</li>}{open.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul></div>
        </Panel>
      )}
    </div>
  );
}
