import { useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Mail } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import { Button } from '../../components/ui/FormElements';
import LanguageSwitcher from '../../components/LanguageSwitcher';
import BrandLogo from '../../components/ui/BrandLogo';
import BackButton from '../../components/ui/BackButton';
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
  const { user, loading } = useAuth();

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

  const handleEmail = () => {
    // Email signup also keeps the pending checkout in sessionStorage; after
    // verification + login, AuthContext / AuthCallback resolves it.
    navigate(`/signup?iso=${encodeURIComponent(iso)}`);
  };

  return (
    <div className="start-checkout">
      <header className="start-checkout__header">
        <BrandLogo size={26} />
        <LanguageSwitcher variant="landing" />
      </header>

      <BackButton />

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
