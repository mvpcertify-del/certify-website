import { useMemo } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { AlertCircle, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { getComplianceAuditBySlug } from '../../utils/complianceAudits';
import { computeTotal } from '../../utils/pricing';
import { ROLES } from '../../utils/roles';
import ComplianceLogo from '../../components/ui/ComplianceLogo';
import PublicNav from '../../components/layout/PublicNav';
import BackButton from '../../components/ui/BackButton';
import './ComplianceLanding.css';

// ============================================
// Certify.cx — Compliance Audit service page (/compliance/:slug)
// ============================================
// The client asked (22 Aug) that the eight Compliance Audit cards stop being
// decoration: a click should reach content, a price and the payment gateway.
// This is that page — the compliance-side counterpart to /iso/:slug.
//
// The engagement content (what is included, how it works) is shared across all
// eight rather than written per service. That is deliberate: it is the same
// audit engagement in every case — scope, assess, remediate, test, report —
// and eight sets of invented per-framework prose would have to be genuinely
// translated into nine languages to be worth anything. What differs per
// service (the mark, the name, the description, the framework owner) is what
// the page varies.
//
// The price comes from utils/complianceServices.js. See the note there before
// treating it as final: the client has not yet priced these eight, so every one
// currently carries the site's existing specialist-audit price.
export default function ComplianceLanding() {
  const { slug } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();

  const service = getComplianceAuditBySlug(slug);

  // Same helper the ISO pages and the checkout use, so the number on this page
  // and the number the buyer is charged can never drift apart.
  const price = useMemo(
    () => (service ? computeTotal({ standardSlug: service.slug }).subtotal : 0),
    [service]
  );

  if (!service) {
    return (
      <div className="compliance-page">
        <PublicNav />
        <div className="compliance-page__container pubnav-offset">
          <div className="compliance-page__notfound">
            <AlertCircle size={48} />
            <h2>{t('compliance.notFoundTitle')}</h2>
            <p>{t('compliance.notFoundDesc')}</p>
            <Link to="/certifications" className="compliance-page__btn">
              {t('compliance.backToAll')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const startCheckout = () => {
    const qs = new URLSearchParams({ iso: service.slug }).toString();
    if (user?.role === ROLES.CLIENT) {
      // Logged-in clients keep the existing bootstrap → Stripe path, exactly as
      // the ISO pricing card does.
      navigate(`/client/start-payment?${qs}`);
    } else {
      // Everyone else goes to the public pay-first checkout — no signup gate.
      navigate(`/checkout?${qs}`);
    }
  };

  const included = ['included1', 'included2', 'included3', 'included4', 'included5'];
  const steps = ['step1', 'step2', 'step3', 'step4'];

  return (
    <div className="compliance-page" style={{ '--card-accent': service.accent }}>
      <PublicNav />
      <div className="compliance-page__container pubnav-offset">
        <BackButton />

        <header className="compliance-page__hero">
          <ComplianceLogo src={service.logo} title={t(service.titleKey)} size={96} />
          <div className="compliance-page__hero-text">
            <span className="compliance-page__tag">{t('compliance.detailTag')}</span>
            <h1 className="compliance-page__title">{t(service.titleKey)}</h1>
            <p className="compliance-page__regulator">
              <span className="compliance-page__regulator-label">
                {t('compliance.regulatorLabel')}
              </span>
              {service.regulator}
            </p>
          </div>
        </header>

        <div className="compliance-page__grid">
          <div className="compliance-page__main">
            <section className="compliance-page__section">
              <h2 className="compliance-page__section-title">
                {t('compliance.overviewTitle')}
              </h2>
              <p className="compliance-page__lead">{t(service.descKey)}</p>
            </section>

            <section className="compliance-page__section">
              <h2 className="compliance-page__section-title">
                {t('compliance.includedTitle')}
              </h2>
              <ul className="compliance-page__list">
                {included.map((key) => (
                  <li key={key}>
                    <Check size={16} /> {t(`compliance.${key}`)}
                  </li>
                ))}
              </ul>
            </section>

            <section className="compliance-page__section">
              <h2 className="compliance-page__section-title">
                {t('compliance.processTitle')}
              </h2>
              <ol className="compliance-page__steps">
                {steps.map((key, i) => (
                  <li key={key}>
                    <span className="compliance-page__step-num">{i + 1}</span>
                    <span>{t(`compliance.${key}`)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {/* PRICE + PAYMENT */}
          <aside className="compliance-page__price-card">
            <span className="compliance-page__price-tag">{service.code}</span>
            <h2 className="compliance-page__price-title">{t('compliance.priceTitle')}</h2>
            <div className="compliance-page__price">${price.toLocaleString()}</div>
            <p className="compliance-page__price-note">{t('compliance.priceNote')}</p>
            <button
              type="button"
              className="compliance-page__cta"
              onClick={startCheckout}
            >
              {t('compliance.cta')} <ArrowRight size={16} />
            </button>
            {/* pricing.disclaimer is deliberately NOT reused here: it ends
                "…can be added below", which is true on the checkout page and
                false on this one. compliance.priceNote says the same thing in
                terms that match where the buyer actually is. */}
          </aside>
        </div>

        <div className="compliance-page__footer">
          <Link to="/certifications#compliance-audits" className="compliance-page__back-link">
            {t('compliance.backToAll')}
          </Link>
          <p>{t('common.allRightsReserved')}</p>
        </div>
      </div>
    </div>
  );
}
