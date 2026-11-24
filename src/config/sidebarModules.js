import {
  Sparkles, LayoutDashboard, LayoutGrid, Briefcase, Megaphone, CreditCard,
  CheckCircle2, Building2, Puzzle, Shield, LifeBuoy,
} from 'lucide-react';
import { ROLES } from '../utils/roles';

// ============================================================================
// Certify.cx — Module registry for the left-hand menu
// ============================================================================
// The menu is rendered from this structure, not hard-coded in JSX, so a new
// module (or a whole new zone) is added by adding an entry here. It follows the
// shape of the client's "database-driven sidebar" schema (zones → modules →
// sub-modules, an AI agent per module, restricted / upsell flags) so that when
// the registry moves into a `modules_registry` table, only the loader changes.
//
// Vocabulary (client, 8 Nov): the departments are "Modules" — one system, one
// database — not "Apps". The platform is Certify.cx; Sara AI sits above the
// modules as the orchestrator, with one specialist agent per module.
//
// Item fields
//   id      stable key; also the i18n key suffix  (modules.<id>)
//   label   English text, used as the i18n default
//   path    route. Existing screens point at their real route.
//   soon    true → no screen is built yet; the route renders a "coming soon"
//           page (UI/UX only, no data) instead of a 404. Remove the flag when
//           the real screen ships and point `path` at it.
//   blurb   one line on what the screen will do, shown on the coming-soon page
//
// Module fields
//   agent       the Sara sub-agent shown as a chip beside the module
//   restricted  shows a lock (Finance, Legal: sensitive, extra-gated)
//   upsell      subscription-gated module: shows "Upgrade", opens a preview
//   roles       who sees it (defaults to every role the module menu serves)
//
// Phase note: only the Main Admin (super_admin) gets this menu today. The
// department sub-admin roles in the client's design (CRM, Sales, Marketing,
// Operations, Finance, Legal sub-admins) do not exist yet; when they do, they
// are added to `roles` here and to utils/roles.js.

/** Roles served by the module menu. Everyone else keeps the flat menu. */
export const MODULE_MENU_ROLES = [ROLES.SUPER_ADMIN];

/** The master orchestrator, pinned above the zones. */
export const SARA = {
  id: 'sara',
  label: 'Sara AI Command Center',
  icon: Sparkles,
  items: [
    { id: 'sara_activity', label: 'Live Agent Activity', path: '/sara-ai/activity', soon: true,
      blurb: 'A real-time feed of every action Sara and her specialist agents take across the divisions.' },
    { id: 'sara_approvals', label: 'Approval & Escalation Queue', path: '/sara-ai/approvals', soon: true,
      blurb: 'Human sign-off for sensitive actions: partial refunds, partner credentials, contractor payouts, final contracts.' },
    { id: 'sara_guardrails', label: 'Agent Rules & Guardrails', path: '/sara-ai/guardrails', soon: true,
      blurb: 'Set how much each agent may do on its own, and the compliance limits it must stay inside.' },
  ],
};

// ---------------------------------------------------------------------------
// The six departments (client, 18 Nov): the approved structure is Sara, then six AI
// Department Heads, then 49 specialised agents. Every existing page sits inside the
// department it belongs to. A department opens to: its Department Head, its AI agents,
// (Marketing only, for now) its functions, and the existing pages. An agent with no screen
// yet shows "Soon" and opens a placeholder workspace; activate it later by dropping `soon`
// and pointing `path` at the real screen.
// ---------------------------------------------------------------------------
const head = (dept, label, blurb) => ({ id: `${dept}_head`, label, path: `/${dept}/head`, soon: true, blurb });

// [slug, label, optional live path] -> menu items. The blurb is generic until the agent is built.
const agents = (dept, deptLabel, list) => list.map(([slug, label, path]) => (
  path
    ? { id: `${dept}_a_${slug}`, label, path }
    : {
      id: `${dept}_a_${slug}`, label, path: `/${dept}/agents/${slug}`, soon: true,
      blurb: `${label}: its own workspace, tasks and reports, supervised by the ${deptLabel} Department Head.`,
    }
));

const heading = (id, text) => ({ id, heading: text });

