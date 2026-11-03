import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, Award, Globe2, Globe, Shield, Lock, Apple, GraduationCap, Zap, Scale,
  Activity, Stethoscope, ShieldCheck, BrainCircuit, FileCheck2, Building2, Building,
  ChevronRight, CreditCard, Store, Search, ChartNoAxesCombined, CircleCheckBig,
  BadgeCheck, Clock, Rocket, Cpu, Handshake, Presentation, Users, Landmark, Laptop,
  Linkedin, Youtube, Facebook,
} from 'lucide-react';
import { ISO_CATALOG_LIST } from '../../utils/isoCatalog';
import { COMPLIANCE_AUDIT_LIST } from '../../utils/complianceAudits';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import ComplianceLogo from '../../components/ui/ComplianceLogo';
import SaraChatWidget from '../../components/sara/SaraChatWidget';
import PublicNav from '../../components/layout/PublicNav';
import BrandLogo from '../../components/ui/BrandLogo';
import saraHero from '../../assets/home-sara.jpg';
import worldMap from '../../assets/home-world.jpg';
import './LandingPage.css';

// ============================================
// Certify.cx — Home page (/)
// ============================================
// Redesigned 4 Nov 2026 from the client's "One Global Compliance Marketplace"
// design: segment bar (MICRO / SMEs / ENTERPRISE), hero with Sara, trust strip,
// "Why Choose", the marketplace banner, a global-platform block and the slim
// footer. The ISO standard cards, Compliance Audit cards and How It Works steps
// are kept (restyled) below the marketplace banner, because the header's
// How It Works / Standards / Benefits anchors point at them.

// Phase 1 (retired): we originally featured ISO 9001 only and hid the rest of
// the funnel. All standards are now published publicly, so this flag is off.
// Per-standard visibility is still controlled by `iso_link_settings.is_active`
// (managed from the Super Admin "Shareable Links" page).
const PHASE_1_ISO_9001_ONLY = false;

const ICON_MAP = {
  Award, Globe2, Shield, Lock, Apple, GraduationCap, Zap, Scale, Activity, Stethoscope,
  ShieldCheck, BrainCircuit,
};

const openSara = () => window.dispatchEvent(new Event('certify:open-sara'));

