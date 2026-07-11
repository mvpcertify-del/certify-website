import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Check, ArrowRight, Award, Star, Crown, Users, MapPin } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import {
  computeTotal,
  employeeBandsFromCount,
  INCLUDED_EMPLOYEES,
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

  // Ask the buyer for their real organization size — a plain headcount and a
  // plain number of sites (not abstract "bands"). We convert the headcount to
  // surcharge bands internally so the shared computeTotal model (and the
  // server) stay unchanged. Defaults = what the base price already includes.
  const [employeeCount, setEmployeeCount] = useState(INCLUDED_EMPLOYEES);
  const [locationCount, setLocationCount] = useState(1);

  // Derived surcharge inputs for the pricing model.
  const employeeBands = employeeBandsFromCount(employeeCount);
  const additionalLocations = Math.max(0, Math.floor(Number(locationCount) || 0) - 1);

  const priceFor = (tier) =>
    computeTotal({ standardSlug, tier, employeeBands, locations: additionalLocations }).subtotal;

  const bronzePrice = priceFor('bronze');
  const silverPrice = priceFor('silver');
  const goldPrice   = priceFor('gold');

  const clampInt = (v, min) => {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n) || n < min) return min;
    return n;
  };

  const startCheckout = (tier) => {
    const params = new URLSearchParams({ tier, iso: standardSlug });
    if (employeeBands > 0) params.set('staff', String(employeeBands));
    if (additionalLocations > 0) params.set('locations', String(additionalLocations));
    const qs = params.toString();
    if (user?.role === ROLES.CLIENT) {
      // Logged-in clients keep the existing bootstrap → Stripe path.
      navigate(`/client/start-payment?${qs}`);
    } else {
      // Everyone else goes straight to the public pay-first checkout — no
      // account/signup gate before payment.
      navigate(`/checkout?${qs}`);
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

      {/* SHARED ORG-SIZE CONTROL — one simple input for the buyer's real
          organization size. Adjusts every package price live. */}
      <div className="pricing-tiers__orgsize">
        <span className="pricing-tiers__orgsize-title">{t('pricing.orgSizeQuestion')}</span>
        <div className="pricing-tiers__orgsize-grid">
          <div className="pricing-tiers__orgsize-row">
            <label className="pricing-tiers__orgsize-label" htmlFor="pt-employees">
              <Users size={18} />
              <div>
                <p className="pricing-tiers__orgsize-name">{t('pricing.employeesLabel')}</p>
                <p className="pricing-tiers__orgsize-hint">{t('pricing.employeesIncludedHint', { count: INCLUDED_EMPLOYEES })}</p>
              </div>
            </label>
            <input
              id="pt-employees"
              type="number"
              min={1}
              className="pricing-tiers__orgsize-input"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              onBlur={(e) => setEmployeeCount(clampInt(e.target.value, 1))}
            />
          </div>

          <div className="pricing-tiers__orgsize-row">
            <label className="pricing-tiers__orgsize-label" htmlFor="pt-locations">
              <MapPin size={18} />
              <div>
                <p className="pricing-tiers__orgsize-name">{t('pricing.locationsLabel')}</p>
                <p className="pricing-tiers__orgsize-hint">{t('pricing.locationsIncludedHint', { count: 1 })}</p>
              </div>
            </label>
            <input
              id="pt-locations"
              type="number"
              min={1}
              className="pricing-tiers__orgsize-input"
              value={locationCount}
              onChange={(e) => setLocationCount(e.target.value)}
              onBlur={(e) => setLocationCount(clampInt(e.target.value, 1))}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
