import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  ArrowRight, Globe, Scale, ShieldCheck, Search,
  ChartNoAxesCombined, CircleCheckBig, BadgeCheck, Clock, Rocket, Cpu, Handshake,
  Presentation, Users, Landmark, Laptop, Sparkles, Linkedin, Youtube, Facebook,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import SaraChatWidget from '../../components/sara/SaraChatWidget';
import PublicNav from '../../components/layout/PublicNav';
import BrandLogo from '../../components/ui/BrandLogo';
import SegmentBar from '../../components/layout/SegmentBar';
import saraHero from '../../assets/home-sara.jpg';
import worldMap from '../../assets/home-world.jpg';
import './LandingPage.css';

// ============================================
// Certify.cx — Home page (/)
// ============================================
// Redesigned 4 Nov 2026 from the client's "One Global Compliance Marketplace"
// design: segment bar (MICRO / SMEs / ENTERPRISE), hero with Sara, trust strip,
// "Why Choose", the marketplace banner, a global-platform block and the footer.
// Only the new design lives here. The original home page (ISO standard cards,
// Compliance Audits, How It Works, Benefits) is kept untouched at /sme and is
// reached from the SMEs segment (5 Nov, client request: do not mix old and new).

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

  // "Chat with Sara" sits under her picture while the hero is on screen; the
  // floating bottom-right button is hidden meanwhile and returns once the hero
  // has scrolled out of view.
  const saraRef = useRef(null);
  const [saraInView, setSaraInView] = useState(() => typeof IntersectionObserver !== 'undefined');
  useEffect(() => {
    const el = saraRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setSaraInView(entry.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Signed-in visitors skip the sign-up/login hops (same rule as /micro).
  const isIn = !loading && !!user;
  const gapPath = isIn && user.role === ROLES.CLIENT ? '/client/gap-analysis' : '/gap-analysis';
  const trackPath = isIn ? getRoleDashboard(user.role) : '/login';
  const joinPath = isIn ? getRoleDashboard(user.role) : '/signup';

  const ACTIONS = [
    { Icon: Search, label: t('home.actFind'), to: '/sme' },
    { Icon: ChartNoAxesCombined, label: t('home.actGap'), to: gapPath },
    { Icon: Scale, label: t('home.actCompare'), to: '/sme#standards' },
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
    { iso: true, label: t('home.tileIso'), to: '/sme#standards', tone: 'blue' },
    { Icon: Presentation, label: t('home.tileTrain'), to: '/sme', tone: 'green' },
    { Icon: Users, label: t('home.tileAud'), to: '/register/auditor', tone: 'purple' },
    { Icon: Landmark, label: t('home.tileCb'), to: '/register/certification-body', tone: 'gold' },
    { Icon: Laptop, label: t('home.tileSol'), to: '/sme#compliance-audits', tone: 'sky' },
  ];

  return (
    <div className="home">
      {/* ---- Header (unchanged shared nav) ---- */}
      <PublicNav />

      <main className="home__top">
        {/* ---- Segment bar (shared with /sme and /micro) ---- */}
        <SegmentBar active="sme" />

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
              <Link to={gapPath} className="home__btn home__btn--primary">
                {t('nav.startGapAnalysis')} <ArrowRight size={18} />
              </Link>
            </div>

            <div className="home__hero-sara" ref={saraRef}>
              <img src={saraHero} alt="Sara, your AI compliance assistant" className="home__sara-img" />
              <button type="button" className="home__chat" onClick={openSara}>
                <Sparkles size={20} /> {t('sara.chatWithSara')}
              </button>
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
              <Link to="/sme" className="home__btn home__btn--ghost home__btn--sm">
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
            <Link to={isIn ? joinPath : gapPath} className="home__btn home__btn--ghost">
              {isIn ? t('home.globalCta') : t('nav.startGapAnalysis')} <ArrowRight size={16} />
            </Link>
          </div>
        </div>
      </section>

      {/* ---- Footer ---- */}
      <footer className="home__footer">
        <div className="home__container">
          {/* Full link columns (restored from the previous footer). */}
          <div className="home__footer-cols">
            <div className="home__footer-col">
              <h4>{t('landing.footerProduct')}</h4>
              <Link to="/sme#how-it-works">{t('nav.howItWorks')}</Link>
              <Link to="/sme#standards">{t('landing.footerISOStandards')}</Link>
              <Link to="/sme#compliance-audits">{t('compliance.title')}</Link>
              <Link to="/sme#benefits">{t('nav.benefits')}</Link>
              <Link to="/micro">{t('nav.micro')}</Link>
              <Link to="/certifications">{t('landing.footerGetCertified')}</Link>
            </div>
            <div className="home__footer-col">
              <h4>{t('landing.footerAccount')}</h4>
              <Link to="/login">{t('nav.login')}</Link>
              <Link to="/signup">{t('landing.footerSignUp')}</Link>
              <Link to="/forgot-password">{t('landing.footerResetPassword')}</Link>
            </div>
            <div className="home__footer-col">
              <h4>{t('landing.footerLegal')}</h4>
              <Link to="/privacy">{t('auth.privacyLink')}</Link>
              <Link to="/terms">{t('auth.termsLink')}</Link>
            </div>
            <div className="home__footer-col">
              <h4>{t('landing.footerJoinNetwork')}</h4>
              <Link to="/register/auditor">{t('stakeholder.auditor.singular')}</Link>
              <Link to="/register/certification-body">{t('stakeholder.certificationBody.singular')}</Link>
              <Link to="/register/consultancy">{t('stakeholder.consultancy.singular')}</Link>
              <Link to="/register/referral">{t('stakeholder.referral.singular')}</Link>
              <Link to="/register/contractor">{t('stakeholder.contractor.singular')}</Link>
            </div>
          </div>

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

          <p className="home__footer-copy">{t('common.allRightsReserved')}</p>
        </div>
      </footer>

      <SaraChatWidget fabHidden={saraInView} />
    </div>
  );
}