const DEPARTMENTS_RAW = [
  {
    id: 'dept_marketing',
    path: '/department/marketing',
    label: '01. Marketing',
    icon: Megaphone,
    items: [
      heading('mkt_h_head', 'DEPARTMENT HEAD'),
      head('marketing', 'AI Marketing Department Head', 'Monthly marketing strategy, agent task allocation, campaign supervision, budget monitoring and weekly and monthly reports.'),
      heading('mkt_h_agents', 'AI AGENTS'),
      ...agents('marketing', 'Marketing', [
        ['digital', 'Digital Marketing Agent'],
        ['social', 'Social Media Agent'],
        ['email', 'Email Marketing Agent', '/admin/outreach'],
        ['content', 'Content Marketing Agent'],
        ['paid', 'Paid Advertising Agent'],
        ['partnerships', 'Partnerships & Affiliates Agent'],
        ['events', 'Events & Webinars Agent'],
      ]),
      heading('mkt_h_functions', 'DEPARTMENT FUNCTIONS'),
      ...agents('marketing', 'Marketing', [
        ['crm', 'Marketing CRM & Lead Management'],
        ['budget', 'Marketing Budget & ROI'],
        ['integrations', 'Integrations & Automation'],
        ['governance', 'Governance & Approvals'],
      ]).map((it) => ({ ...it, id: it.id.replace('_a_', '_f_'), path: it.path.replace('/agents/', '/functions/') })),
      heading('mkt_h_pages', 'PAGES'),
      { id: 'mkt_lead_gen', label: 'Lead Generation Pipelines', path: '/marketing/lead-gen', soon: true,
        blurb: 'Target companies by country, sector and ISO need, verified and handed to the sales outreach hub.' },
      { id: 'mkt_campaigns', label: 'Platform Campaigns', path: '/marketing/campaigns', soon: true,
        blurb: 'Which links, invitations and partners bring in the best-converting leads.' },
      { id: 'mkt_affiliates', label: 'Affiliate & Referral Campaigns', path: '/marketing/affiliates', soon: true,
        blurb: 'Referral links and promotional copy for registered affiliates, with attribution.' },
      { id: 'mkt_referral_dashboard', label: 'Affiliate Program Dashboard', path: '/referral-dashboard' },
      { id: 'mkt_content', label: 'Briefing Documents', path: '/admin/outreach-docs' },
      { id: 'mkt_links', label: 'Shareable Links', path: '/admin/shareable-links' },
    ],
  },
  {
    id: 'dept_sales',
    path: '/department/sales',
    label: '02. Sales',
    icon: Briefcase,
    items: [
      heading('sales_h_head', 'DEPARTMENT HEAD'),
      head('sales', 'AI Sales Department Head', 'Sales targets, agent task allocation, pipeline supervision and weekly and monthly sales reports.'),
      heading('sales_h_agents', 'AI AGENTS'),
      ...agents('sales', 'Sales', [
        ['lead-qualification', 'Lead Generation & Qualification Agent'],
        ['outreach', 'Sales Outreach Agent'],
        ['pipeline', 'Sales Pipeline Agent'],
        ['packages', 'Product & Package Recommendation Agent'],
        ['pricing', 'Pricing & Proposal Agent'],
        ['conversion', 'Sales Conversion Agent'],
        ['referral', 'Referral Sales Agent'],
      ]),
      heading('sales_h_pages', 'PAGES'),
      { id: 'sales_micro_offers', label: 'Micro Offer Requests', path: '/admin/micro-offers' },
      { id: 'crm_outreach', label: 'Lead & Outreach Hub', path: '/crm/outreach', soon: true,
        blurb: 'Leads handed over from Marketing, with approved English and local-language email sequences and automated follow-ups.' },
      { id: 'sales_inquiries', label: 'Marketplace Inquiries', path: '/sales/inquiries', soon: true,
        blurb: 'Every inquiry arriving from the marketplace, with its status and owner.' },
      { id: 'sales_proposals', label: 'Quotes & Proposals', path: '/sales/proposals', soon: true,
        blurb: 'US$ proposals drafted from headcount, locations and standards, with the cancellation policy built in.' },
      { id: 'sales_pipeline', label: 'Deal Conversion Pipeline', path: '/sales/pipeline', soon: true,
        blurb: 'Deals from inquiry to paid order, with follow-up prompts for proposals not yet opened.' },
      { id: 'sales_revenue', label: 'Sales', path: '/admin/sales' },
      { id: 'sales_tiers', label: 'Commission Tiers', path: '/admin/commission-tiers' },
      { id: 'sales_coupons', label: 'Discount Coupons', path: '/admin/coupons' },
      { id: 'crm_referral_partners', label: 'Affiliates', path: '/admin/referral-partners' },
    ],
  },
  {
    id: 'dept_customer_service',
    path: '/department/customer-service',
    label: '03. Customer Service',
    icon: LifeBuoy,
    items: [
      heading('cs_h_head', 'DEPARTMENT HEAD'),
      head('customer-service', 'AI Customer Service Department Head', 'Customer satisfaction, agent task allocation, escalations and weekly and monthly service reports.'),
      heading('cs_h_agents', 'AI AGENTS'),
      ...agents('customer-service', 'Customer Service', [
        ['sara-assistant', 'Sara Customer Assistant Agent'],
        ['onboarding', 'Customer Onboarding Agent'],
        ['support', 'Customer Support Agent'],
        ['technical', 'Technical Support Agent'],
        ['communication', 'Customer Communication Agent', '/admin/notifications'],
        ['escalation', 'Complaints & Escalation Agent'],
        ['retention', 'Customer Retention Agent'],
      ]),
      heading('cs_h_pages', 'PAGES'),
      { id: 'crm_messages', label: 'Messages', path: '/messages' },
      { id: 'crm_accounts', label: 'Clients', path: '/admin/companies' },
      { id: 'sup_docs', label: 'SOPs & Help Documentation', path: '/support/docs', soon: true,
        blurb: 'Help articles and internal SOPs for using each module.' },
      { id: 'sup_status', label: 'Platform & API Status', path: '/support/status', soon: true,
        blurb: 'Current status of the platform and its integrations.' },
    ],
  },
  {
    id: 'dept_operations',
    path: '/department/operations',
    label: '04. Operations & Compliance',
    icon: CheckCircle2,
    items: [
      heading('ops_h_head', 'DEPARTMENT HEAD'),
      head('operations', 'AI Operations & Compliance Department Head', 'Certification workload, agent task allocation, compliance supervision and weekly and monthly operations reports.'),
      heading('ops_h_agents', 'AI AGENTS'),
      ...agents('operations', 'Operations & Compliance', [
        ['iso-9001', 'ISO 9001 Compliance Agent'],
        ['iso-27001', 'ISO 27001 Compliance Agent'],
        ['iso-22000', 'ISO 22000 Compliance Agent'],
        ['other-standards', 'Other Standards Compliance Agent'],
        ['evidence', 'Document & Evidence Management Agent'],
        ['internal-audit', 'Internal Audit & Readiness Agent'],
        ['nonconformity', 'Nonconformity & Corrective Action Agent'],
        ['risk', 'Risk & Regulatory Intelligence Agent'],
        ['contractors', 'Contractor & Service Provider Agent'],
        ['cb-coordination', 'Certification Body Coordination Agent'],
        ['scheduling', 'Compliance Scheduling Agent'],
      ]),
      heading('ops_h_pages', 'PAGES'),
      { id: 'ops_certification_dashboard', label: 'Dashboard', path: '/dashboard' },
      { id: 'ops_applications', label: 'Applications', path: '/admin/applications' },
      { id: 'ops_vetting', label: 'Registrations', path: '/admin/registrations' },
      { id: 'crm_auditors', label: 'Auditors', path: '/admin/auditors' },
      { id: 'crm_cert_bodies', label: 'CB Accounts', path: '/admin/cert-bodies' },
      { id: 'leg_cb_registry', label: 'CB Registry', path: '/admin/cb-registry' },
      { id: 'leg_accreditation', label: 'Accreditation Bodies', path: '/admin/accreditation-bodies' },
      { id: 'ops_calendars', label: 'Audit Calendars & Workflows', path: '/operations/calendars', soon: true,
        blurb: 'Audit schedules and workflow stages, with conflict detection and suggested reschedules.' },
      { id: 'ops_contractor_matrix', label: 'Contractor Matrix', path: '/operations/contractor-matrix', soon: true,
        blurb: 'Contractor evidence checked against monthly KPIs before payouts are approved.' },
      { id: 'ops_frameworks', label: 'Standards & ISO Frameworks', path: '/operations/frameworks', soon: true,
        blurb: 'The standards and ISO frameworks the platform supports, and the requirements behind each.' },
    ],
  },
  {
    id: 'dept_administration',
    path: '/department/administration',
    label: '05. Administration',
    icon: Shield,
    items: [
      heading('adm_h_head', 'DEPARTMENT HEAD'),
      head('administration', 'AI Administration Department Head', 'Accounts, partners, contracts and platform governance, agent task allocation and weekly and monthly reports.'),
      heading('adm_h_agents', 'AI AGENTS'),
      ...agents('administration', 'Administration', [
        ['users', 'User & Account Administration Agent'],
        ['contractors', 'Contractor Administration Agent'],
        ['partners', 'Partner Administration Agent'],
        ['contracts', 'Contracts & NDA Agent'],
        ['documents', 'Document Governance Agent'],
        ['platform', 'Platform Administration Agent'],
        ['security', 'Security & Access Governance Agent'],
        ['reporting', 'Performance & Reporting Agent'],
      ]),
      heading('adm_h_pages', 'PAGES'),
      { id: 'su_users', label: 'Users', path: '/admin/users' },
      { id: 'su_permissions', label: 'Roles & Permissions', path: '/admin/permissions' },
      { id: 'su_delegations', label: 'Country Admins', path: '/admin/regional-admins' },
      { id: 'crm_contractors', label: 'Contractors', path: '/admin/contractors' },
      { id: 'crm_consultancy', label: 'Consultancies', path: '/admin/consultancies' },
      { id: 'crm_investors', label: 'Investors', path: '/admin/investors' },
      { id: 'su_user_fields', label: 'Custom User Fields', path: '/admin/user-fields' },
      { id: 'su_app_fields', label: 'Custom App Fields', path: '/admin/application-fields' },
      { id: 'su_countries', label: 'Countries', path: '/admin/countries' },
      { id: 'set_profile', label: 'My Profile', path: '/profile' },
      { id: 'set_notifications', label: 'Notifications', path: '/notifications' },
      { id: 'su_tenant', label: 'Tenant & Account Settings', path: '/system/tenant', soon: true,
        blurb: 'Workspace identity, branding, billing contact and account-level settings for the tenant.' },
      { id: 'leg_vault', label: 'Corporate Vault', path: '/legal/corporate-vault', soon: true,
        blurb: 'Restricted storage for corporate documents, with access logging.' },
      { id: 'leg_vetting', label: 'Partner Vetting & Vouching', path: '/legal/vetting', soon: true,
        blurb: 'Accreditation certificates, registries and insurance checked for authenticity and expiry.' },
      { id: 'leg_contracts', label: 'Contract Lifecycle (CLM)', path: '/legal/contracts', soon: true,
        blurb: 'Drafting, approval, signature and renewal of contracts and tri-party NDAs.' },
      { id: 'set_logs', label: 'System Audit Logs', path: '/settings/logs', soon: true,
        blurb: 'Who did what, and when, across the platform.' },
    ],
  },
  {
    id: 'dept_finance',
    path: '/department/finance',
    label: '06. Finance',
    icon: CreditCard,
    restricted: true,
    items: [
      heading('fin_h_head', 'DEPARTMENT HEAD'),
      head('finance', 'AI Finance Department Head', 'Revenue, spending and risk across the platform, agent task allocation and weekly and monthly financial reports.'),
      heading('fin_h_agents', 'AI AGENTS'),
      ...agents('finance', 'Finance', [
        ['revenue', 'Revenue & Sales Accounting Agent'],
        ['payments', 'Payment Processing Agent'],
        ['invoicing', 'Invoicing Agent'],
        ['subscriptions', 'Subscription & Renewal Agent'],
        ['contractor-pay', 'Contractor Payment Agent'],
        ['commissions', 'Affiliate Commission Agent'],
        ['budget', 'Budget & Expenditure Agent'],
        ['reporting', 'Financial Reporting Agent'],
        ['fraud', 'Fraud & Financial Risk Agent'],
      ]),
      heading('fin_h_pages', 'PAGES'),
      { id: 'fin_coa', label: 'Chart of Accounts', path: '/finance/chart-of-accounts' },
      { id: 'fin_journals', label: 'Journals & Ledger', path: '/finance/journals' },
      { id: 'fin_payment_approvals', label: 'Payment Approvals', path: '/finance/payments' },
      { id: 'fin_billing', label: 'Billing', path: '/admin/billing' },
      { id: 'fin_payouts', label: 'Payouts', path: '/admin/payouts' },
      { id: 'fin_treasury', label: 'Treasury & Cash Flow', path: '/finance/treasury', soon: true,
        blurb: 'Cash position and flow across gateways and accounts.' },
      { id: 'fin_profitability', label: 'Project Profitability', path: '/finance/profitability', soon: true,
        blurb: 'US$ revenue less gateway, auditor, contractor and ad costs, with a margin alert.' },
      { id: 'fin_statements', label: 'Statement Upload Center', path: '/finance/statements', soon: true,
        blurb: 'Upload bank statements and match lines to open invoices and gateway payouts.' },
      { id: 'fin_refunds', label: 'Disputes & Refunds', path: '/finance/refunds', soon: true,
        blurb: 'Cancellation requests checked against the 30-day policy, with the deduction calculated.' },
      { id: 'fin_gateways', label: 'Gateway Integrations', path: '/finance/gateways', soon: true,
        blurb: 'Connected payment gateways and their status.' },
      { id: 'set_currency', label: 'Currency & FX Rate Engine', path: '/settings/currency', soon: true,
        blurb: 'Base currency and exchange rates used across quotes, invoices and reports.' },
    ],
  },
];

