import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ArrowRight, Award, Star, Crown, Users, MapPin, Minus, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  computeTotal,
  SURCHARGE_PER_EMPLOYEE_BAND,
  SURCHARGE_PER_LOCATION,
  INCLUDED_EMPLOYEES,
  EMPLOYEES_PER_BAND,
} from '../../utils/pricing';
import { ROLES } from '../../utils/roles';
import './PricingTiers.css';

// Three-package pricing card: Bronze, Silver (most popular), Gold.
//   Bronze = base certification
//   Silver = Bronze + 12 months online support       (featured / most popular)
//   Gold   = Silver + 12 months system internal audit
// Prices come from the per-standard pricing map (base + add-ons) in
// utils/pricing.js so the cards and checkout always agree.
//
// A shared Extra Staff / Extra Locations control sits above the three cards.
// It uses the SAME surcharge model as the checkout page (computeTotal), so the
// price shown on every card updates live and matches what the buyer is charged.
// The chosen counts are carried into checkout via ?staff= & ?locations= query
// params so the final payment page pre-fills them.
export default function PricingTiers({ variant = 'full', standardSlug = 'iso-9001' }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  // Extra 50-employee bands above the included 10, and extra sites above the
  // included 1. Each band/location adds a flat surcharge to every package.
  const [employeeBands, setEmployeeBands] = useState(0);
  const [additionalLocations, setAdditionalLocations] = useState(0);

  const priceFor = (tier) =>
    computeTotal({ standardSlug, tier, employeeBands, locations: additionalLocations }).subtotal;

  const bronzePrice = priceFor('bronze');
  const silverPrice = priceFor('silver');
  const goldPrice   = priceFor('gold');

  const employeeRangeLabel = (bands) => {
    if (bands === 0) return t('pricing.employeesIncluded', { count: INCLUDED_EMPLOYEES });
    const lower = INCLUDED_EMPLOYEES + (bands - 1) * EMPLOYEES_PER_BAND + 1;
    const upper = INCLUDED_EMPLOYEES + bands * EMPLOYEES_PER_BAND;
    return `${lower}–${upper}`;
  };

  const startCheckout = (tier) => {
    const params = new URLSearchParams({ tier, iso: standardSlug });
    if (employeeBands > 0) params.set('staff', String(employeeBands));
    if (additionalLocations > 0) params.set('locations', String(additionalLocations));
    const qs = params.toString();
    if (user?.role === ROLES.CLIENT) {
      navigate(`/client/start-payment?${qs}`);
    } else {
      navigate(`/start-checkout?${qs}`);
    }
  };

  return (
    <section className={`pricing-tiers ${variant === 'compact' ? 'pricing-tiers--compact' : ''}`}>
      <div className="pricing-tiers__header">
        <span className="pricing-tiers__tag">{t('pricing.sectionTag')}</span>
        <h2 className="pricing-tiers__title">{t('pricing.sectionTitle')}</h2>
        <p className="pricing-tiers__desc">{t('pricing.sectionDesc')}</p>
      </div>

      {/* SHARED ORG-SIZE CONTROL — adjusts every package price live */}
      <div className="pricing-tiers__orgsize">
        <span className="pricing-tiers__orgsize-title">{t('pricing.orgSize')}</span>
        <div className="pricing-tiers__orgsize-grid">
          {/* Extra Staff */}
          <div className="pricing-tiers__orgsize-row">
            <div className="pricing-tiers__orgsize-label">
              <Users size={18} />
              <div>
                <p className="pricing-tiers__orgsize-name">{t('pricing.additionalEmployees')}</p>
                <p className="pricing-tiers__orgsize-hint">
                  {employeeRangeLabel(employeeBands)}
                  {employeeBands > 0 && ` · +$${(employeeBands * SURCHARGE_PER_EMPLOYEE_BAND).toLocaleString()}`}
                </p>
              </div>
            </div>
            <div className="pricing-tiers__stepper">
              <button
                type="button"
                onClick={() => setEmployeeBands(b => Math.max(0, b - 1))}
                disabled={employeeBands === 0}
                aria-label={t('pricing.decreaseEmployees')}
              >
                <Minus size={14} />
              </button>
              <span>{employeeBands}</span>
              <button
                type="button"
                onClick={() => setEmployeeBands(b => b + 1)}
                aria-label={t('pricing.increaseEmployees')}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Extra Locations */}
          <div className="pricing-tiers__orgsize-row">
            <div className="pricing-tiers__orgsize-label">
              <MapPin size={18} />
              <div>
                <p className="pricing-tiers__orgsize-name">{t('pricing.additionalLocations')}</p>
                <p className="pricing-tiers__orgsize-hint">
                  {additionalLocations === 0
                    ? t('pricing.locationsIncluded', { count: 1 })
                    : t('pricing.locationsExtra', { count: additionalLocations })}
                  {additionalLocations > 0 && ` · +$${(additionalLocations * SURCHARGE_PER_LOCATION).toLocaleString()}`}
                </p>
              </div>
            </div>
            <div className="pricing-tiers__stepper">
              <button
                type="button"
                onClick={() => setAdditionalLocations(n => Math.max(0, n - 1))}
                disabled={additionalLocations === 0}
                aria-label={t('pricing.decreaseLocations')}
              >
                <Minus size={14} />
              </button>
              <span>{additionalLocations}</span>
              <button
                type="button"
                onClick={() => setAdditionalLocations(n => n + 1)}
                aria-label={t('pricing.increaseLocations')}
              >
                <Plus size={14} />
              </button>
            </div>
          </div>
        </div>
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
