import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Hourglass, Lock, Sparkles, ArrowLeft } from 'lucide-react';
import './ModuleComingSoon.css';

// Placeholder for a menu item whose screen is not built yet. UI/UX only: it
// shows where the page sits in the platform and what it will do, and carries no
// data. Each item comes from config/sidebarModules.js; when the real screen
// ships, drop `soon` from the item and point its path at the new route.
export default function ModuleComingSoon({ item }) {
  const { t } = useTranslation();
  const title = t(`modules.${item.id}`, item.label);
  const moduleLabel = item.moduleLabel && item.moduleLabel !== item.label
    ? t(`modules.${item.moduleId || ''}`, item.moduleLabel)
    : null;

  return (
    <div className="mcs">
      <div className="mcs__card">
        <span className="mcs__icon" aria-hidden="true">
          {item.upsell ? <Lock size={30} /> : <Hourglass size={30} />}
        </span>

        {moduleLabel && <p className="mcs__crumb">{moduleLabel}</p>}
        <h2 className="mcs__title">{title}</h2>
        <span className="mcs__badge">
          {item.upsell ? t('modules.upgradeToUnlock', 'Part of an upgrade plan') : t('modules.comingSoon', 'Coming soon')}
        </span>

        {item.blurb && <p className="mcs__blurb">{t(`modules.${item.id}_blurb`, item.blurb)}</p>}

        {item.agent && (
          <p className="mcs__agent">
            <Sparkles size={14} aria-hidden="true" />
            {t('modules.agentHelps', '{{agent}} will assist with this module.', { agent: item.agent })}
          </p>
        )}

        <Link to="/main-dashboard" className="mcs__back">
          <ArrowLeft size={15} aria-hidden="true" /> {t('modules.backToDashboard', 'Back to the dashboard')}
        </Link>
      </div>
    </div>
  );
}
