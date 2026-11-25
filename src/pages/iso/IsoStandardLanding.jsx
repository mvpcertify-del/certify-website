import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight, CalendarCheck, Check, ChevronRight, ShoppingCart, ClipboardList, SearchCheck, FileText, Cog, Award,
  BadgeCheck, Smile, Gauge, Trophy, TrendingUp, Leaf, Scale, Recycle, Handshake, Sprout,
  HardHat, ShieldAlert, HeartPulse, Lock, ShieldCheck, RefreshCw,
  Users, SlidersHorizontal, LayoutDashboard, Landmark, Clock, Building2, Sparkles,
} from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import MicroFooter from '../micro/MicroFooter';
import SEO from '../../components/seo/SEO';
import PricingTiers from '../../components/pricing/PricingTiers';
import useStartCheckout from '../../components/pricing/useStartCheckout';
import { computeTotal } from '../../utils/pricing';
import { ISO_LANDINGS, ISO_LANDING_LIST, ISO_HUB_PATH, PROCESS, WHY_US, GLANCE } from '../../content/isoLandings';
import IsoArt from './IsoArt';
import useJsonLd from './useJsonLd';
import './IsoStandardLanding.css';

// SEO landing page for one flagship standard (/iso-9001-certification and its three siblings).
// Content: src/content/isoLandings.js. The buy buttons open the existing pay-first checkout for the standard
// (useStartCheckout), and the price shown is the one checkout charges (utils/pricing.js).

const SITE = 'https://certify.cx';
const WHATSAPP = 'https://wa.me/971506449356';

const BENEFIT_ICONS = { BadgeCheck, Smile, Gauge, Trophy, TrendingUp, Leaf, Scale, Recycle, Handshake, Sprout, HardHat, ShieldAlert, HeartPulse, Lock, ShieldCheck, RefreshCw };
const STEP_ICONS = [ClipboardList, SearchCheck, FileText, Cog, Award];
const WHY_ICONS = [Users, SlidersHorizontal, LayoutDashboard, Landmark];

