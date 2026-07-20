import { useState, useEffect, Fragment } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  ROLES,
  ROLE_LABELS,
  PERMISSIONS,
  getBaselineRolePermissions,
} from '../../utils/roles';
import { ShieldCheck, RotateCcw, AlertTriangle } from 'lucide-react';

// Order permissions into readable sections so the grid isn't a wall of keys.
const PERMISSION_GROUPS = [
  {
    key: 'dashboard',
    labelKey: 'permissions.groupDashboard',
    perms: [PERMISSIONS.VIEW_DASHBOARD],
  },
  {
    key: 'companies',
    labelKey: 'permissions.groupCompanies',
    perms: [PERMISSIONS.VIEW_COMPANIES, PERMISSIONS.MANAGE_COMPANIES, PERMISSIONS.REGISTER_COMPANY],
  },
  {
    key: 'certifications',
    labelKey: 'permissions.groupCertifications',
    perms: [
      PERMISSIONS.VIEW_CERTIFICATIONS,
      PERMISSIONS.VIEW_ALL_CERTIFICATIONS,
      PERMISSIONS.CREATE_CERTIFICATION,
      PERMISSIONS.MANAGE_CERTIFICATIONS,
      PERMISSIONS.APPROVE_CERTIFICATIONS,
      PERMISSIONS.VIEW_CERTIFICATION_STATUS,
    ],
  },
  {
    key: 'auditors',
    labelKey: 'permissions.groupAuditors',
    perms: [
      PERMISSIONS.VIEW_AUDITORS,
      PERMISSIONS.MANAGE_AUDITORS,
      PERMISSIONS.ASSIGN_AUDITORS,
      PERMISSIONS.SUBMIT_AUDIT_REPORT,
    ],
  },
  {
    key: 'bodies',
    labelKey: 'permissions.groupBodies',
    perms: [PERMISSIONS.VIEW_BODIES, PERMISSIONS.MANAGE_BODIES, PERMISSIONS.REVIEW_AUDIT_REPORTS],
  },
  {
    key: 'reports',
    labelKey: 'permissions.groupReports',
    perms: [PERMISSIONS.VIEW_REPORTS, PERMISSIONS.EXPORT_REPORTS],
  },
  {
    key: 'referrals',
    labelKey: 'permissions.groupReferrals',
    perms: [PERMISSIONS.VIEW_REFERRALS],
  },
  {
    key: 'admin',
    labelKey: 'permissions.groupAdmin',
    perms: [
      PERMISSIONS.MANAGE_USERS,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.MANAGE_REGIONS,
      PERMISSIONS.MANAGE_ROLES,
      PERMISSIONS.CREATE_ADMINS,
    ],
  },
];

const ROLE_COLUMNS = [
  ROLES.SUPER_ADMIN,
  ROLES.REGIONAL_ADMIN,
  ROLES.AUDITOR,
  ROLES.CERTIFICATION_BODY,
  ROLES.CLIENT,
  ROLES.CONSULTANCY,
  ROLES.REFERRAL,
];

