import { useCallback, useEffect, useMemo, useState } from 'react';
import { Plus, RefreshCw, Search } from 'lucide-react';
import { Chip, Alerts, Panel, Field, Select, ClauseMulti } from './qmsUi';
import { call, useRunner, fmtDate, fmtTime, label, today } from './qmsLib';

// QMS > Document Control & SOPs (Super Admin).
// A document has numbered versions. Draft -> In review -> Approved. An approved version is locked (the database refuses
// edits). Changing an approved document starts a new version, and the old one is kept as superseded.

const TYPES = ['manual', 'policy', 'procedure', 'work_instruction', 'form', 'record', 'external'];
const FLOW = ['draft', 'in_review', 'approved'];
const EMPTY = { title: '', doc_type: 'procedure', clauses: [], owner_name: '', review_months: 12, content: '' };

export default function QmsDocuments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState('');
  const [fStatus, setFStatus] = useState('all');
  const [open, setOpen] = useState(null); // { row, versions, trail }
  const [adding, setAdding] = useState(null);
  const [text, setText] = useState('');
  const [note, setNote] = useState('');
  const [viewV, setViewV] = useState(null);
  const [meta, setMeta] = useState(null);
  const { busy, error, notice, errors, run, setError } = useRunner();

  const load = useCallback(async () => {
    setLoading(true);
    try { setRows((await call('qms-list', { entity: 'document' })).rows); setError(''); } catch (e) { setError(e.message || 'Could not load the documents.'); } finally { setLoading(false); }
  }, [setError]);
  useEffect(() => { load(); }, [load]);

  const shown = useMemo(() => rows.filter((d) => (fStatus === 'all' || d.status === fStatus)
    && (!q || `${d.doc_no} ${d.title}`.toLowerCase().includes(q.toLowerCase()))), [rows, q, fStatus]);

  const openDoc = async (id) => {
    const out = await run(() => call('qms-get', { entity: 'document', id }));
    if (!out) return;
    setOpen(out); setViewV(null); setNote('');
    setText(out.versions[0]?.content || '');
    setMeta({ title: out.row.title, doc_type: out.row.doc_type, clauses: out.row.clauses || [], owner_name: out.row.owner_name || '', review_months: out.row.review_months });
  };

  const latest = open?.versions?.[0];
  const editable = latest && (latest.status === 'draft' || latest.status === 'in_review');
  const dirty = latest && text !== latest.content;

  const saveText = async () => {
    const out = await run(() => call('qms-doc-version', { id: open.row.id, content: text, change_note: note }), (o) => `Saved as version ${o.version}.`);
    if (out) { await openDoc(open.row.id); load(); }
  };
  const setStatus = async (to, msg) => {
    if (dirty && editable) { setError('Save your changes first.'); return; }
    const out = await run(() => call('qms-doc-status', { id: open.row.id, to }), msg);
    if (out) { await openDoc(open.row.id); load(); }
  };
  const saveMeta = async () => {
    const out = await run(() => call('qms-save', { entity: 'document', id: open.row.id, record: meta }), 'Details saved.');
    if (out) { await openDoc(open.row.id); load(); }
  };
  const create = async () => {
    const out = await run(() => call('qms-save', { entity: 'document', record: adding }), 'Document created.');
    if (out) { setAdding(null); load(); if (out.row) openDoc(out.row.id); }
  };

  const due = (d) => d.approved_version != null && d.status !== 'obsolete' && d.next_review && d.next_review <= today();

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Document control & SOPs</h1>
          <p className="page-subtitle">Controlled documents with versions, owners, approvals and review dates. People should only use the current approved version. An approved version cannot be edited; a change makes a new version.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => { setAdding({ ...EMPTY }); }}><Plus size={15} /> New document</button>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      <Alerts error={error && !open && !adding ? error : ''} notice={notice && !open && !adding ? notice : ''} />

      <div className="ntf__filters">
        <label className="ntf__search"><Search size={14} /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search number or title" /></label>
        <select className="ntf__select" value={fStatus} onChange={(e) => setFStatus(e.target.value)} aria-label="Status">
          <option value="all">All statuses</option>
          {['draft', 'in_review', 'approved', 'obsolete'].map((s) => <option key={s} value={s}>{label(s)}</option>)}
        </select>
      </div>

      <div className="ntf__table-wrap">
        <table className="ntf__table q-table">
          <thead><tr><th>Number</th><th>Title</th><th>Type</th><th>Clauses</th><th>Status</th><th>Approved</th><th>Next review</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td colSpan={7} className="ntf__muted">{loading ? 'Loading...' : 'No documents yet. Go to QMS overview and choose "Generate ISO 9001 documents", or add one here.'}</td></tr>}
            {shown.map((d) => (
              <tr key={d.id} className="q-click" onClick={() => openDoc(d.id)}>
                <td className="q-no">{d.doc_no}</td>
                <td>{d.title}</td>
                <td>{label(d.doc_type)}</td>
                <td>{(d.clauses || []).join(', ')}</td>
                <td><Chip value={d.status} /></td>
                <td>{d.approved_version != null ? `v${d.approved_version}` : <span className="ntf__muted">Not yet</span>}</td>
                <td>{d.next_review ? <>{fmtDate(d.next_review)} {due(d) && <Chip value="high" text="Due" />}</> : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {adding && (
        <Panel title="New document" onClose={() => setAdding(null)}>
          <Alerts error={error} />
          <div className="q-form">
            <Field label="Title" error={errors.title} wide><input className="q-input" value={adding.title} onChange={(e) => setAdding({ ...adding, title: e.target.value })} /></Field>
            <Field label="Type"><Select value={adding.doc_type} onChange={(v) => setAdding({ ...adding, doc_type: v })} options={TYPES} /></Field>
            <Field label="Review every (months)" error={errors.review_months}><input className="q-input" type="number" min="1" max="60" value={adding.review_months} onChange={(e) => setAdding({ ...adding, review_months: e.target.value })} /></Field>
            <Field label="Owner" wide><input className="q-input" value={adding.owner_name} onChange={(e) => setAdding({ ...adding, owner_name: e.target.value })} /></Field>
            <Field label="Clauses it supports" error={errors.clauses} wide><ClauseMulti value={adding.clauses} onChange={(v) => setAdding({ ...adding, clauses: v })} /></Field>
            <Field label="First text" wide><textarea className="q-input" value={adding.content} onChange={(e) => setAdding({ ...adding, content: e.target.value })} /></Field>
          </div>
          <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={create}>Create document</button></div>
        </Panel>
      )}

      {open && (
        <Panel wide title={`${open.row.doc_no}  ${open.row.title}`} onClose={() => { setOpen(null); setError(''); }}>
          <Alerts error={error} notice={notice} />
          <div className="q-actions">
            <Chip value={open.row.status} />
            <div className="q-flow">{FLOW.map((s) => <span key={s} className={latest?.status === s ? 'is-on' : FLOW.indexOf(s) < FLOW.indexOf(latest?.status) ? 'is-done' : ''}>{label(s)}</span>)}</div>
            <span className="ntf__muted">Working version v{latest?.version}{open.row.approved_version != null ? `, approved v${open.row.approved_version}` : ''}{open.row.next_review ? `, review by ${fmtDate(open.row.next_review)}` : ''}</span>
          </div>

          <div className="q-actions">
            {latest?.status === 'draft' && <button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => setStatus('in_review', 'Sent for review.')}>Send for review</button>}
            {latest?.status === 'in_review' && <><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy} onClick={() => setStatus('approved', 'Approved. This version is now locked.')}>Approve</button><button type="button" className="ntf__btn" disabled={busy} onClick={() => setStatus('draft', 'Returned to draft.')}>Return to draft</button></>}
            {open.row.status !== 'obsolete' && <button type="button" className="ntf__btn" disabled={busy} onClick={() => setStatus('obsolete', 'Marked obsolete.')}>Mark obsolete</button>}
          </div>

          <div className="q-box">
            <h3>{editable ? `Edit version ${latest.version}` : `Version ${latest?.version} is approved and locked`}</h3>
            {!editable && <p className="ntf__muted" style={{ margin: 0 }}>To change it, describe the change below and save. That creates version {(latest?.version || 0) + 1} as a draft. The approved version stays in use until the new one is approved.</p>}
            <textarea className="q-input q-input--doc" value={text} onChange={(e) => setText(e.target.value)} disabled={open.row.status === 'obsolete'} />
            <Field label={editable ? 'Change note (optional)' : 'Change note (required)'} error={errors.change_note}><input className="q-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What changed and why" /></Field>
            <div className="q-actions"><button type="button" className="ntf__btn ntf__btn--primary" disabled={busy || !dirty || open.row.status === 'obsolete'} onClick={saveText}>{editable ? 'Save changes' : `Save as version ${(latest?.version || 0) + 1}`}</button></div>
          </div>

          <div className="q-box">
            <h3>Details</h3>
            <div className="q-form">
              <Field label="Title" wide><input className="q-input" value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} /></Field>
              <Field label="Type"><Select value={meta.doc_type} onChange={(v) => setMeta({ ...meta, doc_type: v })} options={TYPES} /></Field>
              <Field label="Review every (months)"><input className="q-input" type="number" min="1" max="60" value={meta.review_months} onChange={(e) => setMeta({ ...meta, review_months: e.target.value })} /></Field>
              <Field label="Owner" wide><input className="q-input" value={meta.owner_name} onChange={(e) => setMeta({ ...meta, owner_name: e.target.value })} /></Field>
              <Field label="Clauses it supports" wide><ClauseMulti value={meta.clauses} onChange={(v) => setMeta({ ...meta, clauses: v })} /></Field>
            </div>
            <div className="q-actions"><button type="button" className="ntf__btn" disabled={busy} onClick={saveMeta}>Save details</button></div>
          </div>

          <div className="q-box">
            <h3>Version history</h3>
            <table className="ntf__table">
              <thead><tr><th>Version</th><th>Status</th><th>Change</th><th>Approved</th></tr></thead>
              <tbody>
                {open.versions.map((v) => (
                  <tr key={v.id} className="q-click" onClick={() => setViewV(viewV?.id === v.id ? null : v)}>
                    <td className="q-no">v{v.version}</td><td><Chip value={v.status} /></td><td>{v.change_note || ''}<span className="q-sub">{fmtTime(v.created_at)}</span></td><td>{v.approved_at ? fmtTime(v.approved_at) : ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {viewV && <div className="q-doc q-doc--read">{viewV.content || '(empty)'}</div>}
          </div>

          <div className="q-box">
            <h3>Trail</h3>
            <ul className="q-trail">{open.trail.length === 0 && <li>No history yet.</li>}{open.trail.map((t, i) => <li key={i}><b>{t.action}</b> · {fmtTime(t.created_at)}</li>)}</ul>
          </div>
        </Panel>
      )}
    </div>
  );
}
