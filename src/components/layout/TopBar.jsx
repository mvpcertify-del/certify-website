import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { getDisplayRoleLabel } from '../../utils/roles';
import {
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  User,
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
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

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
            onClick={() => setProfileOpen(!profileOpen)}
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
