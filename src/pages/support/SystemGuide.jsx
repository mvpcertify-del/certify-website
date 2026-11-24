import { Link } from 'react-router-dom';
import { Printer } from 'lucide-react';
import '../admin/AdminNotifications.css';
import './SystemGuide.css';

// Support > Help & System Guide (Super Admin): a plain-English guide to the QMS and the ERP finance module, so a reader who
// did not build them can understand what they do, test them in ten minutes and see exactly what is live and what is not.
// Keep it true: when a feature ships, move it from "coming" to "live" below.

const QMS_PAGES = [
  ['QMS Overview', '/qms/overview', 'Shows how ready Certify.cx is for an ISO 9001 audit, clause by clause, as a percentage. This is also where the ISO 9001 documents are created.', 'The readiness score and what is still missing.'],
  ['Document Control & SOPs', '/qms/documents', 'Holds the policy and procedures. Each document has versions. Someone reviews and approves it. An approved version is locked.', 'Who approved which version and when.'],
  ['Non-Conformance & CAPA', '/qms/capa', 'Records a problem, the root cause, the corrective actions and the check that the fix worked.', 'That problems are fixed at the cause, not just patched.'],
  ['Internal Audits', '/qms/audits', 'Plans our own audits, records findings clause by clause, and turns a finding into a nonconformity with one click.', 'That we audit ourselves every year.'],
  ['Risks & Objectives', '/qms/risks', 'The risk and opportunity register with a heat map, and our quality targets (KPIs) against the actual results.', 'That we think about risk and measure results.'],
  ['Suppliers', '/qms/suppliers', 'Approved outside providers (certification bodies, auditors, hosting, payment). Needs a recent evaluation score of at least 3 out of 5.', 'That providers are checked before we use them.'],
  ['Training & Competence', '/qms/training', 'Who has which training or certificate, and when it expires.', 'That people are competent for their role.'],
  ['Equipment & Calibration', '/qms/equipment', 'Measuring equipment and its calibration dates. A failed calibration takes the item out of service.', 'That measurements can be trusted.'],
  ['Customer Feedback', '/qms/feedback', 'Complaints, praise and ratings. A complaint can start a corrective action.', 'That we listen to customers and respond.'],
  ['Management Review & KPIs', '/qms/management-review', 'The yearly review by top management. One click collects the facts from the other pages.', 'That top management is involved.'],
  ['Audit Pack', '/qms/audit-pack', 'All the above in one printable report, clause by clause. Save it as a PDF for the auditor.', 'Everything in one place.'],
];

const NEEDS = [
  ['Every clause (4.1 to 10.3)', 'An approved document'],
  ['6.1 Risks and opportunities', '+ at least one entry in the risk register'],
  ['6.2 Quality objectives', '+ at least one KPI'],
  ['7.2 Competence', '+ at least one completed training record'],
  ['8.4 External providers', '+ at least one approved supplier'],
  ['9.1 Monitoring and measurement', '+ a KPI with a result, and customer feedback on record'],
  ['9.2 Internal audit', '+ at least one completed internal audit'],
  ['9.3 Management review', '+ at least one held management review'],
];

const RULES = [
  'An approved document cannot be edited. A change creates a new version and the old one is kept.',
  'A nonconformity cannot be closed without a root cause, completed actions and a check that the fix worked.',
  'An audit cannot be completed without findings or a summary. A held review needs recorded decisions.',
  'A supplier cannot be approved without a recent good evaluation. Evaluations cannot be edited.',
  'Feedback cannot be resolved without a response to the customer.',
  'Every change is written to a history (who, what, when) that cannot be edited or deleted.',
  'Journals: debits must equal credits, and a posted journal can only be corrected by a reversal.',
];

const STEPS = [
  ['Open the QMS Overview', '/qms/overview', 'You will see 0% and a list of clauses.'],
  ['Click "Generate ISO 9001 documents"', '/qms/overview', '19 documents are created as drafts. Nothing is approved yet, so the score stays low.'],
  ['Open one document and approve it', '/qms/documents', 'Open it, click "Send for review", then "Approve". Go back to the Overview: the clauses it covers turn Ready.'],
  ['Add a risk', '/qms/risks', 'Add one risk. Clause 6.1 now has its record.'],
  ['Plan an audit and add a finding', '/qms/audits', 'Add a finding of type "Minor NC", then click "Raise NC". A nonconformity appears in CAPA.'],
  ['Try to close the nonconformity', '/qms/capa', 'The system refuses until you add a root cause, an action marked done, and an effectiveness check. That is the rule working.'],
  ['Open the Audit Pack', '/qms/audit-pack', 'Everything you entered is in one report. Print or save it as a PDF.'],
];

const LIVE = [
  ['QMS: documents, CAPA, audits, risks, KPIs, review, suppliers, training, equipment, feedback, audit pack', true],
  ['ERP Finance: Chart of Accounts (IFRS), journals with approval, trial balance, general ledger', true],
  ['ERP Finance: financial statements (profit or loss, financial position)', true],
  ['Landing pages: certify.cx/qms and certify.cx/erp', true],
  ['Subscriptions per module, and billing for QMS and ERP', false],
  ['ERP: cash flow statement, AR and AP, bank reconciliation, budgets, fixed assets and depreciation, period closing', false],
  ['ERP: inventory, procurement, HR', false],
];

