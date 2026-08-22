import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { PACKAGE_LABEL, resolveOrderStandardCode } from '../../utils/pricing';
import { isComplianceStandard } from '../../utils/complianceServices';
import BrandLogo from '../../components/ui/BrandLogo';
import './StartPayment.css';

// Payment-first onboarding bootstrap. Creates a stub `applications` row
// (status='awaiting_registration', selected_package, recommended_iso) and
// forwards the client to /client/checkout/:applicationId where Stripe takes
// over. Detailed company registration happens AFTER payment via
// /client/apply/:applicationId.
//
// Inputs:
//   ?iso=<iso-slug>           (defaults to 'iso-9001')
//   (the old ?tier param is ignored — there is a single "Standard" package)
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

  const isoSlug = searchParams.get('iso') || 'iso-9001';
  // Extra-staff bands / extra-locations chosen on the pricing cards, forwarded
  // to the payment page so its steppers pre-fill and the price matches.
  const staff = searchParams.get('staff') || '';
  const locations = searchParams.get('locations') || '';
  // Resolves an ISO slug OR a compliance-audit slug ('soc', 'sox-itgc', …).
  // This used to be getIsoBySlug(...)?.code, which returned nothing for a
  // compliance service and fell through to the default — so a logged-in client
  // who clicked "Proceed to payment" on SOC Examinations would have had an
  // ISO 9001 application created and been charged for that instead.
  const recommendedIso = resolveOrderStandardCode(isoSlug) || 'ISO 9001:2015';
  // Where "back to pricing" goes: the two catalogs have different detail pages.
  const detailPath = isComplianceStandard(isoSlug)
    ? `/compliance/${isoSlug}`
    : `/iso/${isoSlug}`;
  // Single-package model: everyone gets the one "Standard" package.
  const selectedPackage = PACKAGE_LABEL;

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

        const checkoutParams = new URLSearchParams();
        if (staff) checkoutParams.set('staff', staff);
        if (locations) checkoutParams.set('locations', locations);
        const qs = checkoutParams.toString();
        navigate(`/client/checkout/${data.id}${qs ? `?${qs}` : ''}`, { replace: true });
      } catch (err) {
        console.error('StartPayment: failed to create stub application', err);
        setError(err.message || 'Could not start checkout. Please try again.');
        ranRef.current = false;
      }
    })();
  }, [loading, user?.id, selectedPackage, recommendedIso, staff, locations, navigate]);

  return (
    <div className="start-payment">
      <header className="start-payment__header">
        <BrandLogo size={26} />
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
            <Link to={detailPath} className="start-payment__btn">
              {t('payment.backToPricing')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
