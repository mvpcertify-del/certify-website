// QMS master data: the clauses of ISO 9001 and the library of documents the QMS generates for an organisation.
//
// The edition is a setting (EDITION). The clause structure (4 to 10) is the common high-level structure, so this list holds
// for ISO 9001:2015 and is meant to be revised, not rebuilt, if a new edition changes the numbering. Document drafts are
// written for Certify.cx. They are DRAFTS: the organisation reads them, adapts them and approves them. Nothing here is
// legal or certification advice, and generating the documents does not make anyone certified.

export const EDITION = 'ISO 9001:2015';

// needs: what the system must hold before a clause counts as "ready".
//   doc     at least one approved document tagged with the clause (every clause has one in TEMPLATES)
//   risk    at least one entry in the risk and opportunity register
//   kpi     at least one quality objective / KPI
//   kpiData at least one KPI with an actual value recorded
//   audit   at least one completed internal audit
//   review  at least one held management review
export const CLAUSES = [
  ['4.1', 'Understanding the organization and its context', ['doc']],
  ['4.2', 'Understanding the needs and expectations of interested parties', ['doc']],
  ['4.3', 'Determining the scope of the quality management system', ['doc']],
  ['4.4', 'Quality management system and its processes', ['doc']],
  ['5.1', 'Leadership and commitment', ['doc']],
  ['5.2', 'Quality policy', ['doc']],
  ['5.3', 'Organizational roles, responsibilities and authorities', ['doc']],
  ['6.1', 'Actions to address risks and opportunities', ['doc', 'risk']],
  ['6.2', 'Quality objectives and planning to achieve them', ['doc', 'kpi']],
  ['6.3', 'Planning of changes', ['doc']],
  ['7.1', 'Resources', ['doc']],
  ['7.2', 'Competence', ['doc']],
  ['7.3', 'Awareness', ['doc']],
  ['7.4', 'Communication', ['doc']],
  ['7.5', 'Documented information', ['doc']],
  ['8.1', 'Operational planning and control', ['doc']],
  ['8.2', 'Requirements for products and services', ['doc']],
  ['8.3', 'Design and development of products and services', ['doc']],
  ['8.4', 'Control of externally provided processes, products and services', ['doc']],
  ['8.5', 'Production and service provision', ['doc']],
  ['8.6', 'Release of products and services', ['doc']],
  ['8.7', 'Control of nonconforming outputs', ['doc']],
  ['9.1', 'Monitoring, measurement, analysis and evaluation', ['doc', 'kpiData']],
  ['9.2', 'Internal audit', ['doc', 'audit']],
  ['9.3', 'Management review', ['doc', 'review']],
  ['10.1', 'Improvement: general', ['doc']],
  ['10.2', 'Nonconformity and corrective action', ['doc']],
  ['10.3', 'Continual improvement', ['doc']],
].map(([no, title, needs]) => ({ no, title, needs }));

const ORG = 'Certify.cx™ — Global Compliance Marketplace';

// Builds the markdown body of a document from its parts.
function doc({ purpose, scope, roles, steps, records }) {
  const list = (a, ordered) => a.map((x, i) => `${ordered ? `${i + 1}.` : '-'} ${x}`).join('\n');
  return [
    '## 1. Purpose', purpose, '',
    '## 2. Scope', scope, '',
    '## 3. Responsibilities', list(roles), '',
    '## 4. Procedure', list(steps, true), '',
    '## 5. Records kept', list(records), '',
    `_Draft prepared for ${ORG}. Review, adapt and approve before use._`,
  ].join('\n');
}

const ROLE_QM = 'The Quality Manager keeps this document current and checks that it is followed.';
const ROLE_TM = 'Top management approves it and provides the resources to run it.';

