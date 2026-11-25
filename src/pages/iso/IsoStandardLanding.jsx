import { Link, Navigate } from 'react-router-dom';
import {
  ArrowRight, CalendarCheck, Check, ChevronRight,
  BadgeCheck, Smile, Gauge, Trophy, TrendingUp, Leaf, Scale, Recycle, Handshake, Sprout,
  HardHat, ShieldAlert, HeartPulse, Lock, ShieldCheck, RefreshCw,
  Users, SlidersHorizontal, LayoutDashboard, Landmark,
} from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import MicroFooter from '../micro/MicroFooter';
import SEO from '../../components/seo/SEO';
import { ISO_LANDINGS, ISO_LANDING_LIST, ISO_HUB_PATH, PROCESS, WHY_US } from '../../content/isoLandings';
import useJsonLd from './useJsonLd';
import './IsoStandardLanding.css';

// SEO landing page for one flagship standard (/iso-9001-certification and its three siblings).
// Frontend only: the "Get certified" button opens the existing pay-first checkout for that standard.
// Content: src/content/isoLandings.js. Layout follows the client's "ISO Certification Landing Page Collection".

const SITE = 'https://certify.cx';
const WHATSAPP = 'https://wa.me/971506449356';

const BENEFIT_ICONS = { BadgeCheck, Smile, Gauge, Trophy, TrendingUp, Leaf, Scale, Recycle, Handshake, Sprout, HardHat, ShieldAlert, HeartPulse, Lock, ShieldCheck, RefreshCw };
const WHY_ICONS = [Users, SlidersHorizontal, LayoutDashboard, Landmark];

function Seal({ lines }) {
  return (
    <div className="isol-seal" aria-hidden="true">
      <span className="isol-seal__ring">
        <small>CERTIFIED</small>
        <b>{lines[0]}</b>
        <i>{lines[1]}</i>
        <small>CERTIFIED</small>
      </span>
    </div>
  );
}

export default function IsoStandardLanding({ slug }) {
  const d = ISO_LANDINGS[slug];

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
  const apply = `/checkout?iso=${d.slug}`;

  return (
    <>
      <SEO title={d.title} description={d.description} path={d.path} />
      <div className="isol" style={{ '--isol-accent': d.accent, '--isol-soft': d.accentSoft }}>
        <PublicNav />

        <nav className="isol-crumbs pubnav-offset" aria-label="Breadcrumb">
          <div className="isol-container">
            <Link to="/">Home</Link> <ChevronRight size={14} /> <Link to={ISO_HUB_PATH}>ISO certification</Link> <ChevronRight size={14} /> <span>{d.display}</span>
          </div>
        </nav>

        <header className="isol-hero">
          <div className="isol-container isol-hero__inner">
            <div>
              <span className="isol-pill">{d.tag}</span>
              <h1 className="isol-h1">
                <span className="isol-h1__code">{d.display}</span>
                {d.name}
              </h1>
              <p className="isol-lead">{d.lead}</p>
              <div className="isol-cta">
                <Link to={apply} className="isol-btn isol-btn--primary">Get certified today <ArrowRight size={16} /></Link>
                <Link to="/gap-analysis" className="isol-btn isol-btn--ghost">Free gap analysis</Link>
              </div>
            </div>
            <Seal lines={d.seal} />
          </div>
        </header>

        <main>
          <section className="isol-section">
            <div className="isol-container isol-narrow">
              <h2 className="isol-h2">What is {d.display}?</h2>
              <p className="isol-p">{d.intro}</p>
              {d.edition && <p className="isol-p isol-p--note">{d.edition}</p>}
              <p className="isol-p"><b>Who it is for:</b> {d.forWho}</p>
            </div>
          </section>

          <section className="isol-section isol-section--alt">
            <div className="isol-container">
              <h2 className="isol-h2 isol-center">{d.benefitsTitle}</h2>
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
            <div className="isol-container isol-narrow">
              <h2 className="isol-h2">{d.requirementsTitle}</h2>
              <ul className="isol-reqs">
                {d.requirements.map(([title, text]) => (
                  <li key={title}><Check size={16} /><span><b>{title}.</b> {text}</span></li>
                ))}
              </ul>
            </div>
          </section>

          <section className="isol-section isol-section--alt">
            <div className="isol-container">
              <h2 className="isol-h2 isol-center">Our certification process</h2>
              <ol className="isol-steps">
                {PROCESS.map(([title, text], i) => (
                  <li key={title}><span className="isol-steps__n">{String(i + 1).padStart(2, '0')}</span><h3>{title}</h3><p>{text}</p></li>
                ))}
              </ol>
            </div>
          </section>

          <section className="isol-section">
            <div className="isol-container isol-narrow">
              <h2 className="isol-h2">{d.short} frequently asked questions</h2>
              <div className="isol-faq">
                {d.faqs.map(([q, a]) => (
                  <details key={q}><summary>{q}</summary><p>{a}</p></details>
                ))}
              </div>
            </div>
          </section>

          <section className="isol-band">
            <div className="isol-container isol-band__inner">
              <CalendarCheck size={44} aria-hidden="true" />
              <div>
                <h2>Ready to get {d.display} certified?</h2>
                <p>Our experts help you prepare, then connect you with an accredited certification body.</p>
              </div>
              <div className="isol-band__actions">
                <Link to={apply} className="isol-btn isol-btn--light">Get certified today</Link>
                <a href={WHATSAPP} className="isol-btn isol-btn--outline" target="_blank" rel="noopener noreferrer">Talk to an expert</a>
              </div>
            </div>
          </section>

          <section className="isol-section isol-section--tight">
            <div className="isol-container">
              <h2 className="isol-h3 isol-center">Other certifications</h2>
              <div className="isol-links">
                {ISO_LANDING_LIST.filter((o) => o.slug !== d.slug).map((o) => (
                  <Link key={o.slug} to={o.path} style={{ '--isol-accent': o.accent }}>{o.display}<small>{o.name}</small></Link>
                ))}
                <Link to="/certifications">All 12 standards<small>See the full list</small></Link>
              </div>
            </div>
          </section>

          <section className="isol-why">
            <div className="isol-container isol-why__inner">
              {WHY_US.map(([title, text], i) => {
                const Icon = WHY_ICONS[i] || Users;
                return <div key={title}><Icon size={20} /><b>{title}</b><span>{text}</span></div>;
              })}
            </div>
          </section>
        </main>

        <MicroFooter />
      </div>
    </>
  );
}
