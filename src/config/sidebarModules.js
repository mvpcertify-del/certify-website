import {
  Sparkles, LayoutDashboard, Users, Briefcase, Megaphone, Settings, CreditCard, Scale,
  CheckCircle2, Building2, Puzzle, Shield, LifeBuoy, UsersRound,
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

export const ZONES = [
  {
    id: 'core',
    label: 'CORE PLATFORM MODULES',
    modules: [
      {
        id: 'exec_dashboard',
        label: 'Executive Dashboard',
        icon: LayoutDashboard,
        path: '/main-dashboard',
      },
      {
        id: 'system_users',
        label: 'System & Users',
        icon: Shield,
        roles: [ROLES.SUPER_ADMIN],
        items: [
          { id: 'su_permissions', label: 'User Access & Permissions', path: '/admin/permissions' },
          { id: 'su_users', label: 'Users', path: '/admin/users' },
          { id: 'su_delegations', label: 'Sub-Admin Delegations', path: '/admin/regional-admins' },
          { id: 'su_tenant', label: 'Tenant & Account Settings', path: '/system/tenant', soon: true,
            blurb: 'Workspace identity, branding, billing contact and account-level settings for the tenant.' },
          { id: 'su_user_fields', label: 'User Fields', path: '/admin/user-fields' },
          { id: 'su_app_fields', label: 'Application Fields', path: '/admin/application-fields' },
          { id: 'su_countries', label: 'Countries & Regions', path: '/admin/countries' },
        ],
      },
      {
        id: 'crm',
        label: 'CRM',
        icon: Users,
        agent: 'Nora AI',
        items: [
          { id: 'crm_outreach', label: 'Lead & Outreach Hub', path: '/crm/outreach', soon: true,
            blurb: 'Leads handed over from Marketing, with approved English and local-language email sequences and automated follow-ups.' },
          { id: 'crm_accounts', label: 'Enterprise Accounts', path: '/admin/companies' },
          { id: 'crm_consultancy', label: 'Consultancy Network', path: '/admin/consultancies' },
          { id: 'crm_cert_bodies', label: 'Certification Bodies', path: '/admin/cert-bodies' },
          { id: 'crm_auditors', label: 'Auditors', path: '/admin/auditors' },
          { id: 'crm_contractors', label: 'Contractor Directory', path: '/admin/contractors' },
          { id: 'crm_referral_partners', label: 'Referral Partners', path: '/admin/referral-partners' },
          { id: 'crm_investors', label: 'Investors', path: '/admin/investors' },
          { id: 'crm_messages', label: 'Messages', path: '/messages' },
        ],
      },
      {
        id: 'sales',
        label: 'Sales',
        icon: Briefcase,
        agent: 'Leo AI',
        items: [
          { id: 'sales_inquiries', label: 'Marketplace Inquiries', path: '/sales/inquiries', soon: true,
            blurb: 'Every inquiry arriving from the marketplace, with its status and owner.' },
          { id: 'sales_proposals', label: 'Quotes & Proposals', path: '/sales/proposals', soon: true,
            blurb: 'US$ proposals drafted from headcount, locations and standards, with the cancellation policy built in.' },
          { id: 'sales_pipeline', label: 'Deal Conversion Pipeline', path: '/sales/pipeline', soon: true,
            blurb: 'Deals from inquiry to paid order, with follow-up prompts for proposals not yet opened.' },
          { id: 'sales_revenue', label: 'Revenue & Commissions', path: '/admin/sales' },
          { id: 'sales_tiers', label: 'Commission Tiers', path: '/admin/commission-tiers' },
          { id: 'sales_coupons', label: 'Coupons', path: '/admin/coupons' },
        ],
      },
      {
        id: 'marketing',
        label: 'Marketing',
        icon: Megaphone,
        agent: 'Maya AI',
        items: [
          { id: 'mkt_lead_gen', label: 'Lead Generation Pipelines', path: '/marketing/lead-gen', soon: true,
            blurb: 'Target companies by country, sector and ISO need, verified and handed to the CRM outreach hub.' },
          { id: 'mkt_campaigns', label: 'Platform Campaigns', path: '/marketing/campaigns', soon: true,
            blurb: 'Which links, invitations and partners bring in the best-converting leads.' },
          { id: 'mkt_affiliates', label: 'Affiliate & Referral Campaigns', path: '/marketing/affiliates', soon: true,
            blurb: 'Referral links and promotional copy for registered affiliates, with attribution.' },
          { id: 'mkt_referral_dashboard', label: 'Referral Program Dashboard', path: '/referral-dashboard' },
          { id: 'mkt_content', label: 'Content & Resource Hub', path: '/admin/outreach-docs' },
          { id: 'mkt_links', label: 'Shareable Links', path: '/admin/shareable-links' },
        ],
      },
      {
        id: 'operations',
        label: 'Operations',
        icon: Settings,
        agent: 'Omar AI',
        items: [
          { id: 'ops_certification_dashboard', label: 'Certification Dashboard', path: '/dashboard' },
          { id: 'ops_applications', label: 'Applications', path: '/admin/applications' },
          { id: 'ops_calendars', label: 'Audit Calendars & Workflows', path: '/operations/calendars', soon: true,
            blurb: 'Audit schedules and workflow stages, with conflict detection and suggested reschedules.' },
          { id: 'ops_vetting', label: 'Verification & Vetting', path: '/admin/registrations' },
          { id: 'ops_contractor_matrix', label: 'Contractor Matrix', path: '/operations/contractor-matrix', soon: true,
            blurb: 'Contractor evidence checked against monthly KPIs before payouts are approved.' },
          { id: 'ops_frameworks', label: 'Standards & ISO Frameworks', path: '/operations/frameworks', soon: true,
            blurb: 'The standards and ISO frameworks the platform supports, and the requirements behind each.' },
        ],
      },
      {
        id: 'finance',
        label: 'Finance',
        icon: CreditCard,
        agent: 'Ziad AI',
        restricted: true,
        items: [
          { id: 'fin_payment_approvals', label: 'Contractor Payment Approvals', path: '/finance/payments' },
          { id: 'fin_billing', label: 'Billing & Invoices', path: '/admin/billing' },
          { id: 'fin_payouts', label: 'Referral Payouts', path: '/admin/payouts' },
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
        ],
      },
      {
        id: 'legal',
        label: 'Legal & Compliance',
        icon: Scale,
        agent: 'Layla AI',
        restricted: true,
        items: [
          { id: 'leg_cb_registry', label: 'Certification Body Registry', path: '/admin/cb-registry' },
          { id: 'leg_accreditation', label: 'Accreditation Bodies', path: '/admin/accreditation-bodies' },
          { id: 'leg_vault', label: 'Corporate Vault', path: '/legal/corporate-vault', soon: true,
            blurb: 'Restricted storage for corporate documents, with access logging.' },
          { id: 'leg_vetting', label: 'Partner Vetting & Vouching', path: '/legal/vetting', soon: true,
            blurb: 'Accreditation certificates, registries and insurance checked for authenticity and expiry.' },
          { id: 'leg_contracts', label: 'Contract Lifecycle (CLM)', path: '/legal/contracts', soon: true,
            blurb: 'Drafting, approval, signature and renewal of contracts and tri-party NDAs.' },
        ],
      },
    ],
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
          { id: 'qms_docs', label: 'Document Control & SOPs', path: '/qms/documents', soon: true,
            blurb: 'Controlled documents and SOPs with versions, approvals and expiry alerts.' },
          { id: 'qms_capa', label: 'Non-Conformance & CAPA', path: '/qms/capa', soon: true,
            blurb: 'Record non-conformances and run corrective and preventive actions to closure.' },
          { id: 'qms_audits', label: 'Internal Audits & Risk Register', path: '/qms/audits', soon: true,
            blurb: 'Plan internal audits and keep the risk register current.' },
          { id: 'qms_review', label: 'Management Review & KPIs', path: '/qms/management-review', soon: true,
            blurb: 'Management review inputs, decisions and the KPIs behind them.' },
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
  {
    id: 'system',
    label: 'SYSTEM & GOVERNANCE',
    modules: [
      {
        id: 'subscriptions',
        label: 'Modules & Subscriptions',
        icon: Puzzle,
        path: '/billing/modules',
        soon: true,
        blurb: 'Switch modules on or off and manage monthly or yearly plans for each client workspace.',
      },
      {
        id: 'admin_settings',
        label: 'Admin & Settings',
        icon: UsersRound,
        items: [
          { id: 'set_profile', label: 'My Profile', path: '/profile' },
          { id: 'set_notifications', label: 'Notifications', path: '/notifications' },
          { id: 'set_currency', label: 'Currency & FX Rate Engine', path: '/settings/currency', soon: true,
            blurb: 'Base currency and exchange rates used across quotes, invoices and reports.' },
          { id: 'set_logs', label: 'System Audit Logs', path: '/settings/logs', soon: true,
            blurb: 'Who did what, and when, across the platform.' },
        ],
      },
      {
        id: 'support',
        label: 'Support',
        icon: LifeBuoy,
        agent: 'Sami AI',
        items: [
          { id: 'sup_docs', label: 'SOPs & Help Documentation', path: '/support/docs', soon: true,
            blurb: 'Help articles and internal SOPs for using each module.' },
          { id: 'sup_status', label: 'Platform & API Status', path: '/support/status', soon: true,
            blurb: 'Current status of the platform and its integrations.' },
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
  return allModules().find(
    (m) => (m.path && hit(m.path)) || (m.items || []).some((it) => hit(it.path)),
  );
}