// Client (18 Nov): inside each department the working pages come first and everything that is
// still "coming soon" goes below them (soon pages, then the Department Head and the AI agents).
function working_first(d) {
  const sections = [];
  let cur = null;
  for (const it of d.items) {
    if (it.heading) { cur = { head: it, list: [] }; sections.push(cur); } else cur.list.push(it);
  }
  const live = sections.flatMap((sec) => sec.list.filter((it) => !it.soon));
  const out = [heading(`${d.id}_h_live`, 'WORKING PAGES'), ...live];
  const soonPages = sections.filter((sec) => sec.head.heading === 'PAGES').flatMap((sec) => sec.list.filter((it) => it.soon));
  if (soonPages.length) out.push(heading(`${d.id}_h_soonpages`, 'COMING SOON: PAGES'), ...soonPages);
  for (const sec of sections) {
    if (sec.head.heading === 'PAGES') continue;
    const soon = sec.list.filter((it) => it.soon);
    if (soon.length) out.push(heading(`${d.id}_h_soon_${sec.head.id}`, `COMING SOON: ${sec.head.heading}`), ...soon);
  }
  return { ...d, items: out };
}
export const DEPARTMENTS = DEPARTMENTS_RAW.map(working_first);

/** URL slug of a department: dept_customer_service becomes customer-service. */
export const departmentSlug = (d) => d.id.replace(/^dept_/, '').replace(/_/g, '-');

