import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Shield, Award, Globe2, Lock, Apple, GraduationCap, Zap, Scale,
  Activity, Stethoscope, ShieldCheck, BrainCircuit, ArrowRight,
} from 'lucide-react';
import { ISO_CATALOG_LIST } from '../../utils/isoCatalog';
import PublicNav from '../../components/layout/PublicNav';
import BackButton from '../../components/ui/BackButton';
import './Certifications.css';

const ICON_MAP = {
  Award, Globe2, Shield, Lock, Apple, GraduationCap, Zap, Scale, Activity, Stethoscope,
  ShieldCheck, BrainCircuit,
};

// Public "all certifications" listing. This is where the gap-analysis results
// send a visitor who wants to proceed to certification: every standard is shown
// and the visitor picks one to open its /iso/:slug page and buy.
export default function Certifications() {
  const { t } = useTranslation();

  return (
    <div className="certs">
      <PublicNav />
      <div className="pubnav-offset" />

      <BackButton />

      <div className="certs__hero">
        <span className="certs__tag">{t('certifications.tag')}</span>
        <h1 className="certs__title">{t('certifications.title')}</h1>
        <p className="certs__subtitle">{t('certifications.subtitle')}</p>
      </div>

      <div className="certs__grid">
        {ISO_CATALOG_LIST.map((iso) => {
          const Icon = ICON_MAP[iso.icon] || Award;
          return (
            <Link
              key={iso.slug}
              to={`/iso/${iso.slug}`}
              className="certs__card"
              style={{ '--card-accent': iso.color }}
            >
              <div className="certs__card-icon"><Icon size={26} /></div>
              <div className="certs__card-code">{iso.code}</div>
              <h3 className="certs__card-name">{t(iso.titleKey)}</h3>
              <p className="certs__card-desc">{t(iso.descKey)}</p>
              <span className="certs__card-cta">
                {t('certifications.select')} <ArrowRight size={14} />
              </span>
            </Link>
          );
        })}
      </div>

      <div className="certs__footer">
        <p>{t('common.allRightsReserved')}</p>
      </div>
    </div>
  );
}