export default function SystemGuide() {
  return (
    <div className="page-container ntf sg">
      <div className="page-header sg__noprint">
        <div>
          <h1 className="page-title">System guide: QMS and ERP</h1>
          <p className="page-subtitle">A plain guide to what Certify.cx QMS and ERP do, how to test them in ten minutes, and what is live today.</p>
        </div>
        <div className="ntf__actions"><button type="button" className="ntf__btn" onClick={() => window.print()}><Printer size={15} /> Print or PDF</button></div>
      </div>

      <nav className="sg__toc sg__noprint" aria-label="On this page">
        {[['what', 'What it is'], ['test', 'Test it in 10 minutes'], ['qms', 'QMS pages'], ['score', 'The audit-ready score'], ['rules', 'Rules it enforces'], ['erp', 'ERP finance'], ['status', 'Live and not yet'], ['team', 'What the team must do']].map(([id, t]) => <a key={id} href={`#${id}`}>{t}</a>)}
      </nav>

      <section id="what" className="sg__sec">
        <h2>What it is</h2>
        <p><b>QMS</b> (Quality Management System) is a register of proof. An ISO 9001 auditor asks for the policy, the procedures, who approved them, the internal audit, how problems were fixed and whether management reviewed it all. The QMS keeps that proof in one place, so audit day is a report, not a search.</p>
        <p><b>ERP</b> is the business system. Today its Finance part is live: an IFRS chart of accounts, journals that need approval, a trial balance, the ledger and financial statements.</p>
        <p className="sg__callout">The system records the work. It does not do the work. The team still has to read and approve the documents, run the audit and hold the review. Only then is Certify.cx audit ready.</p>
      </section>

      <section id="test" className="sg__sec">
        <h2>Test the QMS in 10 minutes</h2>
        <p>Log in as Super Admin and follow these steps. Each link opens the page.</p>
        <ol className="sg__steps">
          {STEPS.map(([t, to, x]) => <li key={t}><Link to={to}>{t}</Link><span>{x}</span></li>)}
        </ol>
      </section>

      <section id="qms" className="sg__sec">
        <h2>QMS pages</h2>
        <div className="ntf__table-wrap">
          <table className="ntf__table sg__table">
            <thead><tr><th>Page</th><th>What it does</th><th>What the auditor sees</th></tr></thead>
            <tbody>{QMS_PAGES.map(([n, to, w, a]) => <tr key={n}><td><Link to={to}>{n}</Link></td><td>{w}</td><td>{a}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <section id="score" className="sg__sec">
        <h2>How the audit-ready score works</h2>
        <p>ISO 9001 has 28 sub-clauses (4.1 to 10.3). The Overview shows each one as Ready, In progress or Not started. Nobody can tick a clause by hand. The system checks the records itself:</p>
        <div className="ntf__table-wrap">
          <table className="ntf__table sg__table">
            <thead><tr><th>Clause</th><th>Needs</th></tr></thead>
            <tbody>{NEEDS.map(([c, n]) => <tr key={c}><td>{c}</td><td>{n}</td></tr>)}</tbody>
          </table>
        </div>
        <p>A draft document, a planned audit or a pending supplier does not count. The score reaches 100% only when the documents are approved and all these records exist. The edition used is ISO 9001:2015.</p>
      </section>

      <section id="rules" className="sg__sec">
        <h2>Rules the system enforces</h2>
        <p>These are checked by the database itself, so nobody can skip them from the screen.</p>
        <ul className="sg__list">{RULES.map((r) => <li key={r}>{r}</li>)}</ul>
      </section>

      <section id="erp" className="sg__sec">
        <h2>ERP finance</h2>
        <ol className="sg__steps">
          <li><Link to="/finance/chart-of-accounts">Chart of Accounts</Link><span>The Certify.cx master chart, IFRS edition. 215 accounts, each with its normal balance (Dr or Cr) and IFRS class. New accounts can be added. Existing codes never change.</span></li>
          <li><Link to="/finance/journals">Journals & Ledger</Link><span>Create a journal (or use a template for a marketplace payment or a subscription). It is a draft until someone approves and posts it. A posted journal is corrected only by a reversal. Also has the trial balance and the general ledger.</span></li>
          <li><Link to="/finance/statements">Financial Statements</Link><span>Profit or loss (IFRS 18 categories) and the financial position, built only from posted journals. A check shows that assets equal liabilities plus equity.</span></li>
        </ol>
        <p><b>Test it:</b> in Journals, create a marketplace template journal and post it. Then open Financial Statements. The amounts appear and the balance check turns green.</p>
        <p className="sg__callout">There are no year-end closing entries yet, so the result of the period shows in equity as "Result not yet closed to retained earnings".</p>
      </section>

      <section id="status" className="sg__sec">
        <h2>What is live and what is not yet</h2>
        <ul className="sg__status">{LIVE.map(([t, live]) => <li key={t} className={live ? 'is-live' : ''}><em>{live ? 'Live' : 'Not yet'}</em>{t}</li>)}</ul>
      </section>

      <section id="team" className="sg__sec">
        <h2>What the Certify.cx team must do to be audit ready</h2>
        <ol className="sg__list sg__list--num">
          <li>Generate the documents, read each one, adapt it to how Certify.cx really works, and approve it.</li>
          <li>Add the risks, quality targets and their results.</li>
          <li>Add suppliers and evaluate them. Add training records. Add customer feedback.</li>
          <li>Run an internal audit and close the nonconformities it finds.</li>
          <li>Hold the management review, record the decisions, then open the Audit Pack.</li>
        </ol>
        <p>Two decisions are needed from management: the ISO 9001 edition to follow (2015 today), and the price of each module subscription.</p>
      </section>
    </div>
  );
}
