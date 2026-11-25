import { useTranslation } from 'react-i18next';
import { Check, ArrowRight, ShieldCheck } from 'lucide-react';
import { computeTotal } from '../../utils/pricing';
import useStartCheckout from './useStartCheckout';
import './PricingTiers.css';

// Single-package pricing card. The client dropped the Bronze / Silver / Gold
// three-tier model and the 12-month add-ons: every standard is now offered as
// ONE all-inclusive "Standard" certification package at a single price
// (organization up to 50 employees at 1 location). The surcharge model still
// exists in pricing.js / api/checkout.js for larger organizations.
//
// `standardCode` ('ISO 9001') is shown in place of the generic section tag. The
// ISO landing page has no hero any more, so this card is the only thing naming
// the standard the buyer is about to pay for — without it every /iso/:slug page
// renders identically.
export default function PricingTiers({ variant = 'full', standardSlug = 'iso-9001', standardCode = null }) {
  const { t } = useTranslation();

  const price = computeTotal({ standardSlug }).subtotal;

  // Shared with the ISO landing pages' buy buttons (carries ?ref=, routes logged-in clients).
  const startCheckout = useStartCheckout(standardSlug);

  return (
    <section className={`pricing-tiers ${variant === 'compact' ? 'pricing-tiers--compact' : ''}`}>
      <div className="pricing-tiers__header">
        <span className="pricing-tiers__tag">{standardCode || t('pricing.sectionTag')}</span>
        <h2 className="pricing-tiers__title">{t('pricing.sectionTitle')}</h2>
        <p className="pricing-tiers__desc">{t('pricing.sectionDesc')}</p>
      </div>

      <div className="pricing-tiers__grid pricing-tiers__grid--single">
        <div className="pricing-tier pricing-tier--featured pricing-tier--single">
          <div className="pricing-tier__icon pricing-tier__icon--accent"><ShieldCheck size={20} /></div>
          <h3 className="pricing-tier__name">{t('pricing.packageTitle')}</h3>
          <div className="pricing-tier__price">${price.toLocaleString()}</div>
          <div className="pricing-tier__price-note">{t('pricing.packagePriceNote')}</div>
          <p className="pricing-tier__desc">{t('pricing.packageDesc')}</p>
          <ul className="pricing-tier__features">
            <li><Check size={16} /> {t('pricing.packageFeature1')}</li>
            <li><Check size={16} /> {t('pricing.packageFeature2')}</li>
            <li><Check size={16} /> {t('pricing.packageFeature3')}</li>
            <li><Check size={16} /> {t('pricing.packageFeature4')}</li>
          </ul>
          <button className="pricing-tier__cta pricing-tier__cta--primary" onClick={startCheckout}>
            {t('pricing.packageCta')} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </section>
  );
}
