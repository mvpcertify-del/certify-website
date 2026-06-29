import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { hasAnyPermission, PERMISSIONS, ROLES, getDisplayRoleLabel } from '../../utils/roles';
import {
  LayoutDashboard,
  Building2,
  FileCheck2,
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
  KeyRound,
  FormInput,
  ClipboardList,
} from 'lucide-react';
import BrandShield from '../ui/BrandShield';
import LanguageSwitcher from '../LanguageSwitcher';
import './Sidebar.css';

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const location = useLocation();

  const navItems = [
    { path: '/dashboard', labelKey: 'nav.dashboard', icon: LayoutDashboard, permissions: [PERMISSIONS.VIEW_DASHBOARD] },
    { path: '/client/apply', labelKey: 'nav.newApplication', icon: PlusCircle, permissions: [PERMISSIONS.CREATE_CERTIFICATION] },
    { path: '/client/certificates', labelKey: 'nav.myCertificates', icon: Award, allowedRoles: [ROLES.CLIENT], permissions: [PERMISSIONS.VIEW_DASHBOARD] },
    { path: '/admin/applications', labelKey: 'nav.applications', icon: FileCheck2, permissions: [PERMISSIONS.VIEW_ALL_CERTIFICATIONS] },
    { path: '/admin/companies', labelKey: 'nav.companies', icon: Building2, permissions: [PERMISSIONS.VIEW_COMPANIES] },
    { path: '/admin/regional-admins', labelKey: 'nav.regionalAdmins', icon: ShieldCheck, permissions: [PERMISSIONS.CREATE_ADMINS] },
    { path: '/admin/auditors', labelKey: 'nav.auditors', icon: UserCheck, permissions: [PERMISSIONS.MANAGE_AUDITORS] },
    { path: '/admin/cert-bodies', labelKey: 'nav.certBodies', icon: Award, permissions: [PERMISSIONS.MANAGE_BODIES] },
    { path: '/admin/cb-registry', labelKey: 'nav.cbRegistry', icon: Building, permissions: [PERMISSIONS.MANAGE_BODIES] },
    { path: '/admin/accreditation-bodies', labelKey: 'nav.accreditationBodies', icon: Stamp, permissions: [PERMISSIONS.MANAGE_BODIES] },
    { path: '/admin/countries', labelKey: 'nav.countries', icon: Globe, permissions: [PERMISSIONS.MANAGE_REGIONS] },
    { path: '/admin/coupons', labelKey: 'nav.coupons', icon: Ticket, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/commission-tiers', labelKey: 'nav.commissionTiers', icon: TrendingUp, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/users', labelKey: 'nav.users', icon: Users, permissions: [PERMISSIONS.CREATE_ADMINS, PERMISSIONS.MANAGE_AUDITORS] },
    { path: '/admin/shareable-links', labelKey: 'nav.shareableLinks', icon: Link2, permissions: [PERMISSIONS.MANAGE_USERS] },
    { path: '/admin/registrations', labelKey: 'nav.registrations', icon: UserPlus, permissions: [PERMISSIONS.MANAGE_USERS] },
    { path: '/admin/permissions', labelKey: 'nav.permissions', icon: KeyRound, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/user-fields', labelKey: 'nav.userFields', icon: FormInput, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    { path: '/admin/application-fields', labelKey: 'nav.applicationFields', icon: ClipboardList, permissions: [PERMISSIONS.VIEW_DASHBOARD], allowedRoles: [ROLES.SUPER_ADMIN] },
    // Referral partners (their own role since phase 14) get their referral
    // dashboard in the sidebar. Admins manage referrals via Commission Tiers.
    { path: '/referrals', labelKey: 'nav.referrals', icon: Gift, permissions: [PERMISSIONS.VIEW_REFERRALS], allowedRoles: [ROLES.REFERRAL] },
    { path: '/profile', labelKey: 'nav.myProfile', icon: User, permissions: [PERMISSIONS.MANAGE_SETTINGS] },
    { path: '/notifications', labelKey: 'nav.notifications', icon: Bell, permissions: [PERMISSIONS.VIEW_DASHBOARD] },
    { path: '/settings', labelKey: 'nav.settings', icon: Settings, permissions: [PERMISSIONS.MANAGE_USERS] },
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
          <div className="sidebar__logo">
            <div className="sidebar__logo-icon">
              <BrandShield size={28} />
            </div>
            {!collapsed && (
              <span className="sidebar__logo-text">
                <span className="brand-c">C</span>ertify<span className="brand-cx">.cx</span><sup className="brand-tm">™</sup>
              </span>
            )}
          </div>
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
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `sidebar__link ${isActive ? 'sidebar__link--active' : ''}`
                }
                onClick={onClose}
                title={collapsed ? label : undefined}
              >
                <item.icon size={20} className="sidebar__link-icon" />
                {!collapsed && <span className="sidebar__link-label">{label}</span>}
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