export default function AdminPermissions() {
  const { t } = useTranslation();
  const { user, loading, refreshPermissions } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [overrides, setOverrides] = useState({}); // { role: { permission: boolean } }
  const [fetching, setFetching] = useState(false);
  const [savingCell, setSavingCell] = useState(null); // `${role}:${permission}`
  const [error, setError] = useState('');

  const fetchOverrides = async () => {
    setFetching(true);
    const { data } = await supabase
      .from('custom_permissions')
      .select('role, permission, enabled');
    const map = {};
    for (const row of data || []) {
      if (!map[row.role]) map[row.role] = {};
      map[row.role][row.permission] = !!row.enabled;
    }
    setOverrides(map);
    setFetching(false);
  };

  useEffect(() => { fetchOverrides(); }, []);

  // Effective state for a (role, permission) cell:
  // override wins if present, otherwise baseline.
  const getEffective = (role, permission) => {
    const override = overrides[role]?.[permission];
    if (typeof override === 'boolean') return override;
    return getBaselineRolePermissions(role).includes(permission);
  };

  const hasOverride = (role, permission) =>
    typeof overrides[role]?.[permission] === 'boolean';

  const handleToggle = async (role, permission) => {
    const cellKey = `${role}:${permission}`;
    setSavingCell(cellKey);
    setError('');

    const baseline = getBaselineRolePermissions(role).includes(permission);
    const current = getEffective(role, permission);
    const next = !current;

    try {
      // If the new value matches baseline, clear the override instead of storing it.
      // Keeps the table lean and the "Reset to defaults" state obvious.
      if (next === baseline) {
        const res = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save-permission-override', role, permission, clear: true, updatedBy: user?.id }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to save');
        setOverrides(prev => {
          const copy = { ...prev };
          if (copy[role]) {
            const { [permission]: _removed, ...rest } = copy[role];
            copy[role] = rest;
          }
          return copy;
        });
      } else {
        const res = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'save-permission-override', role, permission, enabled: next, updatedBy: user?.id }),
        });
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json.error || 'Failed to save');
        setOverrides(prev => ({
          ...prev,
          [role]: { ...(prev[role] || {}), [permission]: next },
        }));
      }

      // Re-install overrides in the roles module so hasPermission() updates
      // sidebar and protected routes immediately.
      await refreshPermissions();
    } catch (err) {
      setError(err.message || 'Failed to save');
    } finally {
      setSavingCell(null);
    }
  };

  const handleResetRole = async (role) => {
    if (!window.confirm(t('permissions.confirmResetRole', { role: ROLE_LABELS[role] }))) return;
    const rolePerms = overrides[role] || {};
    const keys = Object.keys(rolePerms);
    if (!keys.length) return;

    setError('');
    try {
      await Promise.all(
        keys.map(permission =>
          fetch('/api/user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'save-permission-override', role, permission, clear: true, updatedBy: user?.id }),
          })
        )
      );
      setOverrides(prev => {
        const copy = { ...prev };
        delete copy[role];
        return copy;
      });
      await refreshPermissions();
    } catch (err) {
      setError(err.message || 'Failed to reset');
    }
  };

  if (!user || loading) {
    return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;
  }

  if (!isSuperAdmin) {
    return (
      <div className="page-container">
        <p>{t('common.noAccess')}</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('permissions.title')}</h1>
          <p className="page-subtitle">{t('permissions.subtitle')}</p>
        </div>
      </div>

      {/* Explanation banner */}
      <div style={{
        display: 'flex',
        gap: 12,
        padding: '14px 18px',
        background: 'rgba(62,207,142,0.08)',
        border: '1px solid rgba(62,207,142,0.25)',
        borderRadius: 10,
        marginBottom: 'var(--spacing-lg)',
        alignItems: 'flex-start',
      }}>
        <ShieldCheck size={20} color="#059669" style={{ flexShrink: 0, marginTop: 2 }} />
        <p style={{ margin: 0, fontSize: '0.85rem', color: '#065f46', lineHeight: 1.5 }}>
          {t('permissions.explanation')}
        </p>
      </div>

      {error && (
        <div style={{
          display: 'flex', gap: 10, alignItems: 'center',
          padding: '10px 14px',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444',
          borderRadius: 8,
          fontSize: '0.85rem',
          marginBottom: 12,
        }}>
          <AlertTriangle size={16} />
          {error}
        </div>
      )}

      {fetching ? (
        <p>{t('common.loading')}</p>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--color-border)', borderRadius: 10, background: 'var(--color-bg-surface)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ background: 'var(--color-bg-subtle, #f9fafb)' }}>
                <th style={thStyle}>{t('permissions.permission')}</th>
                {ROLE_COLUMNS.map(role => (
                  <th key={role} style={{ ...thStyle, textAlign: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                      <span>{ROLE_LABELS[role]}</span>
                      {overrides[role] && Object.keys(overrides[role]).length > 0 && (
                        <button
                          type="button"
                          onClick={() => handleResetRole(role)}
                          title={t('permissions.resetRole')}
                          style={{
                            background: 'transparent',
                            border: '1px solid var(--color-border)',
                            borderRadius: 4,
                            padding: '2px 8px',
                            cursor: 'pointer',
                            fontSize: '0.7rem',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            color: 'var(--color-text-secondary)',
                          }}
                        >
                          <RotateCcw size={10} /> {t('permissions.reset')}
                        </button>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_GROUPS.map(group => (
                <Fragment key={group.key}>
                  <tr>
                    <td
                      colSpan={ROLE_COLUMNS.length + 1}
                      style={{
                        padding: '10px 14px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        color: 'var(--color-text-secondary)',
                        background: 'var(--color-bg-subtle, #f9fafb)',
                      }}
                    >
                      {t(group.labelKey)}
                    </td>
                  </tr>
                  {group.perms.map(permission => (
                    <tr key={permission} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td style={{ padding: '10px 14px', fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {permission}
                      </td>
                      {ROLE_COLUMNS.map(role => {
                        const effective = getEffective(role, permission);
                        const overridden = hasOverride(role, permission);
                        const cellKey = `${role}:${permission}`;
                        const saving = savingCell === cellKey;
                        return (
                          <td key={role} style={{ padding: '8px', textAlign: 'center' }}>
                            <label
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                cursor: saving ? 'wait' : 'pointer',
                                opacity: saving ? 0.5 : 1,
                              }}
                              title={overridden ? t('permissions.overridden') : t('permissions.baseline')}
                            >
                              <input
                                type="checkbox"
                                checked={effective}
                                disabled={saving}
                                onChange={() => handleToggle(role, permission)}
                              />
                              {overridden && (
                                <span
                                  style={{
                                    width: 6, height: 6, borderRadius: '50%',
                                    background: '#f59e0b',
                                  }}
                                />
                              )}
                            </label>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p style={{ marginTop: 12, fontSize: '0.75rem', color: 'var(--color-text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
        {t('permissions.overrideDotHint')}
      </p>
    </div>
  );
}

const thStyle = {
  padding: '12px 14px',
  fontSize: '0.8rem',
  fontWeight: 600,
  textAlign: 'left',
  color: 'var(--color-text-secondary)',
  borderBottom: '1px solid var(--color-border)',
};
