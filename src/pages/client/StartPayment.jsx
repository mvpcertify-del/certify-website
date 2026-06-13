import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Shield, AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { getIsoBySlug } from '../../utils/isoCatalog';
import './StartPayment.css';

// Payment-first onboarding bootstrap. Creates a stub `applications` row
// (status='awaiting_registration', selected_package, recommended_iso) and
// forwards the client to /client/checkout/:applicationId where Stripe takes
// over. Detailed company registration happens AFTER payment via
// /client/apply/:applicationId.
//
// Inputs:
//   ?tier=bronze|silver|gold  (defaults to 'silver', the most-popular package)
//   ?iso=<iso-slug>           (defaults to 'iso-9001')
//   sessionStorage[PENDING_CHECKOUT_KEY] is read as a fallback for the
//   OAuth round-trip case, even though AuthCallback/Login normally clear
//   it and pass the values via query params.
export default function StartPayment() {
  const { t } = useTranslation();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const ranRef = useRef(false);

  const tier = (searchParams.get('tier') || 'silver').toLowerCase();
  const isoSlug = searchParams.get('iso') || 'iso-9001';
  const isoConfig = getIsoBySlug(isoSlug);
  const recommendedIso = isoConfig?.code || 'ISO 9001:2015';
  // Map the tier to the stored package label. Legacy standard/premium values
  // collapse onto silver/gold so older links keep working.
  const PACKAGE_LABELS = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold', standard: 'Silver', premium: 'Gold' };
  const selectedPackage = PACKAGE_LABELS[tier] || 'Bronze';

  useEffect(() => {
    if (loading || !user?.id || ranRef.current) return;
    ranRef.current = true;

    (async () => {
      try {
        const { data, error: insertError } = await supabase
          .from('applications')
          .insert({
            client_id: user.id,
            status: 'awaiting_registration',
            selected_package: selectedPackage,
            recommended_iso: recommendedIso,
          })
          .select('id')
          .single();

        if (insertError) throw insertError;
        if (!data?.id) throw new Error('No application id returned');

        navigate(`/client/checkout/${data.id}`, { replace: true });
      } catch (err) {
        console.error('StartPayment: failed to create stub application', err);
        setError(err.message || 'Could not start checkout. Please try again.');
        ranRef.current = false;
      }
    })();
  }, [loading, user?.id, selectedPackage, recommendedIso, navigate]);

  return (
    <div className="start-payment">
      <header className="start-payment__header">
        <Link to="/" className="start-payment__logo">
          <div className="start-payment__logo-icon"><Shield size={20} /></div>
          <span>Certify.cx<sup className="brand-tm">&trade;</sup></span>
        </Link>
      </header>

      <div className="start-payment__card">
        {!error ? (
          <>
            <div className="start-payment__spinner" />
            <h1 className="start-payment__title">{t('payment.preparingTitle')}</h1>
            <p className="start-payment__subtitle">
              {t('payment.preparingSubtitle', { package: selectedPackage, iso: recommendedIso })}
            </p>
          </>
        ) : (
          <>
            <div className="start-payment__error-icon">
              <AlertCircle size={28} />
            </div>
            <h1 className="start-payment__title">{t('payment.preparingError')}</h1>
            <p className="start-payment__subtitle">{error}</p>
            <Link to={`/iso/${isoSlug}`} className="start-payment__btn">
              {t('payment.backToPricing')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
