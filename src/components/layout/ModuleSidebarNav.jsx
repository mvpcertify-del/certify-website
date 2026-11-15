import { useMemo, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ChevronDown, Lock, Check } from 'lucide-react';
import { SARA, ZONES, moduleForPath, moduleVisibleTo } from '../../config/sidebarModules';
import './ModuleSidebar.css';

const STORAGE_KEY = 'certifycx-menu-open';

function readOpen() {
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

// The Main Admin's menu: a workspace switcher, Sara AI Command Center, then the
// platform modules in zones, every module collapsible. The structure comes from
// config/sidebarModules.js; nothing here knows what a "CRM" is.
//
// Collapsed (68px rail): only module icons show. Pressing one expands the menu
// and opens that module, because a flyout could not show sub-pages anyway.
//
// `zoneIds` (optional) shows only those zones and drops the workspace switcher and
// Sara block: used to append just the "QMS & ERP SUITE" under the original flat menu.
export default function ModuleSidebarNav({ role, collapsed, onExpand, onNavigate, zoneIds }) {
  const compact = Array.isArray(zoneIds);
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();

  const activeModule = moduleForPath(location.pathname);

  // Start with the module that holds the current page open, so the active link
  // is never hidden inside a collapsed group.
  const [open, setOpen] = useState(() => {
    const set = new Set(readOpen());
    if (activeModule?.items) set.add(activeModule.id);
    return set;
  });
  const [wsOpen, setWsOpen] = useState(false);

  const persist = (next) => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify([...next])); } catch { /* storage blocked */ }
  };

  // ...and keep doing so as the admin navigates. State is adjusted during render
  // (React's documented pattern for state derived from a changing value) rather
  // than in an effect, which would paint once with the group still shut.
  const [seenPath, setSeenPath] = useState(location.pathname);
  if (seenPath !== location.pathname) {
    setSeenPath(location.pathname);
    if (activeModule?.items && !open.has(activeModule.id)) {
      const next = new Set(open);
      next.add(activeModule.id);
      persist(next);
      setOpen(next);
    }
  }

  const toggle = (id) => {
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      persist(next);
      return next;
    });
  };

  const label = (entry) => t(`modules.${entry.id}`, entry.label);

  const zones = useMemo(
    () => ZONES
      .filter((z) => !compact || zoneIds.includes(z.id))
      .map((z) => ({ ...z, modules: z.modules.filter((m) => moduleVisibleTo(m, role)) }))
      .filter((z) => z.modules.length),
    [role, compact, zoneIds],
  );

  const openFromRail = (mod) => {
    if (mod.path && !mod.items) {
      navigate(mod.path);
      onNavigate?.();
      return;
    }
    onExpand?.();
    setOpen((prev) => {
      const next = new Set(prev);
      next.add(mod.id);
      persist(next);
      return next;
    });
  };

  const renderModule = (mod) => {
    const Icon = mod.icon;
    const isOpen = open.has(mod.id);
    const hasItems = Boolean(mod.items?.length);
    const isActive = activeModule?.id === mod.id;

    // ---- Collapsed rail: icon only -----------------------------------
    if (collapsed) {
      return (
        <button
          key={mod.id}
          type="button"
          className={`msb__row msb__row--rail${isActive ? ' msb__row--current' : ''}`}
          title={label(mod)}
          aria-label={label(mod)}
          onClick={() => openFromRail(mod)}
        >
          <Icon size={20} className="msb__icon" />
          {mod.restricted && <Lock size={9} className="msb__rail-lock" aria-hidden="true" />}
        </button>
      );
    }

    const chips = (
      <>
        {mod.agent && <span className="msb__agent">{mod.agent}</span>}
        {mod.restricted && <Lock size={13} className="msb__lock" aria-label={t('modules.restricted', 'Restricted')} />}
        {mod.upsell && (
          <span className="msb__upgrade">
            <Lock size={11} aria-hidden="true" /> {t('modules.upgrade', 'Upgrade')}
          </span>
        )}
      </>
    );

    // ---- A module that is a single page, not a group ------------------
    if (!hasItems) {
      return (
        <NavLink
          key={mod.id}
          to={mod.path}
          onClick={onNavigate}
          className={({ isActive: a }) => `msb__row${a ? ' msb__row--active' : ''}`}
        >
          <Icon size={20} className="msb__icon" />
          <span className="msb__label">{label(mod)}</span>
          {chips}
        </NavLink>
      );
    }

    // ---- Collapsible module ------------------------------------------
    return (
      <div key={mod.id} className="msb__module">
        <button
          type="button"
          className={`msb__row${isActive ? ' msb__row--current' : ''}`}
          aria-expanded={isOpen}
          aria-controls={`msb-${mod.id}`}
          onClick={() => toggle(mod.id)}
        >
          <Icon size={20} className="msb__icon" />
          <span className="msb__label">{label(mod)}</span>
          {chips}
          <ChevronDown size={15} className={`msb__chev${isOpen ? ' msb__chev--open' : ''}`} aria-hidden="true" />
        </button>
        {isOpen && (
          <ul className="msb__sub" id={`msb-${mod.id}`}>
            {mod.items.map((it) => (
              <li key={it.id}>
                <NavLink
                  to={it.path}
                  onClick={onNavigate}
                  className={({ isActive: a }) => `msb__item${a ? ' msb__item--active' : ''}`}
                >
                  <span className="msb__item-label">{label(it)}</span>
                  {it.soon && <span className="msb__soon">{t('modules.soon', 'Soon')}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  };

  // ---- Sara AI Command Center (pinned) ---------------------------------
  const SaraIcon = SARA.icon;
  const saraOpen = open.has(SARA.id);
  const saraCurrent = activeModule?.id === SARA.id;

  return (
    <div className={`msb${compact ? ' msb--compact' : ''}`}>
      {!compact && (<>
      {!collapsed && (
        <div className="msb__ws">
          <button
            type="button"
            className="msb__ws-btn"
            aria-expanded={wsOpen}
            aria-haspopup="listbox"
            onClick={() => setWsOpen((o) => !o)}
          >
            <span className="msb__ws-label">{t('modules.workspace', 'Workspace')}: {t('modules.workspaceInternal', 'Internal HQ')}</span>
            <ChevronDown size={15} className={`msb__chev${wsOpen ? ' msb__chev--open' : ''}`} aria-hidden="true" />
          </button>
          {wsOpen && (
            <ul className="msb__ws-list" role="listbox">
              <li role="option" aria-selected="true" className="msb__ws-opt msb__ws-opt--on">
                <span>{t('modules.workspaceInternal', 'Internal HQ')}</span>
                <Check size={14} aria-hidden="true" />
              </li>
              <li role="option" aria-selected="false" aria-disabled="true" className="msb__ws-opt msb__ws-opt--off">
                <span>{t('modules.workspaceClient', 'Preview Client QMS / ERP view')}</span>
                <span className="msb__soon">{t('modules.soon', 'Soon')}</span>
              </li>
            </ul>
          )}
        </div>
      )}

      {collapsed ? (
        <button
          type="button"
          className={`msb__row msb__row--rail msb__row--sara${saraCurrent ? ' msb__row--current' : ''}`}
          title={label(SARA)}
          aria-label={label(SARA)}
          onClick={() => openFromRail(SARA)}
        >
          <SaraIcon size={20} className="msb__icon" />
        </button>
      ) : (
        <div className="msb__module msb__module--sara">
          <button
            type="button"
            className={`msb__row msb__row--sara${saraCurrent ? ' msb__row--current' : ''}`}
            aria-expanded={saraOpen}
            aria-controls={`msb-${SARA.id}`}
            onClick={() => toggle(SARA.id)}
          >
            <SaraIcon size={20} className="msb__icon" />
            <span className="msb__label">{label(SARA)}</span>
            <ChevronDown size={15} className={`msb__chev${saraOpen ? ' msb__chev--open' : ''}`} aria-hidden="true" />
          </button>
          {saraOpen && (
            <ul className="msb__sub" id={`msb-${SARA.id}`}>
              {SARA.items.map((it) => (
                <li key={it.id}>
                  <NavLink
                    to={it.path}
                    onClick={onNavigate}
                    className={({ isActive: a }) => `msb__item${a ? ' msb__item--active' : ''}`}
                  >
                    <span className="msb__item-label">{label(it)}</span>
                    {it.soon && <span className="msb__soon">{t('modules.soon', 'Soon')}</span>}
                  </NavLink>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      </>)}

      {zones.map((zone) => (
        <section key={zone.id} className="msb__zone" aria-label={t(`modules.zone_${zone.id}`, zone.label)}>
          {!collapsed && <h3 className="msb__zone-title">{t(`modules.zone_${zone.id}`, zone.label)}</h3>}
          {collapsed && <div className="msb__zone-rule" aria-hidden="true" />}
          {zone.modules.map(renderModule)}
        </section>
      ))}
    </div>
  );
}
