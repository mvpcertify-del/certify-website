import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield, Award, Globe2, Lock, Apple, GraduationCap, Zap, Scale,
  Activity, Stethoscope, ShieldCheck, BrainCircuit,
  ArrowRight, CheckCircle2, CreditCard, AlertCircle,
} from 'lucide-react';
import { getIsoBySlug } from '../../utils/isoCatalog';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import PricingTiers from '../../components/pricing/PricingTiers';
import PricingCalculator from '../../components/pricing/PricingCalculator';
import './IsoLanding.css';

const ICON_MAP = {
  Award, Globe2, Shield, Lock, Apple, GraduationCap, Zap, Scale, Activity, Stethoscope,
  ShieldCheck, BrainCircuit,
};

export default function IsoLanding() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

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
        <div className="iso-landing__container">
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

  const IconComponent = ICON_MAP[config.icon] || Award;

  const handleApply = () => {
    // Logged-in client: jump straight into the payment-bootstrap route
    // (stub application + Stripe checkout). Detailed registration happens
    // AFTER payment via /client/apply/:applicationId.
    // Anyone else: send through the lightweight /start-checkout auth gate so
    // they can pick Google/email at the moment they decide to pay.
    if (user?.role === ROLES.CLIENT) {
      navigate(`/client/start-payment?tier=silver&iso=${encodeURIComponent(config.slug)}`);
    } else {
      try { localStorage.setItem('certifycx.preselectedIso', config.code); } catch { /* ignore */ }
      navigate(`/start-checkout?tier=silver&iso=${encodeURIComponent(config.slug)}`);
    }
  };

  if (checkedActive && !isActive) {
    return (
      <div className="iso-landing">
        <div className="iso-landing__container">
          <div className="iso-landing__header">
            <Link to="/" className="iso-landing__logo">
              <div className="iso-landing__logo-icon"><Shield size={22} /></div>
              <span className="iso-landing__logo-text">Certify.cx<sup className="brand-tm">&trade;</sup></span>
            </Link>
          </div>
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

  const benefits = [
    t('iso.benefit1'),
    t('iso.benefit2'),
    t('iso.benefit3'),
    t('iso.benefit4'),
  ];

  return (
    <div className="iso-landing">
      <div className="iso-landing__container">
        {/* Header */}
        <div className="iso-landing__header">
          <Link to="/" className="iso-landing__logo">
            <div className="iso-landing__logo-icon"><Shield size={22} /></div>
            <span className="iso-landing__logo-text">Certify.cx<sup className="brand-tm">&trade;</sup></span>
          </Link>
        </div>

        {/* Hero */}
        <div className="iso-landing__hero">
          <div
            className="iso-landing__hero-icon"
            style={{ background: `${config.color}18`, color: config.color }}
          >
            <IconComponent size={44} />
          </div>
          <span className="iso-landing__hero-code" style={{ color: config.color }}>
            {config.code}
          </span>
          <h1 className="iso-landing__hero-title">{t(config.titleKey)}</h1>
          <p className="iso-landing__hero-tagline">
            {t('iso.publicTagline', { code: config.code })}
          </p>
          <p className="iso-landing__hero-desc">{t(config.descKey)}</p>
          <button
            className="iso-landing__btn iso-landing__btn--primary iso-landing__btn--lg"
            onClick={handleApply}
            style={{ '--btn-accent': config.color }}
          >
            {t('iso.applyNow')} <ArrowRight size={18} />
          </button>
        </div>

        {/* Benefits */}
        <section className="iso-landing__section">
          <h2 className="iso-landing__section-title">
            <CheckCircle2 size={20} className="iso-landing__section-icon iso-landing__section-icon--green" />
            {t('iso.viewBenefits')}
          </h2>
          <div className="iso-landing__cards">
            {benefits.map((benefit, i) => (
              <div key={i} className="iso-landing__card">
                <div className="iso-landing__card-num" style={{ color: config.color }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <p className="iso-landing__card-text">{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing Tiers — Free / Standard / Premium (priced per standard). */}
        <section className="iso-landing__section">
          <PricingTiers standardSlug={config.slug} />
        </section>

        {/* Pricing Calculator — employee/location surcharges + invoice. */}
        <section className="iso-landing__section">
          <PricingCalculator
            standardSlug={config.slug}
            standardCode={config.code}
            accent={config.color}
          />
        </section>

        {/* Payment Info */}
        <section className="iso-landing__payment">
          <div className="iso-landing__payment-icon" style={{ background: `${config.color}18`, color: config.color }}>
            <CreditCard size={24} />
          </div>
          <div className="iso-landing__payment-text">
            <h3>{t('iso.flexiblePayment')}</h3>
            <p>{t('payment.choosePayment')}</p>
          </div>
        </section>

        {/* CTA */}
        <div className="iso-landing__cta">
          <h3 className="iso-landing__cta-title">{t('register.readyToStart')}</h3>
          <p className="iso-landing__cta-desc">
            {t('iso.publicTagline', { code: config.code })}
          </p>
          <div className="iso-landing__cta-actions">
            <button
              className="iso-landing__btn iso-landing__btn--primary iso-landing__btn--lg"
              onClick={handleApply}
              style={{ '--btn-accent': config.color }}
            >
              {t('iso.applyNow')} <ArrowRight size={18} />
            </button>
            <Link to="/login" className="iso-landing__btn iso-landing__btn--secondary">
              {t('register.alreadyHaveAccount')}
            </Link>
          </div>
        </div>

        <div className="iso-landing__footer">
          <p>{t('common.allRightsReserved')}</p>
        </div>
      </div>
    </div>
  );
}