// The X (Twitter) mark — lucide only ships the old bird.
function XMark({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();
  const { user, loading, getRoleDashboard } = useAuth();

  // Signed-in visitors skip the sign-up/login hops (same rule as /micro).
  const isIn = !loading && !!user;
  const gapPath = isIn && user.role === ROLES.CLIENT ? '/client/gap-analysis' : '/gap-analysis';
  const trackPath = isIn ? getRoleDashboard(user.role) : '/login';
  const joinPath = isIn ? getRoleDashboard(user.role) : '/signup';

  const visibleIsos = PHASE_1_ISO_9001_ONLY
    ? ISO_CATALOG_LIST.filter(iso => iso.slug === 'iso-9001')
    : ISO_CATALOG_LIST;

  const ISO_STANDARDS = visibleIsos.map(iso => ({
    slug: iso.slug,
    code: iso.code,
    fullCode: iso.fullCode,
    title: t(iso.titleKey),
    desc: t(iso.descKey),
    icon: ICON_MAP[iso.icon] || Award,
    color: iso.color,
  }));

  const STEPS = [
    { step: '01', title: t('landing.step1Title'), desc: t('landing.step1Desc'), icon: Building2 },
    { step: '02', title: t('landing.step2Title'), desc: t('landing.step2Desc'), icon: FileCheck2 },
    { step: '03', title: t('landing.step3Title'), desc: t('landing.step3Desc'), icon: CreditCard },
    { step: '04', title: t('landing.step4Title'), desc: t('landing.step4Desc'), icon: Award },
  ];

  const SEGMENTS = [
    { Icon: Store, name: t('home.segMicro'), sub: t('home.segMicroSub'), to: '/micro' },
    { Icon: Building2, name: t('home.segSme'), sub: t('home.segSmeSub'), to: '/certifications', active: true },
    { Icon: Building, name: t('home.segEnt'), sub: t('home.segEntSub'), to: gapPath },
  ];

  const ACTIONS = [
    { Icon: Search, label: t('home.actFind'), to: '/certifications' },
    { Icon: ChartNoAxesCombined, label: t('home.actGap'), to: gapPath },
    { Icon: Scale, label: t('home.actCompare'), to: '/#standards' },
    { Icon: CircleCheckBig, label: t('home.actTrack'), to: trackPath },
  ];

  const TRUST = [
    { Icon: Globe, label: t('home.trust1') },
    { Icon: ShieldCheck, label: t('home.trust2') },
    { Icon: BadgeCheck, label: t('home.trust3') },
    { Icon: Clock, label: t('home.trust4') },
  ];

  const WHY = [
    { Icon: Rocket, t: t('home.why1T'), d: t('home.why1D') },
    { Icon: Globe, t: t('home.why2T'), d: t('home.why2D') },
    { Icon: Cpu, t: t('home.why3T'), d: t('home.why3D') },
    { Icon: ShieldCheck, t: t('home.why4T'), d: t('home.why4D') },
    { Icon: Handshake, t: t('home.why5T'), d: t('home.why5D') },
  ];

  const TILES = [
    { iso: true, label: t('home.tileIso'), to: '/#standards', tone: 'blue' },
    { Icon: Presentation, label: t('home.tileTrain'), to: '/certifications', tone: 'green' },
    { Icon: Users, label: t('home.tileAud'), to: '/register/auditor', tone: 'purple' },
    { Icon: Landmark, label: t('home.tileCb'), to: '/register/certification-body', tone: 'gold' },
    { Icon: Laptop, label: t('home.tileSol'), to: '/#compliance-audits', tone: 'sky' },
  ];

  return (
    <div className="home">
      {/* ---- Header (unchanged shared nav) ---- */}
      <PublicNav />

      <main className="home__top">
        {/* ---- Segment bar ---- */}
        <div className="home__container">
          <nav className="home__segments" aria-label="Company size">
            {SEGMENTS.map(({ Icon, name, sub, to, active }) => (
              <Link key={name} to={to} className={`home__seg${active ? ' home__seg--active' : ''}`}>
                <Icon size={34} strokeWidth={1.5} className="home__seg-icon" />
                <span className="home__seg-text">
                  <strong>{name}</strong>
                  <span>{sub}</span>
                </span>
                <ArrowRight size={16} className="home__seg-arrow" />
              </Link>
            ))}
          </nav>
        </div>

        {/* ---- Hero ---- */}
        <section className="home__hero">
          <div className="home__container home__hero-grid">
            <div className="home__hero-copy">
              <h1 className="home__hero-title">
                {t('home.heroTitleA')}<br />
                {t('home.heroTitleB')}<br />
                <span className="home__accent">{t('home.heroTitleAccent')}</span>
              </h1>
              <p className="home__hero-tagline">
                {t('home.heroTaglineA')}<br />{t('home.heroTaglineB')}
              </p>
              <p className="home__hero-sub">{t('home.heroSub')}</p>
              <Link to="/certifications" className="home__btn home__btn--primary">
                {t('home.heroCta')} <ArrowRight size={18} />
              </Link>
            </div>

            <div className="home__hero-sara">
              <img src={saraHero} alt="Sara, your AI compliance assistant" className="home__sara-img" />
            </div>

            <div className="home__hero-side">
              <button type="button" className="home__bubble" onClick={openSara}>
                <strong>{t('home.saraHello')}</strong>
                <span>{t('home.saraRole')}</span>
                <small>{t('home.saraAsk')}</small>
              </button>
              <ul className="home__actions">
                {ACTIONS.map(({ Icon, label, to }) => (
                  <li key={label}>
                    <Link to={to} className="home__action">
                      <Icon size={20} strokeWidth={1.6} />
                      <span>{label}</span>
                      <ArrowRight size={16} />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* ---- Trust strip ---- */}
        <div className="home__container">
          <ul className="home__trust">
            {TRUST.map(({ Icon, label }) => (
              <li key={label} className="home__trust-item">
                <Icon size={32} strokeWidth={1.4} className="home__trust-icon" />
                <span>{label}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* ---- Why choose (header "Benefits" anchor) ---- */}
        <section className="home__why" id="benefits">
          <div className="home__container">
            <h2 className="home__why-title">
              <span>{t('home.whyTitle')} <em className="home__accent">{t('home.whyBrand')}</em> ?</span>
            </h2>
            <ul className="home__why-grid">
              {WHY.map(({ Icon, t: title, d }) => (
                <li key={title} className="home__why-item">
                  <Icon size={34} strokeWidth={1.4} className="home__why-icon" />
                  <h3>{title}</h3>
                  <p>{d}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* ---- Marketplace banner ---- */}
        <div className="home__container">
          <section className="home__market" id="marketplace">
            <div className="home__market-copy">
              <h2>{t('home.mktTitle')}</h2>
              <p>{t('home.mktDesc')}</p>
              <Link to="/certifications" className="home__btn home__btn--primary home__btn--sm">
                {t('home.mktCta')} <ArrowRight size={16} />
              </Link>
            </div>
            <ul className="home__tiles">
              {TILES.map(({ iso, Icon, label, to, tone }) => (
                <li key={label}>
                  <Link to={to} className={`home__tile home__tile--${tone}`}>
                    {iso ? <span className="home__tile-iso">ISO</span> : <Icon size={38} strokeWidth={1.4} />}
                    <span>{label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      {/* ---- Supported ISO Standards ---- */}
      <section className="home__section" id="standards">
        <div className="home__container">
          <div className="home__section-header">
            <span className="home__section-tag">{t('landing.standardsTag')}</span>
            <h2 className="home__section-title">{t('landing.supportedStandards')}</h2>
            <p className="home__section-desc">{t('landing.supportedStandardsDesc')}</p>
          </div>
          <div className={`home__cards ${ISO_STANDARDS.length === 1 ? 'home__cards--single' : ''}`}>
            {ISO_STANDARDS.map((std) => (
              <Link
                key={std.code}
                to={`/iso/${std.slug}`}
                className="home__card"
                style={{ '--card-accent': std.color }}
              >
                <div className="home__card-icon"><std.icon size={28} /></div>
                <div className="home__card-code">{std.fullCode || std.code}</div>
                <h3 className="home__card-title">{std.title}</h3>
                <p className="home__card-desc">{std.desc}</p>
                <span className="home__card-cta">
                  {t('iso.applyNow')} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- Compliance Audits (each card opens /compliance/:slug) ---- */}
      <section className="home__section home__section--alt" id="compliance-audits">
        <div className="home__container">
          <div className="home__section-header">
            <span className="home__section-tag">{t('compliance.tag')}</span>
            <h2 className="home__section-title">{t('compliance.title')}</h2>
            <p className="home__section-desc">{t('compliance.desc')}</p>
          </div>
          <div className="home__cards">
            {COMPLIANCE_AUDIT_LIST.map((audit) => (
              <Link
                key={audit.id}
                to={`/compliance/${audit.slug}`}
                className="home__card"
                style={{ '--card-accent': audit.accent }}
              >
                <div className="home__card-logo">
                  <ComplianceLogo src={audit.logo} title={t(audit.titleKey)} size={56} />
                </div>
                <h3 className="home__card-title">{t(audit.titleKey)}</h3>
                <p className="home__card-desc">{t(audit.descKey)}</p>
                <span className="home__card-cta">
                  {t('compliance.viewDetails')} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ---- How It Works (header anchor) ---- */}
      <section className="home__section" id="how-it-works">
        <div className="home__container">
          <div className="home__section-header">
            <span className="home__section-tag">{t('landing.processTag')}</span>
            <h2 className="home__section-title">{t('landing.howCertWorks')}</h2>
            <p className="home__section-desc">{t('landing.howCertDesc')}</p>
          </div>
          <ol className="home__steps">
            {STEPS.map((s, i) => (
              <li key={s.step} className="home__step">
                <span className="home__step-number">{s.step}</span>
                <span className="home__step-icon"><s.icon size={24} /></span>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
                {i < STEPS.length - 1 && <ChevronRight size={18} className="home__step-arrow" aria-hidden="true" />}
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---- Global platform ---- */}
      <section className="home__global">
        <div className="home__container home__global-grid">
          <div className="home__global-map">
            <img src={worldMap} alt="" aria-hidden="true" />
          </div>
          <div className="home__global-copy">
            <h2>
              {t('home.globalTitleA')}<br />
              {t('home.globalTitleB')} <span className="home__accent">{t('home.globalTitleAccent')}</span>
            </h2>
            <p>{t('home.globalDesc')}</p>
            <Link to={joinPath} className="home__btn home__btn--ghost">
              {t('home.globalCta')} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="home__footer">
        <div className="home__container">
          <div className="home__footer-bar">
            <BrandLogo size={40} className="home__footer-logo" />
            <span className="home__footer-divider" aria-hidden="true" />
            <p className="home__footer-tag">{t('home.footTag')}</p>
            <div className="home__social">
              <a href="https://www.linkedin.com/company/certifycx" aria-label="LinkedIn" target="_blank" rel="noopener noreferrer"><Linkedin size={18} /></a>
              <a href="https://www.youtube.com/@certifycx" aria-label="YouTube" target="_blank" rel="noopener noreferrer"><Youtube size={18} /></a>
              <a href="https://twitter.com/certifycx" aria-label="X" target="_blank" rel="noopener noreferrer"><XMark size={17} /></a>
              <a href="https://www.facebook.com/certifycx" aria-label="Facebook" target="_blank" rel="noopener noreferrer"><Facebook size={18} /></a>
            </div>
          </div>

          {/* Kept from the previous footer: legal links and the Join Our Network
              registration links, which are not part of the design but must stay
              reachable. */}
          <div className="home__footer-links">
            <span className="home__footer-links-group">
              <Link to="/privacy">{t('auth.privacyLink')}</Link>
              <Link to="/terms">{t('auth.termsLink')}</Link>
            </span>
            <span className="home__footer-links-group">
              <Link to="/register/auditor">{t('stakeholder.auditor.singular')}</Link>
              <Link to="/register/certification-body">{t('stakeholder.certificationBody.singular')}</Link>
              <Link to="/register/consultancy">{t('stakeholder.consultancy.singular')}</Link>
              <Link to="/register/referral">{t('stakeholder.referral.singular')}</Link>
              <Link to="/register/contractor">{t('stakeholder.contractor.singular')}</Link>
            </span>
            <span className="home__footer-copy">{t('common.allRightsReserved')}</span>
          </div>
        </div>
      </footer>

      <SaraChatWidget />
    </div>
  );
}
