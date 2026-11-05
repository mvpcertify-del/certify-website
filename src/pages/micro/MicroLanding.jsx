import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, Check, Users, Globe, CircleDollarSign, Play, Lock,
  FilePen, Search, ClipboardCheck, ChartNoAxesCombined, BadgeCheck,
  ShieldCheck, Award, Linkedin, Twitter, Youtube, Mail,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import { apiPost } from '../../lib/apiClient';
import PublicNav from '../../components/layout/PublicNav';
import BrandLogo from '../../components/ui/BrandLogo';
import SegmentBar from '../../components/layout/SegmentBar';
import './MicroLanding.css';

// ============================================
// Certify.cx — MICRO landing page (/micro)
// ============================================
// Built from the client's "Dark Green SaaS Compliance Landing Page" design:
// hero, five-step journey, three-stage pricing with the standard certification
// fee card, bottom banner and the page footer. All copy lives under the
// `micro.*` i18n keys (English bundled; other locales fall back to English
// until translated).

// Hero art: dotted globe, orbit rings, three people and a compliance shield.
function HeroArt() {
  return (
    <svg className="micro-art" viewBox="0 0 520 380" role="img" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="mGlobe" cx="50%" cy="45%" r="55%">
          <stop offset="0" stopColor="#0c3a30" />
          <stop offset="0.7" stopColor="#0a2a26" />
          <stop offset="1" stopColor="#081a1c" />
        </radialGradient>
        <radialGradient id="mGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0" stopColor="#3ECF8E" stopOpacity="0.28" />
          <stop offset="1" stopColor="#3ECF8E" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mPerson" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#4ee3a0" />
          <stop offset="1" stopColor="#1c9a69" />
        </linearGradient>
        <linearGradient id="mShield" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3ECF8E" />
          <stop offset="1" stopColor="#0f7a55" />
        </linearGradient>
        <pattern id="mDots" width="9" height="9" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1.4" fill="#3ECF8E" />
        </pattern>
        <mask id="mLand">
          <rect width="520" height="380" fill="#000" />
          <path
            d="M120 150c30-40 70-52 110-48 22 2 40 14 62 8 28-8 52-4 78 14 24 18 34 40 52 52 10 24-4 40-18 50-26 6-44-12-66-6-24 8-30 32-56 34-30 2-40-22-62-18-26 6-38 36-66 28-26-8-26-42-40-66-12-18-8-34 6-48z"
            fill="#fff"
          />
        </mask>
        <clipPath id="mClip"><circle cx="260" cy="190" r="150" /></clipPath>
      </defs>

      <circle cx="260" cy="190" r="190" fill="url(#mGlow)" />
      {/* orbit rings */}
      <ellipse cx="260" cy="200" rx="245" ry="78" fill="none" stroke="#3ECF8E" strokeOpacity="0.35" strokeWidth="1.2" transform="rotate(-16 260 200)" />
      <ellipse cx="260" cy="190" rx="205" ry="120" fill="none" stroke="#3ECF8E" strokeOpacity="0.22" strokeWidth="1" transform="rotate(24 260 190)" />
      {/* globe */}
      <circle cx="260" cy="190" r="150" fill="url(#mGlobe)" stroke="#3ECF8E" strokeOpacity="0.4" strokeWidth="1.2" />
      <g clipPath="url(#mClip)">
        <rect x="100" y="40" width="320" height="300" fill="url(#mDots)" mask="url(#mLand)" opacity="0.85" />
        <ellipse cx="260" cy="190" rx="150" ry="150" fill="none" stroke="#3ECF8E" strokeOpacity="0.12" />
        <ellipse cx="260" cy="190" rx="75" ry="150" fill="none" stroke="#3ECF8E" strokeOpacity="0.12" />
        <ellipse cx="260" cy="190" rx="150" ry="70" fill="none" stroke="#3ECF8E" strokeOpacity="0.12" />
      </g>
      <circle cx="430" cy="258" r="2.5" fill="#3ECF8E" />
      <circle cx="96" cy="120" r="2" fill="#3ECF8E" opacity="0.7" />

      {/* people */}
      <g fill="url(#mPerson)">
        <circle cx="260" cy="128" r="24" />
        <path d="M212 215c0-30 22-48 48-48s48 18 48 48v22h-96z" />
        <circle cx="196" cy="158" r="17" />
        <path d="M160 222c0-22 15-36 36-36 8 0 15 2 20 6-10 10-16 24-16 44h-40z" />
        <circle cx="326" cy="158" r="17" />
        <path d="M364 222c0-22-15-36-36-36-8 0-15 2-20 6 10 10 16 24 16 44h40z" />
      </g>
      {/* shield */}
      <g transform="translate(300 196)">
        <path d="M60 0 L112 20 V74 C112 116 90 142 60 156 C30 142 8 116 8 74 V20 Z" fill="url(#mShield)" stroke="#8cf0c4" strokeOpacity="0.55" strokeWidth="2" />
        <path d="M60 14 L100 29 V74 C100 108 83 129 60 141 C37 129 20 108 20 74 V29 Z" fill="#0d8a60" opacity="0.55" />
        <path d="M38 80l15 15 30-32" fill="none" stroke="#eafff5" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

export default function MicroLanding() {
  const { t } = useTranslation();
  const { user, loading, getRoleDashboard } = useAuth();
  const navigate = useNavigate();
  const [busyStage, setBusyStage] = useState(null);
  const [payError, setPayError] = useState('');

  // Signed-in visitors must never be sent to /signup (it is the account-creation
  // wizard and has no "you are already signed in" state). Clients get the
  // authenticated gap analysis; every signed-in role lands on its own dashboard
  // for "Get Started". Signed-out visitors keep the public paths.
  const isIn = !loading && !!user;
  const gapPath = isIn && user.role === ROLES.CLIENT ? '/client/gap-analysis' : '/gap-analysis';
  const joinPath = isIn ? getRoleDashboard(user.role) : '/signup';

  // The two paid stages are monthly plans paid through Whop. Signed-out visitors
  // are sent to create an account first; signed-in ones go straight to checkout.
  const startPlan = async (stage) => {
    setPayError('');
    if (!isIn) { navigate('/signup'); return; }
    setBusyStage(stage);
    try {
      const res = await apiPost('/api/checkout', { action: 'micro-checkout', stage });
      if (!res?.url) throw new Error('No checkout link returned');
      window.location.assign(res.url);
    } catch (e) {
      setPayError(e?.message || t('micro.payError'));
      setBusyStage(null);
    }
  };

  const highlights = [
    { Icon: Users, top: t('micro.hl1Top'), bottom: t('micro.hl1Bottom') },
    { Icon: Globe, top: t('micro.hl2Top'), bottom: t('micro.hl2Bottom') },
    { Icon: CircleDollarSign, top: t('micro.hl3Top'), bottom: t('micro.hl3Bottom') },
  ];

  const steps = [
    { Icon: FilePen, n: 1 },
    { Icon: Search, n: 2 },
    { Icon: ClipboardCheck, n: 3 },
    { Icon: ChartNoAxesCombined, n: 4 },
    { Icon: BadgeCheck, n: 5 },
  ];

  const plans = [
    {
      n: 1, tag: t('micro.tagFree'), Icon: Search, price: '$0',
      period: t('micro.plan1Period'),
      features: ['plan1F1', 'plan1F2', 'plan1F3'],
      cta: t('micro.plan1Cta'), ghost: true, key: 'plan1',
    },
    {
      n: 2, tag: t('micro.tagPopular'), Icon: ChartNoAxesCombined, price: '$9',
      period: t('micro.perMonth'),
      features: ['plan2F1', 'plan2F2', 'plan2F3', 'plan2F4'],
      cta: t('micro.getStarted'), key: 'plan2',
    },
    {
      n: 3, tag: t('micro.tagBest'), Icon: ShieldCheck, price: '$49',
      period: t('micro.perMonth'),
      features: ['plan3F1', 'plan3F2', 'plan3F3', 'plan3F4'],
      cta: t('micro.getStarted'), key: 'plan3',
    },
  ];

  return (
    <div className="micro">
      <PublicNav />
      <SegmentBar active="micro" />

      {/* ---------------- Hero ---------------- */}
      <section className="micro-hero">
        <div className="micro-container micro-hero__inner">
          <div className="micro-hero__copy">
            <span className="micro-pill">{t('micro.badge')}</span>
            <h1 className="micro-hero__title">
              {t('micro.heroTitleA')}
              <br />
              {t('micro.heroTitleB')} <span className="micro-accent">{t('micro.heroTitleAccent')}</span>
            </h1>
            <p className="micro-hero__tagline">{t('micro.heroTagline')}</p>
            <p className="micro-hero__desc">{t('micro.heroDesc')}</p>

            <ul className="micro-highlights">
              {highlights.map(({ Icon, top, bottom }) => (
                <li key={top} className="micro-highlights__item">
                  <Icon size={26} strokeWidth={1.5} className="micro-highlights__icon" />
                  <span className="micro-highlights__text">
                    <strong>{top}</strong>
                    <span>{bottom}</span>
                  </span>
                </li>
              ))}
            </ul>

            <div className="micro-hero__actions">
              <Link to={gapPath} className="micro-btn micro-btn--primary">
                {t('micro.ctaPrimary')} <ArrowRight size={16} />
              </Link>
              <a href="#micro-journey" className="micro-btn micro-btn--ghost">
                {t('micro.ctaSecondary')} <Play size={14} />
              </a>
            </div>
          </div>

          <div className="micro-hero__visual">
            <HeroArt />
            <div className="micro-only">
              <Users size={34} className="micro-only__icon" />
              <div className="micro-only__text">
                <span>{t('micro.onlyLabel')}</span>
                <strong>{t('micro.onlyValue')}</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------- Five-step journey ---------------- */}
      <section className="micro-section micro-section--alt" id="micro-journey">
        <div className="micro-container">
          <p className="micro-eyebrow">{t('micro.journeyEyebrow')}</p>
          <h2 className="micro-h2">{t('micro.journeyTitle')}</h2>
          <ol className="micro-steps">
            {steps.map(({ Icon, n }) => (
              <li key={n} className="micro-step">
                <span className="micro-step__num">{n}</span>
                <Icon size={44} strokeWidth={1.2} className="micro-step__icon" />
                <h3 className="micro-step__title">{t(`micro.step${n}Title`)}</h3>
                <p className="micro-step__desc">{t(`micro.step${n}Desc`)}</p>
                {n < 5 && <ArrowRight size={16} className="micro-step__arrow" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------- Pricing ---------------- */}
      <section className="micro-section micro-section--pricing">
        <div className="micro-container">
          <p className="micro-eyebrow">{t('micro.pricingEyebrow')}</p>
          <h2 className="micro-h2">{t('micro.pricingTitle')}</h2>
          <p className="micro-sub">{t('micro.pricingSub')}</p>

          <div className="micro-pricing">
            {plans.map((p) => (
              <article key={p.key} className="micro-plan">
                <div className="micro-plan__top">
                  <span className="micro-tag">{t('micro.stepLabel', { n: p.n })}</span>
                  <span className={`micro-tag micro-tag--pill${p.n === 1 ? ' micro-tag--plain' : ''}`}>{p.tag}</span>
                </div>
                <div className="micro-plan__head">
                  <span className="micro-plan__badge"><p.Icon size={26} strokeWidth={1.5} /></span>
                  <div>
                    <h3 className="micro-plan__title">{t(`micro.${p.key}Title`)}</h3>
                    <p className="micro-plan__desc">{t(`micro.${p.key}Desc`)}</p>
                  </div>
                </div>
                <div className="micro-plan__price">{p.price}</div>
                <div className="micro-plan__period">{p.period}</div>
                <ul className="micro-plan__features">
                  {p.features.map((f) => (
                    <li key={f}><Check size={15} /> {t(`micro.${f}`)}</li>
                  ))}
                </ul>
                {p.n === 1 ? (
                  <Link to={gapPath} className="micro-btn micro-btn--block micro-btn--outline">
                    {p.cta}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="micro-btn micro-btn--block micro-btn--primary"
                    onClick={() => startPlan(p.n)}
                    disabled={busyStage !== null}
                  >
                    {busyStage === p.n ? t('micro.redirecting') : p.cta}
                  </button>
                )}
                {p.n < 3 && <span className="micro-plan__chev" aria-hidden="true">›</span>}
              </article>
            ))}

            <aside className="micro-cert">
              <div className="micro-cert__head">
                <Award size={30} strokeWidth={1.5} className="micro-cert__icon" />
                <h3>{t('micro.certTitle')}</h3>
              </div>
              <p>{t('micro.certDesc')}</p>
              <p>{t('micro.certNote')}</p>
              <Lock size={22} className="micro-cert__lock" />
            </aside>
          </div>

          {payError && <p className="micro-pay-error" role="alert">{payError}</p>}

          <div className="micro-banner">
            <Users size={36} strokeWidth={1.6} className="micro-banner__icon" />
            <div className="micro-banner__text">
              <strong>{t('micro.bannerMain')}</strong>
              <span className="micro-accent">{t('micro.bannerAccent')}</span>
            </div>
            <Link to={joinPath} className="micro-btn micro-btn--primary">
              {t('micro.bannerCta')} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---------------- Footer ---------------- */}
      <footer className="micro-footer">
        <div className="micro-container">
          <div className="micro-footer__cols">
            <div className="micro-footer__brand">
              <BrandLogo size={26} />
              <p>{t('micro.footerTagline')}</p>
            </div>
            <div className="micro-footer__col">
              <h4>{t('micro.footPlatform')}</h4>
              <Link to="/#how-it-works">{t('nav.howItWorks')}</Link>
              <Link to="/#standards">{t('nav.standards')}</Link>
              <Link to="/#benefits">{t('nav.benefits')}</Link>
              <Link to="/micro">{t('nav.micro')}</Link>
            </div>
            <div className="micro-footer__col">
              <h4>{t('micro.footResources')}</h4>
              <a href="https://certify.cx/blog">{t('micro.blog')}</a>
              <a href="https://certify.cx/guides">{t('micro.guides')}</a>
              <a href="https://certify.cx/help">{t('micro.helpCenter')}</a>
              <a href="https://certify.cx/faq">{t('micro.faqs')}</a>
            </div>
            <div className="micro-footer__col">
              <h4>{t('micro.footCompany')}</h4>
              <a href="https://certify.cx/about">{t('micro.aboutUs')}</a>
              <a href="mailto:support@certify.cx">{t('micro.contactUs')}</a>
              <a href="https://certify.cx/careers">{t('micro.careers')}</a>
              <Link to="/register/referral">{t('micro.partners')}</Link>
            </div>
            <div className="micro-footer__col micro-footer__col--social">
              <h4>{t('micro.footFollow')}</h4>
              <div className="micro-social">
                <a href="https://www.linkedin.com/company/certifycx" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><Linkedin size={16} /></a>
                <a href="https://twitter.com/certifycx" aria-label="Twitter" target="_blank" rel="noopener noreferrer"><Twitter size={16} /></a>
                <a href="https://www.youtube.com/@certifycx" aria-label="YouTube" target="_blank" rel="noopener noreferrer"><Youtube size={16} /></a>
                <a href="mailto:support@certify.cx" aria-label="Email"><Mail size={16} /></a>
              </div>
            </div>
          </div>
          <div className="micro-footer__bottom">
            <span>{t('micro.copyright')}</span>
            <span className="micro-footer__legal">
              <Link to="/privacy">{t('micro.privacy')}</Link>
              <Link to="/terms">{t('micro.terms')}</Link>
              <Link to="/privacy">{t('micro.cookies')}</Link>
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
