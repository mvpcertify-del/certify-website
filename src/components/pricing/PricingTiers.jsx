import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ArrowRight, Award, Star, Crown } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getPriceForStandard } from '../../utils/pricing';
import { ROLES } from '../../utils/roles';
import './PricingTiers.css';

// Three-package pricing card: Bronze, Silver (most popular), Gold.
//   Bronze = base certification
//   Silver = Bronze + 12 months online support       (featured / most popular)
//   Gold   = Silver + 12 months system internal audit
// Prices come from the per-standard pricing map (base + add-ons) in
// utils/pricing.js so the cards and checkout always agree.
export default function PricingTiers({ variant = 'full', standardSlug = 'iso-9001' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const bronzePrice = getPriceForStandard(standardSlug, 'bronze');
  const silverPrice = getPriceForStandard(standardSlug, 'silver');
  const goldPrice   = getPriceForStandard(standardSlug, 'gold');

  const startCheckout = (tier) => {
    if (user?.role === ROLES.CLIENT) {
      navigate(`/client/start-payment?tier=${tier}&iso=${standardSlug}`);
    } else {
      navigate(`/start-checkout?tier=${tier}&iso=${standardSlug}`);
    }
  };

  return (
    <section className={`pricing-tiers ${variant === 'compact' ? 'pricing-tiers--compact' : ''}`}>
      <div className="pricing-tiers__header">
        <span className="pricing-tiers__tag">{t('pricing.sectionTag')}</span>
        <h2 className="pricing-tiers__title">{t('pricing.sectionTitle')}</h2>
        <p className="pricing-tiers__desc">{t('pricing.sectionDesc')}</p>
      </div>

      <div className="pricing-tiers__grid">
        {/* Bronze — base certification */}
        <div className="pricing-tier pricing-tier--bronze">
          <div className="pricing-tier__icon"><Award size={20} /></div>
          <h3 className="pricing-tier__name">{t('pricing.tierBronzeTitle')}</h3>
          <div className="pricing-tier__price">${bronzePrice.toLocaleString()}</div>
          <div className="pricing-tier__price-note">{t('pricing.tierBronzePriceNote')}</div>
          <p className="pricing-tier__desc">{t('pricing.tierBronzeDesc')}</p>
          <ul className="pricing-tier__features">
            <li><Check size={16} /> {t('pricing.tierBronzeFeature1')}</li>
            <li><Check size={16} /> {t('pricing.tierBronzeFeature2')}</li>
            <li><Check size={16} /> {t('pricing.tierBronzeFeature3')}</li>
          </ul>
          <button className="pricing-tier__cta pricing-tier__cta--secondary" onClick={() => startCheckout('bronze')}>
            {t('pricing.tierBronzeCta')} <ArrowRight size={16} />
          </button>
        </div>

        {/* Silver — most popular */}
        <div className="pricing-tier pricing-tier--silver pricing-tier--featured">
          <span className="pricing-tier__badge">{t('pricing.mostPopular')}</span>
          <div className="pricing-tier__icon pricing-tier__icon--accent"><Star size={20} /></div>
          <h3 className="pricing-tier__name">{t('pricing.tierSilverTitle')}</h3>
          <div className="pricing-tier__price">${silverPrice.toLocaleString()}</div>
          <div className="pricing-tier__price-note">{t('pricing.tierSilverPriceNote')}</div>
          <p className="pricing-tier__desc">{t('pricing.tierSilverDesc')}</p>
          <ul className="pricing-tier__features">
            <li><Check size={16} /> {t('pricing.tierSilverFeature1')}</li>
            <li><Check size={16} /> {t('pricing.tierSilverFeature2')}</li>
            <li><Check size={16} /> {t('pricing.tierSilverFeature3')}</li>
          </ul>
          <button className="pricing-tier__cta pricing-tier__cta--primary" onClick={() => startCheckout('silver')}>
            {t('pricing.tierSilverCta')} <ArrowRight size={16} />
          </button>
        </div>

        {/* Gold — everything + internal audit */}
        <div className="pricing-tier pricing-tier--gold">
          <div className="pricing-tier__icon"><Crown size={20} /></div>
          <h3 className="pricing-tier__name">{t('pricing.tierGoldTitle')}</h3>
          <div className="pricing-tier__price">${goldPrice.toLocaleString()}</div>
          <div className="pricing-tier__price-note">{t('pricing.tierGoldPriceNote')}</div>
          <p className="pricing-tier__desc">{t('pricing.tierGoldDesc')}</p>
          <ul className="pricing-tier__features">
            <li><Check size={16} /> {t('pricing.tierGoldFeature1')}</li>
            <li><Check size={16} /> {t('pricing.tierGoldFeature2')}</li>
            <li><Check size={16} /> {t('pricing.tierGoldFeature3')}</li>
          </ul>
          <button className="pricing-tier__cta pricing-tier__cta--secondary" onClick={() => startCheckout('gold')}>
            {t('pricing.tierGoldCta')} <ArrowRight size={16} />
          </button>
        </div>
      </div>

      <p className="pricing-tiers__disclaimer">{t('pricing.disclaimer')}</p>
    </section>
  );
}
