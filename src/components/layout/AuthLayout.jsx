import { Outlet, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import BrandLogo from '../ui/BrandLogo';
import BackButton from '../ui/BackButton';
import './AuthLayout.css';

export default function AuthLayout() {
  const location = useLocation();
  const { t } = useTranslation();
  const isSignUp = location.pathname === '/signup';
  const isWide = isSignUp || location.pathname === '/client/apply';
  const hasType = new URLSearchParams(location.search).get('type');
  const isExtraWide = isWide && hasType;

  return (
    <div className="auth-layout">
      <div className={`auth-layout__container ${isWide ? 'auth-layout__container--wide' : ''} ${isExtraWide ? 'auth-layout__container--extra-wide' : ''}`}>
        <BrandLogo size={34} className="auth-layout__logo" />
        {/* SignUp is a multi-step wizard with its own per-step back control;
            a second, page-level arrow next to it would be ambiguous. */}
        {!isSignUp && <BackButton />}
        <div className="auth-layout__card">
          <Outlet />
        </div>
        <p className="auth-layout__footer">
          {t('common.allRightsReserved')}
        </p>
      </div>
    </div>
  );
}