export const TEMPLATES = [
  { doc_no: 'QMS-MAN-01', title: 'Quality Manual', doc_type: 'manual', clauses: ['4.1', '4.2', '4.3', '4.4'],
    content: doc({
      purpose: `Describes the quality management system (QMS) of ${ORG} and how it meets ISO 9001.`,
      scope: `${ORG} runs an online marketplace and workflow that connects organisations with accredited certification bodies, lead auditors and compliance tools. The QMS covers the platform, the customer journey from enquiry to certificate, partner onboarding, support and the supporting finance and IT processes. Exclusions, if any, are listed here with the reason. Update this scope when the business changes.`,
      roles: [ROLE_TM, ROLE_QM, 'Process owners run their process and report on it.'],
      steps: ['List the external and internal issues that affect the QMS (market, regulation, technology, partners) and review them each year (4.1).', 'List the interested parties (customers, certification bodies, auditors, regulators, staff, investors) and their needs (4.2).', 'Define the scope above and keep it available as documented information (4.3).', 'Map the main processes, their inputs, outputs, owners and links, and the measures for each (4.4).'],
      records: ['Context and interested parties register', 'Process map', 'Management review minutes'],
    }) },
  { doc_no: 'QMS-POL-01', title: 'Quality Policy', doc_type: 'policy', clauses: ['5.1', '5.2'],
    content: doc({
      purpose: 'States the commitment of top management to quality and to continual improvement.',
      scope: 'Applies to everyone who works for or on behalf of the organisation.',
      roles: ['Top management sets and signs the policy and shows leadership by reviewing it and its results.', ROLE_QM],
      steps: ['The policy fits the purpose and context of the organisation and gives a frame for quality objectives.', 'It commits the organisation to meet applicable requirements and to improve the QMS continually.', 'It is communicated to all staff, understood, and made available to interested parties on request.', 'It is reviewed at each management review.'],
      records: ['Signed policy statement', 'Evidence of communication (induction and training records)'],
    }) },
  { doc_no: 'QMS-ROL-01', title: 'Roles, Responsibilities and Authorities', doc_type: 'procedure', clauses: ['5.3'],
    content: doc({
      purpose: 'Makes sure responsibilities and authorities for the QMS are assigned and understood.',
      scope: 'All roles that affect quality, including the Quality Manager and process owners.',
      roles: [ROLE_TM, 'The Quality Manager reports on QMS performance to top management and promotes customer focus.'],
      steps: ['Define each role, who holds it and what it may decide.', 'Appoint a Quality Manager with authority to ensure the QMS meets ISO 9001 and to report on its performance.', 'Communicate the roles and review them when the structure changes.'],
      records: ['Organisation chart', 'Role descriptions', 'Appointment of the Quality Manager'],
    }) },
  { doc_no: 'QMS-PRC-01', title: 'Risks and Opportunities', doc_type: 'procedure', clauses: ['6.1'],
    content: doc({
      purpose: 'Identifies and handles the risks and opportunities that affect the QMS and the quality of service.',
      scope: 'All processes of the QMS.',
      roles: ['Process owners identify and rate risks in their process.', ROLE_QM],
      steps: ['Record each risk or opportunity in the register with a clear description and the clause or process it affects.', 'Rate likelihood and impact from 1 to 5. The score is likelihood multiplied by impact.', 'Decide the treatment (reduce, accept, avoid, share, or pursue the opportunity) and give an owner and a date.', 'Review high scores every quarter and all items at least once a year.', 'Check the effectiveness of each action.'],
      records: ['Risk and opportunity register', 'Action records'],
    }) },
  { doc_no: 'QMS-PRC-02', title: 'Quality Objectives and KPIs', doc_type: 'procedure', clauses: ['6.2', '9.1'],
    content: doc({
      purpose: 'Sets measurable quality objectives and tracks them with KPIs.',
      scope: 'Relevant functions and processes.',
      roles: [ROLE_TM, 'Process owners report results each period.'],
      steps: ['Set objectives consistent with the quality policy, measurable, monitored and communicated.', 'For each objective state what will be done, who is responsible, the resources and the date.', 'Record the target and the actual result for each period in the KPI list.', 'Review the results at management review and act where a target is missed.'],
      records: ['Objectives and KPI list with actual values', 'Management review minutes'],
    }) },
  { doc_no: 'QMS-PRC-03', title: 'Planning of Changes', doc_type: 'procedure', clauses: ['6.3'],
    content: doc({
      purpose: 'Makes sure changes to the QMS are planned and do not harm its integrity.',
      scope: 'Changes to processes, systems, structure or the platform that affect quality.',
      roles: ['The change owner plans the change.', ROLE_QM],
      steps: ['Describe the change and why it is needed.', 'Assess the effect on the QMS, risks, resources and responsibilities.', 'Approve, carry out and review the change.'],
      records: ['Change request and approval'],
    }) },
  { doc_no: 'QMS-PRC-04', title: 'Resources, Competence and Awareness', doc_type: 'procedure', clauses: ['7.1', '7.2', '7.3'],
    content: doc({
      purpose: 'Provides the people, infrastructure and knowledge the QMS needs, and makes sure people are competent and aware.',
      scope: 'All staff and contractors whose work affects quality, and the equipment and tools they use.',
      roles: ['Managers define the competence needed for each role.', 'HR keeps training records.', ROLE_QM],
      steps: ['Define the competence needed for each role (education, skills, experience).', 'Check each person against it and plan training where there is a gap.', 'Keep evidence of competence and of training.', 'Make people aware of the quality policy, their contribution and the effect of not following the QMS.', 'Keep infrastructure and any monitoring or measuring equipment suitable and, where needed, calibrated.'],
      records: ['Competence matrix', 'Training records', 'Calibration and maintenance records'],
    }) },
  { doc_no: 'QMS-PRC-05', title: 'Communication', doc_type: 'procedure', clauses: ['7.4'],
    content: doc({
      purpose: 'Defines what is communicated, when, to whom, how and by whom, about the QMS.',
      scope: 'Internal communication and communication with customers and partners.',
      roles: ['Process owners communicate on their process.', ROLE_QM],
      steps: ['List the topics (policy, objectives, changes, incidents, customer notices).', 'For each, define audience, channel, frequency and owner.', 'Keep a record of important communications.'],
      records: ['Communication plan', 'Notices and meeting records'],
    }) },
  { doc_no: 'QMS-PRC-06', title: 'Control of Documented Information', doc_type: 'procedure', clauses: ['7.5'],
    content: doc({
      purpose: 'Controls how documents and records are created, approved, updated, kept and removed.',
      scope: 'All documents and records of the QMS.',
      roles: ['Authors draft and update.', 'An approver, who is not required to be the author, approves.', ROLE_QM],
      steps: ['Each document has a number, title, owner, version and review date.', 'A draft is reviewed and approved before use. The approval records who and when.', 'A change creates a new version. The earlier version is kept as superseded.', 'Only the current approved version is in use. Obsolete versions are marked and kept for the retention period.', 'Documents are reviewed at least once a year.', 'Records are protected, kept for the stated period and can be found when needed.'],
      records: ['Document register with versions and approvals', 'Change history'],
    }) },
  { doc_no: 'QMS-PRC-07', title: 'Operational Planning and Control', doc_type: 'procedure', clauses: ['8.1'],
    content: doc({
      purpose: 'Plans and controls the processes needed to deliver the service.',
      scope: 'The service delivery processes of the platform.',
      roles: ['Process owners plan and control their process.', ROLE_QM],
      steps: ['Define the requirements, criteria and resources for each process.', 'Run the process to the criteria and keep the records.', 'Control planned changes and review the effect of unplanned ones.', 'Control outsourced processes.'],
      records: ['Process criteria', 'Operational records'],
    }) },
  { doc_no: 'QMS-PRC-08', title: 'Customer Requirements and Communication', doc_type: 'procedure', clauses: ['8.2'],
    content: doc({
      purpose: 'Makes sure customer requirements are understood and can be met before they are accepted.',
      scope: 'Enquiries, quotations, orders and changes from customers.',
      roles: ['The sales and support teams handle enquiries and orders.', ROLE_QM],
      steps: ['Give clear information on services and prices (for example the published certification packages).', 'Confirm the requirements, including any not stated by the customer but needed.', 'Check that the organisation can meet them before accepting.', 'Handle changes and keep the record.', 'Receive and handle customer feedback and complaints.'],
      records: ['Orders and confirmations', 'Customer communications', 'Complaint records'],
    }) },
  { doc_no: 'QMS-PRC-09', title: 'Design and Development of the Platform', doc_type: 'procedure', clauses: ['8.3'],
    content: doc({
      purpose: 'Controls how new features and services of the platform are planned, built, checked and released.',
      scope: 'Design and development of the web platform and its services.',
      roles: ['The product owner sets the requirements.', 'Developers build and test.', ROLE_QM],
      steps: ['Define the requirements and inputs, including legal and customer needs.', 'Plan the stages, reviews and responsibilities.', 'Review, verify and validate the result before release.', 'Control the changes during and after development and keep the records.'],
      records: ['Requirements', 'Review and test records', 'Release approval'],
    }) },
  { doc_no: 'QMS-PRC-10', title: 'Control of External Providers', doc_type: 'procedure', clauses: ['8.4'],
    content: doc({
      purpose: 'Makes sure services and products from outside providers meet requirements.',
      scope: 'Certification bodies, auditors, contractors, hosting, payment and email providers and other suppliers.',
      roles: ['The owner of each relationship evaluates and monitors it.', ROLE_QM],
      steps: ['Set the criteria to select, evaluate and re-evaluate providers (for example accreditation status, certificates, performance).', 'Approve providers before use and keep the evidence.', 'Tell providers clearly what is required.', 'Monitor performance and act on problems.'],
      records: ['Approved provider list', 'Evaluation records', 'Provider certificates'],
    }) },
  { doc_no: 'QMS-PRC-11', title: 'Service Provision, Release and Nonconforming Outputs', doc_type: 'procedure', clauses: ['8.5', '8.6', '8.7'],
    content: doc({
      purpose: 'Controls delivery of the service, its release to the customer and the handling of outputs that do not meet requirements.',
      scope: 'The customer journey from application to certificate delivery and support.',
      roles: ['Service owners deliver and release.', ROLE_QM],
      steps: ['Deliver under controlled conditions, with clear instructions and monitoring.', 'Identify and trace each application, and look after customer property such as documents and data.', 'Release only after the planned checks are done and record who released it.', 'Identify an output that does not conform, stop it, correct it and record what was done.', 'Raise a nonconformity when the cause must be fixed (see QMS-PRC-16).'],
      records: ['Application and delivery records', 'Release records', 'Nonconforming output records'],
    }) },
  { doc_no: 'QMS-PRC-12', title: 'Customer Satisfaction and Monitoring', doc_type: 'procedure', clauses: ['9.1'],
    content: doc({
      purpose: 'Monitors customer perception and the performance of the QMS.',
      scope: 'Customers and the processes of the QMS.',
      roles: ['Support collects feedback.', ROLE_QM],
      steps: ['Decide what to monitor and how (for example feedback, complaints, delivery time, audit results).', 'Collect the information and analyse it.', 'Use the results as input to management review.'],
      records: ['Feedback and survey results', 'KPI results'],
    }) },
  { doc_no: 'QMS-PRC-13', title: 'Internal Audit', doc_type: 'procedure', clauses: ['9.2'],
    content: doc({
      purpose: 'Checks at planned intervals that the QMS meets the requirements and is working.',
      scope: 'All parts of the QMS.',
      roles: ['The Quality Manager plans the audit programme.', 'Auditors are objective and impartial and do not audit their own work.', 'Area owners fix the findings.'],
      steps: ['Plan an audit programme that covers every clause and process within the year, based on importance and past results.', 'Define the scope and criteria for each audit and use the clause checklist.', 'Record findings as conformity, observation, minor or major nonconformity or opportunity, with evidence.', 'Report to the area owner and raise a nonconformity for each minor or major finding.', 'Follow the actions until they are closed and verify them.'],
      records: ['Audit programme', 'Audit reports and findings', 'Nonconformity and action records'],
    }) },
  { doc_no: 'QMS-PRC-14', title: 'Management Review', doc_type: 'procedure', clauses: ['9.3'],
    content: doc({
      purpose: 'Top management reviews the QMS at planned intervals to make sure it stays suitable, adequate, effective and aligned.',
      scope: 'The whole QMS.',
      roles: ['Top management leads the review.', 'The Quality Manager prepares the inputs.'],
      steps: ['Hold the review at least once a year.', 'Inputs: status of earlier actions, changes in context, performance (customer satisfaction, objectives, process results, nonconformities, audit results, provider performance), adequacy of resources, effectiveness of risk actions and opportunities for improvement.', 'Outputs: decisions on improvement, any change to the QMS and resource needs.', 'Record the decisions, owners and dates, and follow them.'],
      records: ['Management review record with inputs and decisions'],
    }) },
  { doc_no: 'QMS-PRC-15', title: 'Improvement', doc_type: 'procedure', clauses: ['10.1', '10.3'],
    content: doc({
      purpose: 'Looks for and acts on opportunities to improve the service and the QMS.',
      scope: 'All processes.',
      roles: ['Everyone may suggest an improvement.', 'Top management decides priorities.'],
      steps: ['Collect improvement ideas from audits, feedback, KPIs, risks and staff.', 'Assess, decide and plan the action.', 'Review the result and keep the record.'],
      records: ['Improvement log', 'Management review decisions'],
    }) },
  { doc_no: 'QMS-PRC-16', title: 'Nonconformity and Corrective Action', doc_type: 'procedure', clauses: ['10.2'],
    content: doc({
      purpose: 'Reacts to nonconformities, removes their cause and stops them from coming back.',
      scope: 'Nonconformities from audits, customers, processes and providers.',
      roles: ['Anyone may report a nonconformity.', 'The owner finds the cause and carries out the action.', ROLE_QM],
      steps: ['Record the nonconformity and take immediate action to control and correct it.', 'Find the root cause.', 'Decide and carry out the corrective action, and check whether similar problems could happen elsewhere.', 'Check that the action worked before closing. A nonconformity is closed only with a recorded cause, completed actions and an effectiveness check.', 'Update risks and the QMS if needed.'],
      records: ['Nonconformity records with cause, actions and effectiveness check'],
    }) },
];
