import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyPermission, PERMISSIONS, ROLES, getDisplayRoleLabel } from '../../utils/roles';
import {
  LayoutDashboard,
  LayoutGrid,
  Building2,
  FileCheck2,
  FileSignature,
  UserCheck,
  Award,
  ShieldCheck,
  Stamp,
  Building,
  Settings,
  Users,
  LogOut,
  ChevronLeft,
  ChevronRight,
  X,
  PlusCircle,
  User,
  Bell,
  Gift,
  Link2,
  UserPlus,
  Globe,
  Ticket,
  TrendingUp,
  CircleDollarSign,
  KeyRound,
  FormInput,
  ClipboardList,
  Briefcase,
  Receipt,
  ClipboardCheck,
  Search,
  Zap,
} from 'lucide-react';
import BrandLogo from '../ui/BrandLogo';
import LanguageSwitcher from '../LanguageSwitcher';
import './Sidebar.css';

// Menu category markers, requested by the client 24 Jul:
//   VIEW   — this screen only shows information
//   CREATE — this screen is where documents / records are entered
//
// Rendered as lucide icons rather than the literal 🔍/⚡ emoji the client wrote:
// emoji are painted by the OS font, so they change shape between Windows,
// macOS and Android, and the Arabic font stack substitutes them with a
// mismatched glyph. Search/Zap are the same two symbols drawn by the icon set
// the sidebar already uses, so they stay identical in all nine locales.
const KIND_VIEW = 'view';
const KIND_CREATE = 'create';

const KIND_META = {
  [KIND_VIEW]: { Icon: Search, labelKey: 'nav.kindViewOnly' },
  [KIND_CREATE]: { Icon: Zap, labelKey: 'nav.kindDataEntry' },
};

