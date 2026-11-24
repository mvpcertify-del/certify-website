import { useEffect, useState } from 'react';
import { Printer } from 'lucide-react';
import { Alerts } from './qmsUi';
import { call, fmtDate, fmtTime, label } from './qmsLib';

// QMS > Audit pack (Super Admin): everything an auditor asks for in one printable page, built live from the records.
// Use the browser's Print, then "Save as PDF". The pack shows what the system holds. It does not decide whether the
// organisation passes: the certification body does that.

export default function QmsAuditPack() {
  const [d, setD] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    call('qms-pack').then(setD).catch((e) => setError(e.message || 'Could not build the audit pack.'));
  }, []);

  const approvedDocs = d ? d.documents.filter((x) => x.approved_version != null && x.status !== 'obsolete') : [];

  return (
    <div className="page-container ntf">
      <div className="page-header q-noprint">
        <div>
          <h1 className="page-title">Audit pack</h1>
          <p className="page-subtitle">All documents, records and evidence, clause by clause, built from the live system. Print it or save it as a PDF for the auditor.</p>
        </div>
        <div className="ntf__actions"><button type="button" className="ntf__btn ntf__btn--primary" onClick={() => window.print()} disabled={!d}><Printer size={15} /> Print or save as PDF</button></div>
      </div>
      <Alerts error={error} />
      {!d && !error && <p className="ntf__muted">Building the pack...</p>}

      {d && (
        <div className="qp">
          <section>
            <h1 style={{ margin: 0 }}>Quality Management System: audit pack</h1>
            <p>Certify.cx™ — Global Compliance Marketplace<br />Standard: {d.edition}<br />Generated {fmtTime(d.generated_at)}<br />Readiness score: <b>{d.percent}%</b> ({d.readiness.filter((r) => r.level === 'ready').length} of {d.readiness.length} clauses ready)</p>
            <p>This pack lists what the system holds today. Clauses marked "In progress" or "Not started" are missing a document or a record, shown in the last column.</p>
          </section>

          <section>
            <h2>1. Clause by clause</h2>
            <table>
              <thead><tr><th>Clause</th><th>Requirement</th><th>Status</th><th>Approved documents</th><th>Still needed</th></tr></thead>
              <tbody>{d.readiness.map((r) => (
                <tr key={r.no}><td>{r.no}</td><td>{r.title}</td><td>{label(r.level)}</td><td>{r.documents.join(', ')}</td><td>{r.missing.join(', ')}</td></tr>
              ))}</tbody>
            </table>
          </section>

          <section>
            <h2>2. Document register</h2>
            <table>
              <thead><tr><th>Number</th><th>Title</th><th>Type</th><th>Clauses</th><th>Approved version</th><th>Approved on</th><th>Next review</th><th>Status</th></tr></thead>
              <tbody>{d.documents.map((x) => (
                <tr key={x.id}><td>{x.doc_no}</td><td>{x.title}</td><td>{label(x.doc_type)}</td><td>{(x.clauses || []).join(', ')}</td><td>{x.approved_version != null ? `v${x.approved_version}` : '-'}</td><td>{x.approval?.approved_at ? fmtDate(x.approval.approved_at) : '-'}</td><td>{fmtDate(x.next_review)}</td><td>{label(x.status)}</td></tr>
              ))}</tbody>
            </table>
            <p>{approvedDocs.length} approved of {d.documents.length} documents.</p>
          </section>

          <section>
            <h2>3. Internal audits</h2>
            {d.audits.length === 0 && <p>No audits recorded.</p>}
            {d.audits.map((a) => (
              <div key={a.id}>
                <h3>{a.audit_no} {a.title} ({label(a.status)})</h3>
                <p>Planned {fmtDate(a.planned_date) || '-'}, completed {fmtDate(a.completed_date) || '-'}. Lead auditor: {a.lead_auditor || '-'}. Area: {a.auditee || '-'}. Clauses: {(a.clauses || []).join(', ') || '-'}.{a.summary ? ` Summary: ${a.summary}` : ''}</p>
                {a.findings.length > 0 && <table><thead><tr><th>Clause</th><th>Type</th><th>Finding</th><th>Evidence</th></tr></thead><tbody>{a.findings.map((f) => <tr key={f.id}><td>{f.clause}</td><td>{label(f.kind)}</td><td>{f.statement}</td><td>{f.evidence}</td></tr>)}</tbody></table>}
              </div>
            ))}
          </section>

          <section>
            <h2>4. Nonconformities and corrective actions</h2>
            {d.nonconformities.length === 0 && <p>No nonconformities recorded.</p>}
            {d.nonconformities.map((n) => (
              <div key={n.id}>
                <h3>{n.nc_no} {n.title} ({label(n.status)}, {n.severity})</h3>
                <p>Source: {label(n.source)}. Clause: {n.clause || '-'}. Due: {fmtDate(n.due_date) || '-'}. {n.closed_at ? `Closed ${fmtDate(n.closed_at)}.` : ''}<br />Root cause: {n.root_cause || '-'}<br />Effectiveness check: {n.effectiveness_note || '-'}</p>
                {n.actions.length > 0 && <table><thead><tr><th>Type</th><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr></thead><tbody>{n.actions.map((a) => <tr key={a.id}><td>{label(a.kind)}</td><td>{a.description}</td><td>{a.owner_name}</td><td>{fmtDate(a.due_date)}</td><td>{label(a.status)}</td></tr>)}</tbody></table>}
              </div>
            ))}
          </section>

          <section>
            <h2>5. Risks and opportunities</h2>
            <table>
              <thead><tr><th>Number</th><th>Type</th><th>Title</th><th>Clause</th><th>Score</th><th>Treatment</th><th>Owner</th><th>Status</th></tr></thead>
              <tbody>{d.risks.length === 0 && <tr><td colSpan={8}>None recorded.</td></tr>}{d.risks.map((r) => <tr key={r.id}><td>{r.risk_no}</td><td>{label(r.kind)}</td><td>{r.title}</td><td>{r.clause}</td><td>{r.score}</td><td>{r.treatment}</td><td>{r.owner_name}</td><td>{label(r.status)}</td></tr>)}</tbody>
            </table>
          </section>

          <section>
            <h2>6. Quality objectives and KPIs</h2>
            <table>
              <thead><tr><th>Objective</th><th>Period</th><th>Target</th><th>Actual</th><th>Owner</th></tr></thead>
              <tbody>{d.kpis.length === 0 && <tr><td colSpan={5}>None recorded.</td></tr>}{d.kpis.map((k) => <tr key={k.id}><td>{k.name}</td><td>{k.period}</td><td>{k.direction === 'lower' ? '<= ' : '>= '}{k.target ?? '-'} {k.unit}</td><td>{k.actual ?? '-'} {k.unit}</td><td>{k.owner_name}</td></tr>)}</tbody>
            </table>
          </section>

          <section>
            <h2>7. Management reviews</h2>
            {d.reviews.length === 0 && <p>No reviews recorded.</p>}
            {d.reviews.map((r) => (
              <div key={r.id}>
                <h3>{r.review_no} on {fmtDate(r.review_date)} ({label(r.status)})</h3>
                <p>Attendees: {r.attendees || '-'}<br />Customer feedback: {r.customer_feedback || '-'}<br />External providers: {r.provider_performance || '-'}<br />Resources: {r.resources || '-'}<br />Decisions: {r.decisions || '-'}</p>
              </div>
            ))}
          </section>

          <section>
            <h2>8. External providers (suppliers)</h2>
            {d.suppliers.length === 0 && <p>None recorded.</p>}
            {d.suppliers.length > 0 && (
              <table>
                <thead><tr><th>Number</th><th>Supplier</th><th>Type</th><th>Certificate</th><th>Valid until</th><th>Latest evaluation</th><th>Status</th></tr></thead>
                <tbody>{d.suppliers.map((s) => { const e = s.evaluations[0]; return <tr key={s.id}><td>{s.supplier_no}</td><td>{s.name}</td><td>{label(s.category)}</td><td>{s.certificate_name}</td><td>{fmtDate(s.certificate_expiry)}</td><td>{e ? `${fmtDate(e.evaluated_on)}: ${e.score} / 5` : '-'}</td><td>{label(s.status)}</td></tr>; })}</tbody>
              </table>
            )}
          </section>

          <section>
            <h2>9. Training and competence</h2>
            <table>
              <thead><tr><th>Person</th><th>Role</th><th>Training or qualification</th><th>Type</th><th>Completed</th><th>Expires</th><th>Status</th></tr></thead>
              <tbody>{d.training.length === 0 && <tr><td colSpan={7}>None recorded.</td></tr>}{d.training.map((t) => <tr key={t.id}><td>{t.person_name}</td><td>{t.role}</td><td>{t.training_title}</td><td>{label(t.kind)}</td><td>{fmtDate(t.completed_on)}</td><td>{fmtDate(t.expires_on)}</td><td>{label(t.status)}</td></tr>)}</tbody>
            </table>
          </section>

          <section>
            <h2>10. Equipment and calibration</h2>
            <table>
              <thead><tr><th>Number</th><th>Equipment</th><th>Location</th><th>Last calibrated</th><th>Next due</th><th>Calibrations</th><th>Status</th></tr></thead>
              <tbody>{d.equipment.length === 0 && <tr><td colSpan={7}>None recorded.</td></tr>}{d.equipment.map((e) => <tr key={e.id}><td>{e.equipment_no}</td><td>{e.name}</td><td>{e.location}</td><td>{fmtDate(e.last_calibrated)}</td><td>{fmtDate(e.next_due)}</td><td>{e.calibrations.map((c) => `${fmtDate(c.calibrated_on)} ${c.result}`).join('; ')}</td><td>{label(e.status)}</td></tr>)}</tbody>
            </table>
          </section>

          <section>
            <h2>11. Customer feedback and complaints</h2>
            <table>
              <thead><tr><th>Number</th><th>Date</th><th>Customer</th><th>Subject</th><th>Type</th><th>Rating</th><th>Status</th><th>Response</th></tr></thead>
              <tbody>{d.feedback.length === 0 && <tr><td colSpan={8}>None recorded.</td></tr>}{d.feedback.map((f) => <tr key={f.id}><td>{f.feedback_no}</td><td>{fmtDate(f.received_on)}</td><td>{f.customer_name}</td><td>{f.subject}</td><td>{label(f.kind)}</td><td>{f.rating ?? ''}</td><td>{label(f.status)}</td><td>{f.response}</td></tr>)}</tbody>
            </table>
          </section>

          <section>
            <h2>12. Change trail (latest 300 entries)</h2>
            <table>
              <thead><tr><th>When</th><th>Record</th><th>Reference</th><th>Action</th></tr></thead>
              <tbody>{d.trail.map((t, i) => <tr key={i}><td>{fmtTime(t.created_at)}</td><td>{label(t.entity)}</td><td>{t.ref}</td><td>{t.action}</td></tr>)}</tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}
