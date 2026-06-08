import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { REGIONS, ROLES, hasPermission, PERMISSIONS, getDisplayRoleLabel } from '../../utils/roles';
import {
  Menu,
  Bell,
  ChevronDown,
  Globe,
  LogOut,
  User,
  Settings,
  ChevronRight,
  Sun,
  Moon,
} from 'lucide-react';
import LanguageSwitcher from '../LanguageSwitcher';
import './TopBar.css';

export default function TopBar({ pageTitle, onMenuClick, collapsed }) {
  const { user, logout } = useAuth();
  const { isLight, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [regionOpen, setRegionOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [selectedRegion, setSelectedRegion] = useState('all');
  const regionRef = useRef(null);
  const profileRef = useRef(null);

  const isAdmin = hasPermission(user?.role, PERMISSIONS.MANAGE_USERS);

  useEffect(() => {
    const handler = (e) => {
      if (regionRef.current && !regionRef.current.contains(e.target)) setRegionOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const currentRegion = selectedRegion === 'all'
    ? t('common.allRegions')
    : REGIONS.find(r => r.id === selectedRegion)?.label || t('common.allRegions');

  return (
    <header className={`topbar ${collapsed ? 'topbar--expanded' : ''}`}>
      <div className="topbar__left">
        <button className="topbar__menu-btn" onClick={onMenuClick}>
          <Menu size={20} />
        </button>
        <div className="topbar__title-section">
          <h1 className="topbar__title">{pageTitle || t('common.dashboard')}</h1>
        </div>
      </div>

      <div className="topbar__right">
        {/* Region Selector — admin only */}
        {isAdmin && (
          <div className="topbar__dropdown" ref={regionRef}>
            <button
              className="topbar__dropdown-trigger"
              onClick={() => { setRegionOpen(!regionOpen); setProfileOpen(false); }}
            >
              <Globe size={16} />
              <span>{currentRegion}</span>
              <ChevronDown size={14} className={`topbar__chevron ${regionOpen ? 'topbar__chevron--open' : ''}`} />
            </button>
            {regionOpen && (
              <div className="topbar__dropdown-menu topbar__dropdown-menu--region">
                <button
                  className={`topbar__dropdown-item ${selectedRegion === 'all' ? 'topbar__dropdown-item--active' : ''}`}
                  onClick={() => { setSelectedRegion('all'); setRegionOpen(false); }}
                >
                  {t('common.allRegions')}
                </button>
                {REGIONS.map((region) => (
                  <button
                    key={region.id}
                    className={`topbar__dropdown-item ${selectedRegion === region.id ? 'topbar__dropdown-item--active' : ''}`}
                    onClick={() => { setSelectedRegion(region.id); setRegionOpen(false); }}
                  >
                    {region.emoji} {region.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Language Switcher */}
        <LanguageSwitcher />

        {/* Theme Toggle (Dark / Light) */}
        <button
          className="topbar__icon-btn"
          onClick={toggleTheme}
          title={isLight ? t('common.darkMode') : t('common.lightMode')}
          aria-label={isLight ? t('common.darkMode') : t('common.lightMode')}
          aria-pressed={isLight}
        >
          {isLight ? <Moon size={18} /> : <Sun size={18} />}
        </button>

        {/* Notifications */}
        <button className="topbar__icon-btn" title={t('common.notifications')} onClick={() => navigate('/notifications')}>
          <Bell size={18} />
        </button>

        {/* Profile */}
        <div className="topbar__dropdown" ref={profileRef}>
          <button
            className="topbar__profile-trigger"
            onClick={() => { setProfileOpen(!profileOpen); setRegionOpen(false); }}
          >
            <div className="topbar__avatar">
              {(user?.full_name || user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </div>
            <ChevronDown size={14} className={`topbar__chevron ${profileOpen ? 'topbar__chevron--open' : ''}`} />
          </button>
          {profileOpen && (
            <div className="topbar__dropdown-menu topbar__dropdown-menu--profile">
              <div className="topbar__profile-info">
                <span className="topbar__profile-name">{user?.full_name || user?.name || user?.email?.split('@')[0]}</span>
                <span className="topbar__profile-role">{getDisplayRoleLabel(user?.role, user?.stakeholder_type)}</span>
              </div>
              <div className="topbar__dropdown-divider" />
              <button className="topbar__dropdown-item" onClick={() => { setProfileOpen(false); navigate('/profile'); }}>
                <User size={16} /> {t('common.profile')}
              </button>
              {isAdmin && (
                <button className="topbar__dropdown-item" onClick={() => { setProfileOpen(false); navigate('/settings'); }}>
                  <Settings size={16} /> {t('common.settings')}
                </button>
              )}
              <div className="topbar__dropdown-divider" />
              <button className="topbar__dropdown-item topbar__dropdown-item--danger" onClick={logout}>
                <LogOut size={16} /> {t('common.signOut')}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
