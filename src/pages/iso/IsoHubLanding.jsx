import { Link } from 'react-router-dom';
import { ArrowRight, Award, Globe2, HardHat, Lock, Users, SlidersHorizontal, LayoutDashboard, Landmark, ShoppingCart, ChevronRight } from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import MicroFooter from '../micro/MicroFooter';
import SEO from '../../components/seo/SEO';
import { computeTotal } from '../../utils/pricing';
import { whopCheckoutUrl } from '../../utils/whopPlans';
import { ISO_LANDING_LIST, ISO_HUB_PATH, WHY_US } from '../../content/isoLandings';
import useJsonLd from './useJsonLd';
import './IsoStandardLanding.css';

// "Choose the right ISO certification": the hub that links the four standard pages (/iso-certification).
const SITE = 'https://certify.cx';
const ICONS = { 'iso-9001': Award, 'iso-14001': Globe2, 'iso-45001': HardHat, 'iso-iec-27001': Lock };
const BLURB = {
  'iso-9001': 'Improve quality and customer satisfaction.',
  'iso-14001': 'Protect the environment and achieve compliance.',
  'iso-45001': 'Ensure safe workplaces and reduce risks.',
  'iso-iec-27001': 'Secure information and manage security risk.',
};
const WHY_ICONS = [Users, SlidersHorizontal, LayoutDashboard, Landmark];

const TITLE = 'ISO Certification: ISO 9001, 14001, 45001 and 27001 | Certify.cx';
const DESC = 'Choose the right ISO certification for your business: ISO 9001 quality, ISO 14001 environment, ISO 45001 health and safety, ISO/IEC 27001 information security. Free gap analysis and expert guidance from Certify.cx.';

export default function IsoHubLanding() {
  useJsonLd('hub', {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: 'ISO certifications from Certify.cx',
    itemListElement: ISO_LANDING_LIST.map((o, i) => ({ '@type': 'ListItem', position: i + 1, name: `${o.display} ${o.name}`, url: `${SITE}${o.path}` })),
  });

  return (
    <>
      <SEO title={TITLE} description={DESC} path={ISO_HUB_PATH} />
      <div className="isol" style={{ '--isol-a-dark': '#3ecf8e', '--isol-a-light': '#0e9f6e' }}>
        <PublicNav />

        <header className="isol-hero isol-hero--hub pubnav-offset">
          <div className="isol-container isol-center">
            <nav className="isol-crumbs isol-crumbs--center" aria-label="Breadcrumb">
              <Link to="/">Home</Link><ChevronRight size={14} /><span aria-current="page">ISO certification</span>
            </nav>
            <h1 className="isol-h1 isol-h1--hub">Choose the right ISO certification for your business</h1>
            <p className="isol-lead isol-lead--center">We help organisations implement and certify management systems that drive growth, compliance and excellence.</p>
          </div>
        </header>

        <main>
          <section className="isol-section">
            <div className="isol-container">
              <div className="isol-hub">
                {ISO_LANDING_LIST.map((o) => {
                  const Icon = ICONS[o.slug] || Award;
                  const price = computeTotal({ standardSlug: o.slug }).subtotal;
                  return (
                    <article className="isol-hubcard" key={o.slug} style={{ '--isol-a-dark': o.accent, '--isol-a-light': o.accentLight }}>
                      <span className="isol-hubcard__icon"><Icon size={26} /></span>
                      <h2>{o.short}</h2>
                      <b>{o.name.replace(' Certification', '')}</b>
                      <p>{BLURB[o.slug]}</p>
                      <div className="isol-hubcard__price">From <strong>${price.toLocaleString()}</strong></div>
                      <Link to={o.path} className="isol-btn isol-btn--ghost isol-btn--block">Learn more <ArrowRight size={15} /></Link>
                      {whopCheckoutUrl(o.slug)
                        ? <a href={whopCheckoutUrl(o.slug)} className="isol-btn isol-btn--primary isol-btn--block"><ShoppingCart size={16} /> Buy now</a>
                        : <Link to={`/checkout?iso=${o.slug}`} className="isol-btn isol-btn--primary isol-btn--block"><ShoppingCart size={16} /> Buy now</Link>}
                    </article>
                  );
                })}
              </div>
              <p className="isol-center isol-hub__all"><Link to="/certifications">See all 12 ISO standards <ArrowRight size={14} /></Link></p>
            </div>
          </section>

          <section className="isol-section isol-section--alt">
            <div className="isol-container">
              <h2 className="isol-h2 isol-center">Why choose us</h2>
              <div className="isol-whygrid">
                {WHY_US.map(([title, text], i) => {
                  const Icon = WHY_ICONS[i] || Users;
                  return <div key={title}><span className="isol-trust__icon"><Icon size={22} /></span><b>{title}</b><span>{text}</span></div>;
                })}
              </div>
            </div>
          </section>

          <section className="isol-band">
            <div className="isol-container isol-band__inner">
              <div>
                <h2>Start your certification journey today</h2>
                <p>Not sure which standard fits? Take the free gap analysis and we will point you to the right one.</p>
              </div>
              <div className="isol-band__actions">
                <Link to="/gap-analysis" className="isol-btn isol-btn--light">Free gap analysis</Link>
              </div>
            </div>
          </section>
        </main>

        <MicroFooter />
      </div>
    </>
  );
}
