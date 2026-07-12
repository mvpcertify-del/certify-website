import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, ArrowRight, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import { Button } from '../../components/ui/FormElements';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import { getIsoBySlug } from '../../utils/isoCatalog';
import './StartCheckout.css';

// SessionStorage key used to persist the chosen tier+iso across the OAuth
// redirect. AuthCallback reads it and forwards the user to /client/apply
// with the right preselection.
export const PENDING_CHECKOUT_KEY = 'pendingCheckout';

export default function StartCheckout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, signInWithGoogle, loading } = useAuth();

  const iso = searchParams.get('iso') || 'iso-9001';
  // Extra-staff bands / extra-locations chosen on the pricing cards, carried
  // through to the payment page so the price stays consistent.
  const staff = searchParams.get('staff') || '';
  const locations = searchParams.get('locations') || '';
  const isoConfig = getIsoBySlug(iso);

  // Build the query string for the next hop, dropping empty surcharge params.
  const forwardParams = () => {
    const p = new URLSearchParams({ iso });
    if (staff) p.set('staff', staff);
    if (locations) p.set('locations', locations);
    return p;
  };

  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');

  // Persist the intent so it survives the OAuth round-trip.
  useEffect(() => {
    try {
      sessionStorage.setItem(PENDING_CHECKOUT_KEY, JSON.stringify({ iso, staff, locations }));
    } catch { /* ignore */ }
  }, [iso, staff, locations]);

  // If a client is already signed in, jump straight to the payment-bootstrap
  // route, which creates a stub application and forwards to Stripe checkout.
  // Detailed registration happens AFTER payment (see /client/apply/:id).
  useEffect(() => {
    if (loading) return;
    if (user?.role === ROLES.CLIENT) {
      try { sessionStorage.removeItem(PENDING_CHECKOUT_KEY); } catch { /* ignore */ }
      navigate(`/client/start-payment?${forwardParams().toString()}`, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user, navigate, iso, staff, locations]);

  const handleGoogle = async () => {
    setGoogleLoading(true);
    setError('');
    const result = await signInWithGoogle('/auth/callback');
    if (!result.success) {
      setError(result.error);
      setGoogleLoading(false);
    }
  };

  const handleEmail = () => {
    // Email signup also keeps the pending checkout in sessionStorage; after
    // verification + login, AuthContext / AuthCallback resolves it.
    navigate(`/signup?iso=${encodeURIComponent(iso)}`);
  };

  return (
    <div className="start-checkout">
      <header className="start-checkout__header">
        <Link to="/" className="start-checkout__logo">
          <div className="start-checkout__logo-icon"><Shield size={20} /></div>
          <span>Certify.cx<sup className="brand-tm">&trade;</sup></span>
        </Link>
        <LanguageSwitcher variant="landing" />
      </header>

      <div className="start-checkout__card">
        <h1 className="start-checkout__title">{t('auth.almostThereTitle')}</h1>
        <p className="start-checkout__subtitle">
          {t('auth.almostThereSubtitle')}
        </p>

        {isoConfig && (
          <div className="start-checkout__summary">
            <span className="start-checkout__summary-label">{isoConfig.code}</span>
            <span className="start-checkout__summary-name">{t(isoConfig.titleKey)}</span>
          </div>
        )}

        {error && (
          <div className="start-checkout__error">{error}</div>
        )}

        <button
          type="button"
          className="auth-google-btn auth-google-btn--pill"
          onClick={handleGoogle}
          disabled={googleLoading}
          style={{ width: '100%', marginBottom: 12 }}
        >
          <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
            <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
            <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
            <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
            <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 6.29C4.672 4.163 6.656 2.58 9 3.58z" fill="#EA4335"/>
          </svg>
          {googleLoading ? t('common.redirecting') : t('auth.continueWithGoogle')}
        </button>

        <Button variant="secondary" size="lg" fullWidth onClick={handleEmail}>
          <Mail size={16} style={{ marginRight: 8 }} />
          {t('auth.continueWithEmail')}
        </Button>

        <p className="start-checkout__legal">
          {t('auth.legalPrefix')}{' '}
          <Link to="/terms" className="start-checkout__link">{t('auth.termsLink')}</Link>
          {' '}{t('auth.legalAnd')}{' '}
          <Link to="/privacy" className="start-checkout__link">{t('auth.privacyLink')}</Link>.
        </p>

        <p className="start-checkout__signin">
          {t('auth.alreadyHaveAccount')}{' '}
          <Link to="/login" className="start-checkout__link">{t('auth.signIn')} <ArrowRight size={12} /></Link>
        </p>
      </div>
    </div>
  );
}
