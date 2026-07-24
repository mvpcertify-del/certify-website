import { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Menu, X, User, LogOut, LayoutDashboard, ChevronDown, Sun, Moon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import LanguageSwitcher from '../LanguageSwitcher';
import BrandLogo from '../ui/BrandLogo';
import './PublicNav.css';

// The public site header. This used to be inlined in LandingPage only, which is
// why every other public page (/iso/:slug, /certifications, /gap-analysis,
// /register/:type) showed nothing but a logo — the client flagged the missing
// nav bar. It now renders on all of them.
//
// The section links are anchors into the landing page. On "/" they stay bare
// hashes so the browser scrolls in place; anywhere else they are prefixed with
// "/" so they navigate home first and then scroll.
export default function PublicNav() {
  const { t } = useTranslation();
  const { user, loading, logout, getRoleDashboard } = useAuth();
  // The theme toggle existed only inside the dashboard shell (TopBar), so a
  // visitor on the public site had no way to switch to dark mode at all — and
  // no way back once they had. It belongs on both.
  const { isLight, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [mobileOpen, setMobileOpen] = useState(false);
  const closeMobile = () => setMobileOpen(false);

  const onLanding = location.pathname === '/';
  const anchor = (id) => (onLanding ? `#${id}` : `/#${id}`);

  // Once a visitor has verified their email / logged in, the header shows a
  // profile menu instead of the Log In + Sign Up buttons. Gate on !loading so
  // we don't flash the logged-out buttons before the session resolves.
  const isLoggedIn = !loading && !!user;
  const userInitial = (user?.full_name || user?.name || user?.email || 'U').charAt(0).toUpperCase();
  const userDisplayName = user?.full_name || user?.name || user?.email?.split('@')[0];
  const dashboardPath = user ? getRoleDashboard(user.role) : '/login';

  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  useEffect(() => {
    const handler = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setProfileOpen(false);
    await logout();
    navigate('/');
  };

  return (
    <nav className="pubnav">
      <div className="pubnav__inner">
        <BrandLogo size={28} className="pubnav__logo" />

        <div className="pubnav__links">
          <a href={anchor('how-it-works')} className="pubnav__link">{t('nav.howItWorks')}</a>
          <a href={anchor('standards')} className="pubnav__link">{t('nav.standards')}</a>
          <a href={anchor('benefits')} className="pubnav__link">{t('nav.benefits')}</a>
          <LanguageSwitcher variant="landing" />
          <button
            type="button"
            className="pubnav__icon-btn"
            onClick={toggleTheme}
            title={isLight ? t('common.darkMode') : t('common.lightMode')}
            aria-label={isLight ? t('common.darkMode') : t('common.lightMode')}
            aria-pressed={isLight}
          >
            {isLight ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          {isLoggedIn ? (
            <div className="pubnav__profile" ref={profileRef}>
              <button
                type="button"
                className="pubnav__profile-trigger"
                onClick={() => setProfileOpen((o) => !o)}
                aria-haspopup="true"
                aria-expanded={profileOpen}
                aria-label={userDisplayName}
              >
                <span className="pubnav__avatar">{userInitial}</span>
                <ChevronDown
                  size={14}
                  className={`pubnav__profile-chevron ${profileOpen ? 'pubnav__profile-chevron--open' : ''}`}
                />
              </button>
              {profileOpen && (
                <div className="pubnav__profile-menu">
                  <div className="pubnav__profile-info">
                    <span className="pubnav__profile-name">{userDisplayName}</span>
                    <span className="pubnav__profile-email">{user?.email}</span>
                  </div>
                  <div className="pubnav__profile-divider" />
                  <Link to={dashboardPath} className="pubnav__profile-item" onClick={() => setProfileOpen(false)}>
                    <LayoutDashboard size={16} /> {t('common.dashboard')}
                  </Link>
                  <Link to="/profile" className="pubnav__profile-item" onClick={() => setProfileOpen(false)}>
                    <User size={16} /> {t('common.profile')}
                  </Link>
                  <div className="pubnav__profile-divider" />
                  <button
                    type="button"
                    className="pubnav__profile-item pubnav__profile-item--danger"
                    onClick={handleLogout}
                  >
                    <LogOut size={16} /> {t('common.signOut')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <>
              <Link to="/login" className="pubnav__link pubnav__link--login">{t('nav.login')}</Link>
              <Link to="/signup" className="pubnav__btn">{t('nav.signUp')}</Link>
            </>
          )}
          <Link to="/gap-analysis" className="pubnav__btn pubnav__btn--gap">{t('landing.freeGapAnalysis')}</Link>
        </div>

        {/* Mobile bar: language switcher stays visible at the top so anyone
            can override the country default without opening the menu. */}
        <div className="pubnav__mobile-actions">
          <LanguageSwitcher variant="landing" />
          <button
            type="button"
            className="pubnav__icon-btn"
            onClick={toggleTheme}
            title={isLight ? t('common.darkMode') : t('common.lightMode')}
            aria-label={isLight ? t('common.darkMode') : t('common.lightMode')}
            aria-pressed={isLight}
          >
            {isLight ? <Moon size={18} /> : <Sun size={18} />}
          </button>
          <button
            className="pubnav__toggle"
            onClick={() => setMobileOpen((o) => !o)}
            aria-label={t('nav.menu')}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div className="pubnav__mobile-menu">
          <a href={anchor('how-it-works')} className="pubnav__mobile-link" onClick={closeMobile}>{t('nav.howItWorks')}</a>
          <a href={anchor('standards')} className="pubnav__mobile-link" onClick={closeMobile}>{t('nav.standards')}</a>
          <a href={anchor('benefits')} className="pubnav__mobile-link" onClick={closeMobile}>{t('nav.benefits')}</a>
          {isLoggedIn ? (
            <>
              <div className="pubnav__mobile-profile">
                <span className="pubnav__avatar">{userInitial}</span>
                <span className="pubnav__mobile-profile-name">{userDisplayName}</span>
              </div>
              <Link to={dashboardPath} className="pubnav__mobile-link" onClick={closeMobile}>{t('common.dashboard')}</Link>
              <Link to="/profile" className="pubnav__mobile-link" onClick={closeMobile}>{t('common.profile')}</Link>
              <button
                type="button"
                className="pubnav__btn pubnav__mobile-btn"
                onClick={() => { closeMobile(); handleLogout(); }}
              >
                {t('common.signOut')}
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="pubnav__mobile-link pubnav__link--login" onClick={closeMobile}>{t('nav.login')}</Link>
              <Link to="/signup" className="pubnav__btn pubnav__mobile-btn" onClick={closeMobile}>{t('nav.signUp')}</Link>
            </>
          )}
          <Link to="/gap-analysis" className="pubnav__btn pubnav__btn--gap pubnav__mobile-btn" onClick={closeMobile}>{t('landing.freeGapAnalysis')}</Link>
        </div>
      )}
    </nav>
  );
}
