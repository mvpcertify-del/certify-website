import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle } from 'lucide-react';
import { getIsoBySlug } from '../../utils/isoCatalog';
import { supabase } from '../../lib/supabase';
import PricingTiers from '../../components/pricing/PricingTiers';
import PublicNav from '../../components/layout/PublicNav';
import BackButton from '../../components/ui/BackButton';
import './IsoLanding.css';

export default function IsoLanding() {
  const { slug } = useParams();
  const { t } = useTranslation();

  const config = getIsoBySlug(slug);

  // Default to active if no row exists in iso_link_settings.
  // null = still checking, true/false = resolved.
  const [activeState, setActiveState] = useState(null);

  useEffect(() => {
    if (!config) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from('iso_link_settings')
        .select('is_active')
        .eq('slug', config.slug)
        .maybeSingle();
      if (cancelled) return;
      setActiveState(data ? !!data.is_active : true);
    })();
    return () => { cancelled = true; };
  }, [config]);

  const checkedActive = activeState !== null;
  const isActive = activeState !== false;

  if (!config) {
    return (
      <div className="iso-landing">
        <PublicNav />
        <div className="iso-landing__container pubnav-offset">
          <div className="iso-landing__notfound">
            <AlertCircle size={48} />
            <h2>{t('register.invalidType')}</h2>
            <p>{t('register.typeNotRecognized', { type: slug })}</p>
            <Link to="/" className="iso-landing__btn iso-landing__btn--primary">
              {t('register.goToHomepage')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (checkedActive && !isActive) {
    return (
      <div className="iso-landing">
        <PublicNav />
        <div className="iso-landing__container pubnav-offset">
          <div className="iso-landing__notfound">
            <AlertCircle size={48} />
            <h2>{t('iso.linkInactiveTitle')}</h2>
            <p>{t('iso.linkInactive')}</p>
            <Link to="/" className="iso-landing__btn iso-landing__btn--primary">
              {t('register.goToHomepage')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="iso-landing">
      <PublicNav />
      <div className="iso-landing__container pubnav-offset">
        <BackButton />

        {/* The hero, the "What you get" benefits, the flexible-payment bar and
            the bottom sign-in CTA were all removed at the client's request —
            buyers register on the checkout page, so the page goes straight to
            the price. PricingTiers carries the standard's code so the page
            still identifies which certification it is selling. */}
        <section className="iso-landing__section">
          <PricingTiers standardSlug={config.slug} standardCode={config.code} />
        </section>

        <div className="iso-landing__footer">
          <p>{t('common.allRightsReserved')}</p>
        </div>
      </div>
    </div>
  );
}