// Eight screens change category depending on who is looking: a super admin can
// add records there, a country admin can only read them. A fixed marker would
// be a lie for one of the two, so `kind` may be a function of the role.
const adminCreates = (role) => (role === ROLES.SUPER_ADMIN ? KIND_CREATE : KIND_VIEW);

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    // Super Admin overview landing — kept at the very top. The role-specific
    // "Certification dashboard" stays available as the next item.
    { path: '/main-dashboard', labelKey: 'nav.mainDashboard', icon: LayoutGrid, kind: KIND_VIEW, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    // Only the client's dashboard takes input (document upload); every other
    // role's branch of this same page is a read-only list.
    { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, kind: (r) => (r === ROLES.CLIENT ? KIND_CREATE : KIND_VIEW), permissions: [PERMISSIONS.VIEW_DASHBOARD] },
    { path: '/client/apply', labelKey: 'nav.newApplication', icon: PlusCircle, kind: KIND_CREATE, permissions: [PERMISSIONS.CREATE_CERTIFICATION] },
    { path: '/client/certificates', labelKey: 'nav.myCertificates', icon: Award, kind: KIND_VIEW, allowedRoles: [ROLES.CLIENT], permissions: [PERMISSIONS.VIEW_DASHBOARD] },
    // ---- Auditor / CB work queues ----
    // These two routes already existed (App.jsx) and are already hard-gated by
    // allowedRoles, but nothing linked to them, so an auditor logging in saw
    // only Dashboard / Profile / Notifications — the 23 Jul bug report.
    // They deliberately do NOT point at /admin/applications: that list applies
    // no assigned_auditor_id or assigned_cb_id filter, so sending an auditor
    // there would show them every client's order in every country.
    { path: '/auditor/dashboard', labelKey: 'nav.myAudits', icon: ClipboardCheck, kind: KIND_CREATE, permissions: [PERMISSIONS.SUBMIT_AUDIT_REPORT], allowedRoles: [ROLES.AUDITOR] },
    { path: '/cert-body/dashboard', labelKey: 'nav.myReviews', icon: ShieldCheck, kind: KIND_CREATE, permissions: [PERMISSIONS.REVIEW_AUDIT_REPORTS], allowedRoles: [ROLES.CERTIFICATION_BODY] },
    { path: '/admin/applications', labelKey: 'nav.applications', icon: FileCheck2, kind: adminCreates, permissions: [PERMISSIONS.VIEW_ALL_CERTIFICATIONS] },
    { path: '/admin/companies', labelKey: 'nav.companies', icon: Building2, kind: adminCreates, permissions: [PERMISSIONS.VIEW_COMPANIES] },
    { path: '/admin/regional-admins', labelKey: 'nav.regionalAdmins', icon: ShieldCheck, kind: adminCreates, permissions: [PERMISSIONS.CREATE_ADMINS] },
    { path: '/admin/auditors', labelKey: 'nav.auditors', icon: UserCheck, kind: adminCreates, permissions: [PERMISSIONS.MANAGE_AUDITORS] },
    { path: '/admin/cert-bodies', labelKey: 'nav.certBodies', icon: Award, kind: adminCreates, permissions: [PERMISSIONS.MANAGE_BODIES] },
    { path: '/admin/cb-registry', labelKey: 'nav.cbRegistry', icon: Building, kind: KIND_CREATE, permissions: [PERMISSIONS.MANAGE_BODIES] },
    { path: '/admin/accreditation-bodies', labelKey: 'nav.accreditationBodies', icon: Stamp, kind: KIND_CREATE, permissions: [PERMISSIONS.MANAGE_BODIES] },
    { path: '/admin/countries', labelKey: 'nav.countries', icon: Globe, kind: KIND_CREATE, permissions: [PERMISSIONS.MANAGE_REGIONS] },
    { path: '/admin/coupons', labelKey: 'nav.coupons', icon: Ticket, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/commission-tiers', labelKey: 'nav.commissionTiers', icon: TrendingUp, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/consultancies', labelKey: 'nav.consultancies', icon: Briefcase, kind: adminCreates, permissions: [PERMISSIONS.MANAGE_USERS] },
    { path: '/admin/sales', labelKey: 'nav.sales', icon: CircleDollarSign, kind: KIND_VIEW, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/billing', labelKey: 'nav.billing', icon: Receipt, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN, ROLES.REGIONAL_ADMIN] },
    { path: '/admin/users', labelKey: 'nav.users', icon: Users, kind: KIND_CREATE, permissions: [PERMISSIONS.CREATE_ADMINS, PERMISSIONS.MANAGE_AUDITORS] },
    // Read-only apart from one per-ISO visibility toggle — not document entry.
    { path: '/admin/shareable-links', labelKey: 'nav.shareableLinks', icon: Link2, kind: KIND_VIEW, permissions: [PERMISSIONS.MANAGE_USERS] },
    { path: '/admin/registrations', labelKey: 'nav.registrations', icon: UserPlus, kind: KIND_CREATE, permissions: [PERMISSIONS.MANAGE_USERS] },
    { path: '/admin/permissions', labelKey: 'nav.permissions', icon: KeyRound, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/user-fields', labelKey: 'nav.userFields', icon: FormInput, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/application-fields', labelKey: 'nav.applicationFields', icon: ClipboardList, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    // Referral partners (their own role since phase 14) and consultancy
    // partners (phase 22) both get the partner dashboard here — same screen,
    // different commercial terms. Admins manage referrals via Commission Tiers.
    { path: '/referrals', labelKey: 'nav.referrals', icon: Gift, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_REFERRALS], allowedRoles: [ROLES.REFERRAL, ROLES.CONSULTANCY] },
    { path: '/partner/contract', labelKey: 'nav.partnerContract', icon: FileSignature, kind: KIND_CREATE, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.CONSULTANCY, ROLES.REFERRAL, ROLES.AUDITOR, ROLES.REGIONAL_ADMIN] },
    { path: '/profile', labelKey: 'nav.myProfile', icon: User, kind: KIND_CREATE, permissions: [PERMISSIONS.MANAGE_SETTINGS] },
    // Read-only apart from marking a notification read.
    { path: '/notifications', labelKey: 'nav.notifications', icon: Bell, kind: KIND_VIEW, permissions: [PERMISSIONS.VIEW_DASHBOARD] },
    { path: '/settings', labelKey: 'nav.settings', icon: Settings, kind: KIND_CREATE, permissions: [PERMISSIONS.MANAGE_USERS] },
  ];

  const filteredNav = navItems.filter(item =>
    hasAnyPermission(user?.role, item.permissions) &&
    !(item.excludeRoles && item.excludeRoles.includes(user?.role)) &&
    (!item.allowedRoles || item.allowedRoles.includes(user?.role))
  );

  return (
    <>
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar ${isOpen ? 'sidebar--open' : ''} ${collapsed ? 'sidebar--collapsed' : ''}`}>
        <div className="sidebar__header">
          {/* Links to the public landing page. Was `to={null}` (a plain span),
              which left an authenticated user with no route back out of the
              dashboard at all — the 23 Jul "go back to Hero Main Page" report.
              "/" is an unguarded public route, so this is safe for every role. */}
          <BrandLogo size={28} to="/" showText={!collapsed} className="sidebar__logo" />
          <button className="sidebar__close-mobile" onClick={onClose}>
            <X size={20} />
          </button>
          {/* Always rendered so a collapsed sidebar can be expanded again — the
              icon/label flips with the state (was hidden when collapsed, which
              trapped the user in the narrow rail). */}
          <button
            className="sidebar__collapse-btn"
            onClick={onToggleCollapse}
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        <nav className="sidebar__nav">
          {filteredNav.map((item) => {
            const label = t(item.labelKey);
            const kind = typeof item.kind === 'function' ? item.kind(user?.role) : item.kind;
            const marker = KIND_META[kind];
            const kindLabel = marker ? t(marker.labelKey) : '';
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={onClose}
                // Collapsed to the 68px rail there is no room for the marker,
                // so it moves into the tooltip rather than being lost.
                title={collapsed ? (kindLabel ? `${label} — ${kindLabel}` : label) : undefined}
              >
                <item.icon size={20} className="sidebar__link-icon" />
                {!collapsed && (
                  <span className="sidebar__link-label">
                    {label}
                    {/* Nested inside the label, not a sibling: the label is
                        already dropped when collapsed and already flipped by
                        the RTL rules, so the marker inherits both. */}
                    {marker && (
                      <marker.Icon
                        size={13}
                        className="sidebar__link-marker"
                        aria-label={kindLabel}
                      />
                    )}
                  </span>
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="sidebar__footer">
          {!collapsed && (
            <div className="sidebar__lang-mobile">
              <LanguageSwitcher variant="sidebar" />
            </div>
          )}
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {(user?.full_name || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="sidebar__user-info">
                <span className="sidebar__user-name">{user?.full_name || user?.name || user?.email?.split('@')[0] || t('common.user')}</span>
                <span className="sidebar__user-role">
                  {user?.role === 'client' && !user?.stakeholder_type?.match(/^(referral|consultancy|investor)$/) && user?.company_name
                    ? user.company_name
                    : getDisplayRoleLabel(user?.role, user?.stakeholder_type) || t('common.unknown')}
                </span>
              </div>
            )}
          </div>
          <button className="sidebar__logout" onClick={logout} title={t('common.signOut')}>
            <LogOut size={18} />
            {!collapsed && <span>{t('common.signOut')}</span>}
          </button>
        </div>
      </aside>
    </>
  );
}