export default function IsoStandardLanding({ slug }) {
  const d = ISO_LANDINGS[slug];
  const startCheckout = useStartCheckout(slug);
  const price = d ? computeTotal({ standardSlug: slug }).subtotal : 0;

  const jsonLd = d ? {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Service',
        name: `${d.display} ${d.name}`,
        serviceType: `${d.short} certification`,
        description: d.description,
        url: `${SITE}${d.path}`,
        provider: { '@type': 'Organization', name: 'Certify.cx', url: SITE },
        areaServed: 'Worldwide',
        offers: { '@type': 'Offer', price: String(price), priceCurrency: 'USD', url: `${SITE}${d.path}#pricing`, availability: 'https://schema.org/InStock' },
      },
      {
        '@type': 'FAQPage',
        mainEntity: d.faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
          { '@type': 'ListItem', position: 2, name: 'ISO certification', item: `${SITE}${ISO_HUB_PATH}` },
          { '@type': 'ListItem', position: 3, name: d.display, item: `${SITE}${d.path}` },
        ],
      },
    ],
  } : null;
  useJsonLd(slug, jsonLd);

  if (!d) return <Navigate to={ISO_HUB_PATH} replace />;

  return (
    <>
      <SEO title={d.title} description={d.description} path={d.path} />
      <div className="isol" style={{ '--isol-a-dark': d.accent, '--isol-a-light': d.accentLight }}>
        <PublicNav />

        <header className="isol-hero pubnav-offset">
          <div className="isol-container">
            <nav className="isol-crumbs" aria-label="Breadcrumb">
              <Link to="/">Home</Link><ChevronRight size={14} />
              <Link to={ISO_HUB_PATH}>ISO certification</Link><ChevronRight size={14} />
              <span aria-current="page">{d.display}</span>
            </nav>
            <div className="isol-hero__inner">
              <div className="isol-hero__copy">
                <span className="isol-pill"><Sparkles size={14} /> {d.tag}</span>
                <h1 className="isol-h1">
                  <span className="isol-h1__code">{d.display}</span>
                  {d.name}
                </h1>
                <p className="isol-lead">{d.lead}</p>
                <div className="isol-cta">
                  <button type="button" className="isol-btn isol-btn--primary" onClick={startCheckout}>
                    <ShoppingCart size={17} /> Buy now · ${price.toLocaleString()}
                  </button>
                  <Link to="/gap-analysis" className="isol-btn isol-btn--ghost">Free gap analysis <ArrowRight size={16} /></Link>
                </div>
                <ul className="isol-assure">
                  <li><Check size={15} /> One all-inclusive package</li>
                  <li><Check size={15} /> Up to 50 employees, 1 location</li>
                  <li><Check size={15} /> Pay once, no signup first</li>
                </ul>
              </div>
              <IsoArt slug={d.slug} motif={d.motif} seal={d.seal} chips={d.chips} />
            </div>
          </div>
        </header>

        <section className="isol-trust" aria-label="Why Certify.cx">
          <div className="isol-container isol-trust__inner">
            {WHY_US.map(([title, text], i) => {
              const Icon = WHY_ICONS[i] || Users;
              return (
                <div key={title}>
                  <span className="isol-trust__icon"><Icon size={20} /></span>
                  <span><b>{title}</b><small>{text}</small></span>
                </div>
              );
            })}
          </div>
        </section>

        <main>
          <section className="isol-section">
            <div className="isol-container isol-two">
              <div>
                <h2 className="isol-h2">What is {d.display}?</h2>
                <p className="isol-p">{d.intro}</p>
                {d.edition && <p className="isol-note">{d.edition}</p>}
                <p className="isol-p"><b>Who it is for.</b> {d.forWho}</p>
              </div>
              <aside className="isol-glance" aria-label={`${d.short} at a glance`}>
                <h3><Building2 size={18} /> {d.short} at a glance</h3>
                <dl>
                  {GLANCE.map(([k, v]) => (<div key={k}><dt>{k}</dt><dd>{v}</dd></div>))}
                </dl>
                <button type="button" className="isol-btn isol-btn--primary isol-btn--block" onClick={startCheckout}>
                  Get {d.short} certified <ArrowRight size={16} />
                </button>
              </aside>
            </div>
          </section>

          <section className="isol-section isol-section--alt">
            <div className="isol-container">
              <h2 className="isol-h2 isol-center">{d.benefitsTitle}</h2>
              <p className="isol-sub isol-center">What changes for your organisation once the system is in place and certified.</p>
              <div className="isol-benefits">
                {d.benefits.map(([title, text, icon]) => {
                  const Icon = BENEFIT_ICONS[icon] || BadgeCheck;
                  return (
                    <article className="isol-benefit" key={title}>
                      <span className="isol-benefit__icon"><Icon size={22} /></span>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </article>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="isol-section">
            <div className="isol-container">
              <h2 className="isol-h2 isol-center">{d.requirementsTitle}</h2>
              <p className="isol-sub isol-center">The areas an auditor will look at, in plain language.</p>
              <ol className="isol-reqs">
                {d.requirements.map(([title, text], i) => (
                  <li key={title}><span className="isol-reqs__n">{i + 1}</span><div><b>{title}</b><p>{text}</p></div></li>
                ))}
              </ol>
            </div>
          </section>

          <section className="isol-section isol-section--alt">
            <div className="isol-container">
              <h2 className="isol-h2 isol-center">Our certification process</h2>
              <p className="isol-sub isol-center"><Clock size={14} /> Five clear steps from first question to certificate.</p>
              <ol className="isol-steps">
                {PROCESS.map(([title, text], i) => {
                  const Icon = STEP_ICONS[i] || Check;
                  return (
                    <li key={title}>
                      <span className="isol-steps__n"><Icon size={20} /></span>
                      <small>Step {i + 1}</small>
                      <h3>{title}</h3>
                      <p>{text}</p>
                    </li>
                  );
                })}
              </ol>
            </div>
          </section>

          <section className="isol-section" id="pricing">
            <div className="isol-container isol-pricing">
              <PricingTiers standardSlug={d.slug} standardCode={d.display} />
              <p className="isol-pricing__alt">
                Not sure yet? <Link to="/gap-analysis">Take the free gap analysis</Link> or <a href={WHATSAPP} target="_blank" rel="noopener noreferrer">talk to an expert</a>.
              </p>
            </div>
          </section>

          <section className="isol-section isol-section--alt">
            <div className="isol-container isol-narrow">
              <h2 className="isol-h2 isol-center">{d.short} frequently asked questions</h2>
              <div className="isol-faq">
                {d.faqs.map(([q, a]) => (
                  <details key={q}><summary>{q}</summary><p>{a}</p></details>
                ))}
              </div>
            </div>
          </section>

          <section className="isol-band">
            <div className="isol-container isol-band__inner">
              <CalendarCheck size={42} aria-hidden="true" />
              <div>
                <h2>Ready to get {d.display} certified?</h2>
                <p>Our experts help you prepare, then connect you with an accredited certification body.</p>
              </div>
              <div className="isol-band__actions">
                <button type="button" className="isol-btn isol-btn--light" onClick={startCheckout}><ShoppingCart size={17} /> Buy now · ${price.toLocaleString()}</button>
                <a href={WHATSAPP} className="isol-btn isol-btn--outline" target="_blank" rel="noopener noreferrer">Talk to an expert</a>
              </div>
            </div>
          </section>

          <section className="isol-section isol-section--tight">
            <div className="isol-container">
              <h2 className="isol-h3 isol-center">Explore other certifications</h2>
              <div className="isol-links">
                {ISO_LANDING_LIST.filter((o) => o.slug !== d.slug).map((o) => (
                  <Link key={o.slug} to={o.path} style={{ '--isol-a-dark': o.accent, '--isol-a-light': o.accentLight }}>
                    <b>{o.display}</b><small>{o.name.replace(' Certification', '')}</small>
                  </Link>
                ))}
                <Link to="/certifications" className="isol-links__all"><b>All 12 standards</b><small>See the full list</small></Link>
              </div>
            </div>
          </section>
        </main>

        <MicroFooter />
      </div>
    </>
  );
}