// "All Pages" (client, 18 Nov): the working pages from every department in one list, pinned at the
// very top. It only mirrors the department entries (same paths), so it is skipped when matching a
// route to its department and when building the coming-soon routes.
const PAGE_LABEL = { '/admin/outreach': 'Email Marketing (Outreach)', '/admin/notifications': 'Notification Automation' };
const ALL_PAGES = {
  id: 'all_pages',
  label: 'All Pages',
  icon: LayoutGrid,
  mirror: true,
  items: DEPARTMENTS
    .flatMap((d) => d.items)
    .filter((it) => it.path && !it.soon)
    .map((it) => ({ id: `all_${it.id}`, label: PAGE_LABEL[it.path] || it.label, path: it.path }))
    .sort((a, b) => a.label.localeCompare(b.label)),
};

export const ZONES = [
  {
    id: 'core',
    label: 'PLATFORM',
    modules: [
      ALL_PAGES,
      {
        id: 'exec_dashboard',
        label: 'Executive Dashboard',
        icon: LayoutDashboard,
        path: '/main-dashboard',
      },
      // Client (13 Nov): "Modules & Subscriptions" sits right under the Executive Dashboard.
      {
        id: 'subscriptions',
        label: 'Modules & Subscriptions',
        icon: Puzzle,
        path: '/billing/modules',
        soon: true,
        blurb: 'Switch modules on or off and manage monthly or yearly plans for each client workspace.',
      },
    ],
  },
  {
    id: 'departments',
    label: 'SIX MAIN DEPARTMENTS',
    modules: DEPARTMENTS,
  },
  {
    id: 'suite',
    label: 'QMS & ERP SUITE',
    modules: [
      {
        id: 'qms',
        label: 'Quality Management (QMS)',
        icon: CheckCircle2,
        items: [
          { id: 'qms_overview', label: 'QMS Overview', path: '/qms/overview' },
          { id: 'qms_docs', label: 'Document Control & SOPs', path: '/qms/documents' },
          { id: 'qms_capa', label: 'Non-Conformance & CAPA', path: '/qms/capa' },
          { id: 'qms_audits', label: 'Internal Audits', path: '/qms/audits' },
          { id: 'qms_risks', label: 'Risks & Objectives', path: '/qms/risks' },
          { id: 'qms_suppliers', label: 'Suppliers', path: '/qms/suppliers' },
          { id: 'qms_training', label: 'Training & Competence', path: '/qms/training' },
          { id: 'qms_equipment', label: 'Equipment & Calibration', path: '/qms/equipment' },
          { id: 'qms_feedback', label: 'Customer Feedback', path: '/qms/feedback' },
          { id: 'qms_review', label: 'Management Review & KPIs', path: '/qms/management-review' },
          { id: 'qms_pack', label: 'Audit Pack', path: '/qms/audit-pack' },
        ],
      },
      {
        id: 'erp',
        label: 'Enterprise ERP',
        icon: Building2,
        upsell: true,
        items: [
          { id: 'erp_inventory', label: 'Inventory & Supply Chain', path: '/erp/inventory', soon: true,
            blurb: 'Stock, suppliers and the supply chain in one place.' },
          { id: 'erp_procurement', label: 'Procurement & Vendor Eval', path: '/erp/procurement', soon: true,
            blurb: 'Purchasing, with supplier certificates evaluated before an order is approved.' },
          { id: 'erp_hr', label: 'HR & Training Competency', path: '/erp/hr-training', soon: true,
            blurb: 'Employee competence and training gaps, with recertification reminders.' },
          { id: 'erp_assets', label: 'Asset & Calibration Maintenance', path: '/erp/assets', soon: true,
            blurb: 'Equipment, calibration schedules and maintenance records.' },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every module in the menu, Sara first, in display order. */
export function allModules() {
  return [SARA, ...ZONES.flatMap((z) => z.modules)];
}

/** Every item that has no screen yet — App.jsx turns each into a route. */
export function comingSoonItems() {
  const out = [];
  for (const m of allModules()) {
    if (m.mirror) continue;
    if (m.soon && m.path) out.push({ ...m, moduleId: m.id, moduleLabel: m.label, agent: m.agent });
    for (const it of m.items || []) {
      if (it.soon) out.push({ ...it, moduleId: m.id, moduleLabel: m.label, agent: m.agent, upsell: m.upsell });
    }
  }
  return out;
}

/** Does `role` see this module? */
export function moduleVisibleTo(mod, role) {
  return !mod.roles || mod.roles.includes(role);
}

/** The module whose items (or own path) match the current pathname. */
export function moduleForPath(pathname) {
  const hit = (p) => pathname === p || pathname.startsWith(`${p}/`);
  return allModules().filter((m) => !m.mirror).find(
    (m) => (m.path && hit(m.path)) || (m.items || []).some((it) => it.path && hit(it.path)),
  );
}
