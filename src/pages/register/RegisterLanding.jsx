import { useParams, useNavigate, Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { getStakeholderType, getStakeholderSlugs } from '../../utils/stakeholderTypes';
import {
  Award, Briefcase, Gift, Building2, UserCheck, TrendingUp,
  CheckCircle, BookOpen, ArrowRight,
} from 'lucide-react';
import PublicNav from '../../components/layout/PublicNav';
import BackButton from '../../components/ui/BackButton';
import './RegisterLanding.css';

const ICON_MAP = {
  Award, Briefcase, Gift, Building2, UserCheck, TrendingUp,
};

export default function RegisterLanding() {
  const { type } = useParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const config = getStakeholderType(type);

  if (!config) {
    return (
      <div className="reg-landing">
        <PublicNav />
        <div className="reg-landing__container pubnav-offset">
          <div className="reg-landing__not-found">
            <h2>{t('register.invalidType')}</h2>
            <p>{t('register.typeNotRecognized', { type })}</p>
            <Link to="/" className="reg-landing__btn reg-landing__btn--primary">{t('register.goToHomepage')}</Link>
          </div>
        </div>
      </div>
    );
  }

  const IconComponent = ICON_MAP[config.icon] || Building2;

  return (
    <div className="reg-landing">
      <PublicNav />
      <div className="reg-landing__container pubnav-offset">
        <BackButton />

        {/* Hero */}
        <div className="reg-landing__hero">
          <div className="reg-landing__hero-icon" style={{ background: `${config.color}18`, color: config.color }}>
            <IconComponent size={40} />
          </div>
          <h1 className="reg-landing__hero-title">{config.title}</h1>
          <p className="reg-landing__hero-desc">{config.description}</p>
          <button
            className="reg-landing__btn reg-landing__btn--primary reg-landing__btn--lg"
            onClick={() => navigate(`/signup?type=${config.id}`)}
          >
            {t('register.registerNow')} <ArrowRight size={18} />
          </button>
        </div>

        {/* Benefits */}
        <section className="reg-landing__section">
          <h2 className="reg-landing__section-title">
            <CheckCircle size={20} className="reg-landing__section-icon reg-landing__section-icon--green" />
            {t('register.benefits')}
          </h2>
          <div className="reg-landing__cards">
            {config.benefits.map((benefit, i) => (
              <div key={i} className="reg-landing__card">
                <div className="reg-landing__card-num" style={{ color: config.color }}>{String(i + 1).padStart(2, '0')}</div>
                <p className="reg-landing__card-text">{benefit}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Rules & Regulations */}
        <section className="reg-landing__section">
          <h2 className="reg-landing__section-title">
            <BookOpen size={20} className="reg-landing__section-icon reg-landing__section-icon--blue" />
            {t('register.rulesRegulations')}
          </h2>
          <div className="reg-landing__rules">
            {config.rules.map((rule, i) => (
              <div key={i} className="reg-landing__rule">
                <div className="reg-landing__rule-dot" style={{ background: config.color }} />
                <p className="reg-landing__rule-text">{rule}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA Footer */}
        <div className="reg-landing__cta">
          <h3 className="reg-landing__cta-title">{t('register.readyToStart')}</h3>
          <p className="reg-landing__cta-desc">
            {t('register.joinCertifyCX', { article: config.singularTitle === 'Investor' ? 'an' : 'a', type: config.singularTitle })}
          </p>
          <div className="reg-landing__cta-actions">
            <button
              className="reg-landing__btn reg-landing__btn--primary reg-landing__btn--lg"
              onClick={() => navigate(`/signup?type=${config.id}`)}
            >
              {t('register.registerAs', { type: config.singularTitle })} <ArrowRight size={18} />
            </button>
            <Link to="/login" className="reg-landing__btn reg-landing__btn--secondary">
              {t('register.alreadyHaveAccount')}
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="reg-landing__footer">
          <p>{t('common.allRightsReserved')}</p>
        </div>
      </div>
    </div>
  );
}
