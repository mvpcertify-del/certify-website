import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Store, Building2, Building } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import './SegmentBar.css';

// The MICRO / SMEs / ENTERPRISE switcher from the home page design. It is shared
// so a visitor on any of the three company-size pages can move to another one:
// the home page (/), the SMEs page (/sme) and the MICRO page (/micro).
//
// `active` marks the segment whose page you are on ('micro' | 'sme').
// ENTERPRISE has no page of its own yet, so it opens the gap analysis (the
// authenticated one for a signed-in client).
export default function SegmentBar({ active }) {
  const { t } = useTranslation();
  const { user, loading } = useAuth();

  const isIn = !loading && !!user;
  const enterprisePath = isIn && user.role === ROLES.CLIENT ? '/client/gap-analysis' : '/gap-analysis';

  const segments = [
    { id: 'micro', Icon: Store, name: t('home.segMicro'), sub: t('home.segMicroSub'), to: '/micro' },
    { id: 'sme', Icon: Building2, name: t('home.segSme'), sub: t('home.segSmeSub'), to: '/sme' },
    { id: 'enterprise', Icon: Building, name: t('home.segEnt'), sub: t('home.segEntSub'), to: enterprisePath },
  ];

  return (
    <div className="segbar">
      <div className="segbar__container">
        <nav className="segbar__bar" aria-label="Company size">
          {segments.map(({ id, Icon, name, sub, to }) => (
            <Link
              key={id}
              to={to}
              className={`segbar__seg${active === id ? ' segbar__seg--active' : ''}`}
              aria-current={active === id ? 'page' : undefined}
            >
              <Icon size={34} strokeWidth={1.5} className="segbar__icon" />
              <span className="segbar__text">
                <strong>{name}</strong>
                <span>{sub}</span>
              </span>
              <ArrowRight size={16} className="segbar__arrow" />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}
