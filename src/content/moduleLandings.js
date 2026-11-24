// Copy and settings for the two product landing pages: /qms (Certify.cx QMS) and /erp (Certify.cx ERP).
// One page component (src/pages/modules/ModuleLanding.jsx) renders either entry.
//
// Each feature carries a status: 'live' (works today) or 'soon' (being built). The page shows that badge, so
// the page never claims something that is not there yet. Change a status here when a feature ships.
//
// Prices: the subscription is separate for each module (a client can take one and add the other later).
// Prices are NOT decided yet, so `monthly` and `yearly` are null and the page shows "Price on request".
// Set a number (US dollars) and the page shows it. The checkout and billing are the backend developer's part.

export const MODULE_PLANS = {
  qms: { monthly: null, yearly: null },
  erp: { monthly: null, yearly: null },
};

export const LANDINGS = {
  qms: {
    key: 'qms',
    path: '/qms',
    other: 'erp',
    name: 'Certify.cx QMS',
    badge: 'Quality Management System',
    title: 'A quality management system that is always audit ready',
    lead: 'Certify.cx QMS builds and runs your quality management system around the requirements of ISO 9001, with the documents, records and evidence an auditor asks for, in one place.',
    cta: 'Request early access',
    stats: [
      ['ISO 9001', 'Clause-by-clause readiness'],
      ['1 click', 'Audit evidence pack'],
      ['0 paper', 'Records kept for you'],
    ],
    featuresTitle: 'Everything your ISO 9001 audit looks at',
    featuresLead: 'Each part of the system follows a clause of the standard, so nothing is missed on audit day.',
    features: [
      { icon: 'FileText', title: 'Document control and SOPs', text: 'Controlled documents with versions, owners, approvals and review dates. People always see the current copy.', clause: 'Clause 7.5', status: 'soon' },
      { icon: 'TriangleAlert', title: 'Non-conformance and CAPA', text: 'Record a problem, find the root cause, assign corrective and preventive actions and follow them to closure.', clause: 'Clause 10.2', status: 'soon' },
      { icon: 'ClipboardCheck', title: 'Internal audits', text: 'Plan the audit programme, use clause checklists, record findings and track the fixes.', clause: 'Clause 9.2', status: 'soon' },
      { icon: 'ListChecks', title: 'Risk and opportunity register', text: 'Keep risks and opportunities in one live register with owners, ratings and actions.', clause: 'Clause 6.1', status: 'soon' },
      { icon: 'ChartColumn', title: 'Management review and KPIs', text: 'Quality objectives and KPIs feed the management review, and decisions are recorded for the auditor.', clause: 'Clauses 6.2 and 9.3', status: 'soon' },
      { icon: 'GraduationCap', title: 'Training and competence', text: 'Who needs which skill, who has it and when it expires, with reminders before it does.', clause: 'Clause 7.2', status: 'soon' },
      { icon: 'Truck', title: 'Supplier evaluation', text: 'Approve suppliers, score them and keep their certificates on file.', clause: 'Clause 8.4', status: 'soon' },
      { icon: 'FolderCheck', title: 'Audit pack', text: 'Collect the documents, records and evidence for any clause into one pack for the auditor.', clause: 'All clauses', status: 'soon' },
    ],
    stepsTitle: 'From zero to audit ready',
    steps: [
      ['Set up', 'Choose the standard and the scope of your system.'],
      ['Generate', 'The system creates the policies, procedures and registers the standard needs.'],
      ['Run', 'Your team works in the system, so records are made as you go.'],
      ['Audit', 'Share the audit pack with your certification body.'],
    ],
    note: 'Certify.cx QMS supports ISO 9001. The standard is revised from time to time, and the system follows the edition your certification body audits you against.',
  },

  erp: {
    key: 'erp',
    path: '/erp',
    other: 'qms',
    name: 'Certify.cx ERP',
    badge: 'Enterprise Resource Planning',
    title: 'One system for finance, stock, purchasing and people',
    lead: 'Certify.cx ERP brings accounting, inventory, procurement, HR and assets together. The books follow IFRS and every entry is double-checked by the system.',
    cta: 'Request early access',
    stats: [
      ['IFRS', 'Chart of accounts'],
      ['Double entry', 'Checked by the database'],
      ['Per entity', 'Separate ledgers'],
    ],
    featuresTitle: 'Run the whole business from one place',
    featuresLead: 'Start with finance today. The other modules are added one by one.',
    features: [
      { icon: 'Landmark', title: 'Finance and accounting', text: 'IFRS chart of accounts, journal posting with approval, trial balance and general ledger. Debits always equal credits.', clause: 'Available now', status: 'live' },
      { icon: 'Boxes', title: 'Inventory and supply chain', text: 'Stock levels, warehouses and suppliers in one place.', clause: 'In development', status: 'soon' },
      { icon: 'ShoppingCart', title: 'Procurement and vendor evaluation', text: 'Purchase orders and approvals, with supplier certificates checked before an order goes out.', clause: 'In development', status: 'soon' },
      { icon: 'Users', title: 'HR and training', text: 'Employee records, skills and training gaps, with reminders for renewals.', clause: 'In development', status: 'soon' },
      { icon: 'Wrench', title: 'Assets and calibration', text: 'Equipment, maintenance and calibration schedules with records.', clause: 'In development', status: 'soon' },
      { icon: 'ChartColumn', title: 'Financial statements', text: 'Balance sheet, income statement and cash flow built from the ledger.', clause: 'In development', status: 'soon' },
    ],
    stepsTitle: 'How it works',
    steps: [
      ['Choose', 'Pick the ERP module for your workspace.'],
      ['Set up', 'Add your entity and start from a ready IFRS chart of accounts.'],
      ['Work', 'Post entries, track stock and purchases, manage people.'],
      ['Report', 'See the trial balance and ledgers at any time.'],
    ],
    note: 'Finance and accounting is available now. The other ERP modules are being built and are marked "Coming soon" until they are ready.',
  },
};
