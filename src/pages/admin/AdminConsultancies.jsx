import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  AlertCircle,
  AlertTriangle,
  Briefcase,
  CheckCircle,
  FileText,
  FileWarning,
  Info,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../lib/apiClient';
import { ROLES } from '../../utils/roles';
import { Button, Input } from '../../components/ui/FormElements';
import NameFields from '../../components/ui/NameFields';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import RowActions from '../../components/ui/RowActions';
import './AdminConsultancies.css';

// Super Admin / Country Admin view over consultancy partners.
//
// Two tabs:
//  - Performance: the KPI board from the `consultancy_kpi` view, plus the same
//    four row actions the Clients and Referral Partners screens carry — View,
//    Edit, Activate/Deactivate, Delete (client, 12 Aug).
//
//    This screen used to be read-only on purpose, and the reasoning has NOT
//    been thrown away: the system still never deactivates a partner by itself.
//    `at_risk` is a flag for a human to look at, nothing more. What changed is
//    only that the human can now act on it here, next to the numbers they just
//    read, instead of memorising a name and going to find it in User
//    Management. Deactivation remains an explicit, deliberate click.
//
//    Every write goes through the same service-role endpoints User Management
//    uses (/api/user + /api/delete-user), which re-verify the caller's Bearer
//    token and refuse a target they may not manage. As on Referral Partners,
//    a Super Admin gets all four actions and every other admin who can reach
//    the list gets View alone.
//  - Agreement: the partner contract template. Super admin only; saving
//    publishes a NEW version rather than editing a signed one in place.

const TAB_PERFORMANCE = 'performance';
const TAB_AGREEMENT = 'agreement';

export default function AdminConsultancies() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;
  const [tab, setTab] = useState(TAB_PERFORMANCE);

  // ---- Performance tab state ----
  const [partners, setPartners] = useState([]);
  const [target, setTarget] = useState(5);
  const [kpiLoading, setKpiLoading] = useState(true);
  const [kpiError, setKpiError] = useState('');
  const [kpiSuccess, setKpiSuccess] = useState('');

  // ---- Row actions (Performance tab) ----
  const [showView, setShowView] = useState(false);
  const [viewingPartner, setViewingPartner] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', company_name: '', country: '' });
  const [savingPartner, setSavingPartner] = useState(false);

  // ---- Agreement tab state ----
  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', termMonths: 12 });
  const [tplLoading, setTplLoading] = useState(false);
  const [tplLoaded, setTplLoaded] = useState(false);
  const [tplError, setTplError] = useState('');
  const [tplNotice, setTplNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const locale = i18n.language || undefined;

  const formatMoney = useCallback((value) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return 'US$ 0.00';
    return `US$ ${n.toLocaleString(locale, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }, [locale]);

  const formatInt = useCallback((value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n.toLocaleString(locale) : '0';
  }, [locale]);

  const formatDate = useCallback((value) => {
    if (!value) return '—';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' });
  }, [locale]);

  const loadKpi = useCallback(async () => {
    setKpiLoading(true);
    setKpiError('');
    try {
      const data = await apiPost('/api/user', { action: 'consultancy-kpi' });
      setPartners(Array.isArray(data?.partners) ? data.partners : []);
      if (Number.isFinite(Number(data?.target))) setTarget(Number(data.target));
    } catch (err) {
      setKpiError(err.message || t('adminConsultancies.loadFailed'));
      setPartners([]);
    } finally {
      setKpiLoading(false);
    }
  }, [t]);

  useEffect(() => { loadKpi(); }, [loadKpi]);

  const loadTemplate = useCallback(async () => {
    setTplLoading(true);
    setTplError('');
    setTplNotice('');
    try {
      const data = await apiPost('/api/user', { action: 'get-contract-template' });
      const tpl = data?.template || null;
      setTemplate(tpl);
      setForm({
        title: tpl?.title || '',
        body: tpl?.body || '',
        termMonths: tpl?.term_months ?? 12,
      });
    } catch (err) {
      const msg = err.message || '';
      // A brand-new environment has no published contract yet. That is a normal
      // starting state, not an error — let the admin write the first one.
      if (/no contract has been published/i.test(msg) || /not found/i.test(msg)) {
        setTemplate(null);
        setForm({ title: '', body: '', termMonths: 12 });
        setTplNotice(t('adminConsultancies.noTemplateYet'));
      } else {
        setTplError(msg || t('adminConsultancies.templateLoadFailed'));
      }
    } finally {
      setTplLoading(false);
      setTplLoaded(true);
    }
  }, [t]);

  useEffect(() => {
    if (tab === TAB_AGREEMENT && isSuperAdmin && !tplLoaded) loadTemplate();
  }, [tab, isSuperAdmin, tplLoaded, loadTemplate]);

  const summary = useMemo(() => {
    const totals = partners.reduce((acc, p) => {
      if (p.at_risk === true) acc.atRisk += 1;
      if (p.contract_current === true) acc.signed += 1;
      acc.commission += Number(p.total_commission) || 0;
      return acc;
    }, { atRisk: 0, signed: 0, commission: 0 });
    return { total: partners.length, ...totals };
  }, [partners]);

  const handleSaveTemplate = async (e) => {
    e.preventDefault();
    setTplError('');
    setTplNotice('');

    const title = form.title.trim();
    const body = form.body.trim();
    const months = Number(form.termMonths);

    if (!title) { setTplError(t('adminConsultancies.titleRequired')); return; }
    if (!body) { setTplError(t('adminConsultancies.bodyRequired')); return; }
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      setTplError(t('adminConsultancies.termInvalid'));
      return;
    }

    setSaving(true);
    try {
      const data = await apiPost('/api/user', {
        action: 'save-contract-template',
        title,
        body,
        termMonths: months,
      });
      if (data?.template) {
        setTemplate(data.template);
        setForm({
          title: data.template.title || '',
          body: data.template.body || '',
          termMonths: data.template.term_months ?? months,
        });
      }
      // The API reports `unchanged` when the submitted text matches the live
      // version. Saying "published" there would be a lie — no new version exists.
      setTplNotice(data?.unchanged
        ? t('adminConsultancies.saveUnchanged')
        : t('adminConsultancies.savePublished', { version: data?.template?.version ?? '' }));
    } catch (err) {
      setTplError(err.message || t('adminConsultancies.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  const renderContractCell = (p) => {
    if (p.contract_current) {
      return (
        <div className="adcon__contract">
          <span className="adcon__badge adcon__badge--ok">
            <ShieldCheck size={12} />
            {t('adminConsultancies.contractSigned', { version: p.contract_version ?? '—' })}
          </span>
          {p.contract_expires_at && (
            <span className="adcon__contract-sub">
              {t('adminConsultancies.contractExpires', { date: formatDate(p.contract_expires_at) })}
            </span>
          )}
        </div>
      );
    }
    if (p.contract_accepted_at) {
      return (
        <div className="adcon__contract">
          <span className="adcon__badge adcon__badge--warn">
            <FileWarning size={12} />
            {t('adminConsultancies.contractExpired')}
          </span>
          <span className="adcon__contract-sub">
            {t('adminConsultancies.contractSignedOn', { date: formatDate(p.contract_accepted_at) })}
          </span>
        </div>
      );
    }
    return (
      <span className="adcon__badge adcon__badge--muted">
        <FileText size={12} />
        {t('adminConsultancies.contractNone')}
      </span>
    );
  };

  // ---------------------------------------------------------------------
  // Row actions — View / Edit / Activate-Deactivate / Delete
  //
  // Rows come from the `consultancy_kpi` view, so the profile's primary key is
  // `profile_id`, not `id`. Every write below targets that.
  // ---------------------------------------------------------------------
  const partnerName = (p) => p?.company_name || p?.full_name || p?.email || '—';

  const openView = (p) => {
    setViewingPartner(p);
    setShowView(true);
  };

  const openEdit = (p) => {
    setEditingPartner(p);
    setEditForm({
      full_name: p.full_name || '',
      email: p.email || '',
      company_name: p.company_name || '',
      country: p.country || '',
    });
    setKpiError('');
    setShowEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setKpiError('');
    if (!editForm.full_name.trim() || !editForm.email.trim()) {
      setKpiError(t('admin.fillRequired'));
      return;
    }
    setSavingPartner(true);
    try {
      await apiPost('/api/user', {
        action: 'update-profile',
        userId: editingPartner.profile_id,
        full_name: editForm.full_name,
        email: editForm.email,
        company_name: editForm.company_name || null,
        country: editForm.country || null,
      });
      // Patched in place rather than refetched: only a Super Admin reaches this
      // form and they are not region-scoped, so an edited country (which the
      // API turns into a new `region`) cannot move the partner off this list.
      setPartners((prev) => prev.map((p) =>
        p.profile_id === editingPartner.profile_id ? { ...p, ...editForm } : p
      ));
      setShowEdit(false);
      setKpiSuccess(`${t('common.save')}: ${editForm.company_name || editForm.full_name || editForm.email}`);
    } catch (err) {
      setKpiError(err.message);
    }
    setSavingPartner(false);
  };

  const handleToggleActive = async (p) => {
    setKpiError('');
    const next = !(p.is_active !== false);
    try {
      await apiPost('/api/user', { action: 'set-active', userId: p.profile_id, isActive: next });
      // `at_risk` is defined as "active AND quiet for three months", so a
      // partner who has just been deactivated is no longer at risk — leaving
      // the flag on would keep them in the count the admin just acted on.
      setPartners((prev) => prev.map((x) =>
        x.profile_id === p.profile_id
          ? { ...x, is_active: next, at_risk: next ? x.at_risk : false }
          : x
      ));
      setKpiSuccess(`${next ? t('common.activate') : t('common.deactivate')}: ${partnerName(p)}`);
    } catch (err) {
      setKpiError(err.message);
    }
  };

  const handleDelete = async (p) => {
    setKpiError('');
    const name = partnerName(p);
    // Deleting a partner also removes their referral ledger rows and their
    // signed contract, so this is confirmed before it is sent.
    if (!window.confirm(t('admin.deleteUserConfirm') + ` ${name}?`)) return;
    try {
      await apiPost('/api/delete-user', { userId: p.profile_id });
      setPartners((prev) => prev.filter((x) => x.profile_id !== p.profile_id));
      setKpiSuccess(`${t('admin.successDeleted')} ${name}`);
    } catch (err) {
      setKpiError(err.message);
    }
  };

  const renderStatusCell = (p) => {
    if (p.is_active === false) {
      return <span className="adcon__badge adcon__badge--muted">{t('common.inactive')}</span>;
    }
    if (p.approval_status && p.approval_status !== 'approved') {
      return (
        <span className="adcon__badge adcon__badge--warn">
          {t(`adminConsultancies.status.${p.approval_status}`, p.approval_status)}
        </span>
      );
    }
    return <span className="adcon__badge adcon__badge--ok">{t('common.active')}</span>;
  };

  // The View popup reuses the table's own renderers so the two can never
  // disagree, and adds the figures the table has no room for. DetailModal
  // calls render(rawValue, row).
  const detailColumns = [
    { key: 'company_name', label: t('admin.companyName'), render: (v, row) => v || row.full_name || '—' },
    { key: 'full_name', label: t('admin.fullName'), render: (v) => v || '—' },
    { key: 'email', label: t('auth.email'), render: (v) => v || '—' },
    { key: 'country', label: t('admin.country'), render: (v, row) => v || row.region || '—' },
    { key: 'paying_clients_this_month', label: t('adminConsultancies.colThisMonth'), render: formatInt },
    { key: 'paying_clients_last_3_months', label: t('adminConsultancies.colLast3'), render: formatInt },
    { key: 'total_paying_clients', label: t('adminConsultancies.colTotalClients'), render: formatInt },
    { key: 'total_commission', label: t('adminConsultancies.colTotalCommission'), render: formatMoney },
    {
      key: 'commission_percent',
      label: t('adminConsultancies.colCommissionPct'),
      render: (v) => (v == null
        ? '—'
        : `${Number(v).toLocaleString(locale, { maximumFractionDigits: 2 })}%`),
    },
    { key: 'last_conversion_at', label: t('adminConsultancies.detailLastConversion'), render: formatDate },
    { key: 'joined_at', label: t('adminConsultancies.detailJoined'), render: formatDate },
    { key: 'contract_accepted_at', label: t('adminConsultancies.colContract'), render: (_, row) => renderContractCell(row) },
    { key: 'is_active', label: t('adminConsultancies.colStatus'), render: (_, row) => renderStatusCell(row) },
  ];

  if (authLoading || !user) {
    return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('adminConsultancies.title')}</h1>
          <p className="page-subtitle">{t('adminConsultancies.subtitle')}</p>
        </div>
      </div>

      <div className="adcon__tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === TAB_PERFORMANCE}
          className={`adcon__tab ${tab === TAB_PERFORMANCE ? 'adcon__tab--active' : ''}`}
          onClick={() => setTab(TAB_PERFORMANCE)}
        >
          <TrendingUp size={15} />
          {t('adminConsultancies.tabPerformance')}
        </button>
        {isSuperAdmin && (
          <button
            type="button"
            role="tab"
            aria-selected={tab === TAB_AGREEMENT}
            className={`adcon__tab ${tab === TAB_AGREEMENT ? 'adcon__tab--active' : ''}`}
            onClick={() => setTab(TAB_AGREEMENT)}
          >
            <FileText size={15} />
            {t('adminConsultancies.tabAgreement')}
          </button>
        )}
      </div>

      {tab === TAB_PERFORMANCE && (
        <section>
          <div className="adcon__note">
            <Info size={18} className="adcon__note-icon" />
            <p>{t('adminConsultancies.noAutoDeactivate')}</p>
          </div>

          <div className="adcon__summary">
            <div className="adcon__stat">
              <span className="adcon__stat-label">{t('adminConsultancies.statTotal')}</span>
              <span className="adcon__stat-value">{formatInt(summary.total)}</span>
            </div>
            <div className="adcon__stat adcon__stat--risk">
              <span className="adcon__stat-label">{t('adminConsultancies.statAtRisk')}</span>
              <span className="adcon__stat-value">{formatInt(summary.atRisk)}</span>
            </div>
            <div className="adcon__stat">
              <span className="adcon__stat-label">{t('adminConsultancies.statSigned')}</span>
              <span className="adcon__stat-value">{formatInt(summary.signed)}</span>
            </div>
            <div className="adcon__stat adcon__stat--money">
              <span className="adcon__stat-label">{t('adminConsultancies.statCommission')}</span>
              <span className="adcon__stat-value">{formatMoney(summary.commission)}</span>
            </div>
          </div>

          <div className="adcon__toolbar">
            <Button variant="ghost" size="sm" onClick={loadKpi} disabled={kpiLoading}>
              <RefreshCw size={14} /> {t('adminConsultancies.refresh')}
            </Button>
          </div>

          {/* The edit dialog carries its own copy of the error, so hide the
              page-level banner while it is open rather than showing both. */}
          {kpiError && !showEdit && (
            <div className="adcon__alert adcon__alert--error">
              <AlertCircle size={16} /><span>{kpiError}</span>
            </div>
          )}
          {kpiSuccess && (
            <div className="adcon__alert adcon__alert--ok">
              <CheckCircle size={16} /><span>{kpiSuccess}</span>
            </div>
          )}

          {kpiLoading ? (
            <p className="adcon__loading">{t('adminConsultancies.loading')}</p>
          ) : partners.length === 0 ? (
            <div className="adcon__empty">
              <Briefcase size={34} />
              <h3>{t('adminConsultancies.emptyTitle')}</h3>
              <p>{t('adminConsultancies.emptyBody')}</p>
            </div>
          ) : (
            <div className="adcon__table-wrap">
              <table className="adcon__table">
                <thead>
                  {/* Actions lead, ahead of the partner (client, 12 Aug) — the
                      same order DataTable now applies to every other list. */}
                  <tr>
                    <th className="adcon__actions-col">{t('dashboard.action')}</th>
                    <th>{t('adminConsultancies.colPartner')}</th>
                    <th>{t('adminConsultancies.colCountry')}</th>
                    <th>{t('adminConsultancies.colThisMonth')}</th>
                    <th>{t('adminConsultancies.colLast3')}</th>
                    <th>{t('adminConsultancies.colTotalClients')}</th>
                    <th>{t('adminConsultancies.colTotalCommission')}</th>
                    <th>{t('adminConsultancies.colCommissionPct')}</th>
                    <th>{t('adminConsultancies.colContract')}</th>
                    <th>{t('adminConsultancies.colStatus')}</th>
                  </tr>
                </thead>
                <tbody>
                  {partners.map((p) => {
                    const done = Number(p.paying_clients_this_month) || 0;
                    const goal = Number(target) || 1;
                    const pct = Math.max(0, Math.min(100, Math.round((done / goal) * 100)));
                    return (
                      <tr key={p.profile_id} className={p.at_risk ? 'adcon__row--risk' : ''}>
                        <td className="adcon__actions">
                          {/* View is available to every admin who can reach the
                              list; only the Super Admin gets the three write
                              actions, the same split Referral Partners uses. */}
                          {isSuperAdmin ? (
                            <RowActions
                              isActive={p.is_active !== false}
                              showView
                              onView={() => openView(p)}
                              onEdit={() => openEdit(p)}
                              onToggle={() => handleToggleActive(p)}
                              onDelete={() => handleDelete(p)}
                            />
                          ) : (
                            <RowActions
                              showView
                              onView={() => openView(p)}
                              showToggle={false}
                              showEdit={false}
                              showDelete={false}
                            />
                          )}
                        </td>
                        <td>
                          <div className="adcon__partner">
                            <span className="adcon__partner-company">
                              {p.company_name || p.full_name || p.email || '—'}
                            </span>
                            <span className="adcon__partner-name">{p.full_name || p.email || '—'}</span>
                            {p.at_risk === true && (
                              <span
                                className="adcon__badge adcon__badge--risk"
                                title={t('adminConsultancies.atRiskTooltip')}
                              >
                                <AlertTriangle size={12} />
                                {t('adminConsultancies.atRisk')}
                              </span>
                            )}
                            {p.at_risk === true && (
                              <span className="adcon__risk-note">
                                {t('adminConsultancies.atRiskTooltip')}
                              </span>
                            )}
                          </div>
                        </td>
                        <td>{p.country || p.region || '—'}</td>
                        <td>
                          <div className="adcon__progress">
                            <span className="adcon__progress-text">
                              {formatInt(done)} / {formatInt(goal)}
                            </span>
                            <span className="adcon__progress-track">
                              <span
                                className={`adcon__progress-bar ${pct >= 100 ? 'adcon__progress-bar--full' : ''}`}
                                style={{ width: `${pct}%` }}
                              />
                            </span>
                          </div>
                        </td>
                        <td>{formatInt(p.paying_clients_last_3_months)}</td>
                        <td>{formatInt(p.total_paying_clients)}</td>
                        <td className="adcon__money">{formatMoney(p.total_commission)}</td>
                        <td>
                          {p.commission_percent == null
                            ? '—'
                            : `${Number(p.commission_percent).toLocaleString(locale, { maximumFractionDigits: 2 })}%`}
                        </td>
                        <td>{renderContractCell(p)}</td>
                        <td>{renderStatusCell(p)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {tab === TAB_AGREEMENT && isSuperAdmin && (
        <section className="adcon__agreement">
          {tplLoading ? (
            <p className="adcon__loading">{t('adminConsultancies.loading')}</p>
          ) : (
            <form onSubmit={handleSaveTemplate} className="adcon__card">
              <div className="adcon__version-row">
                <div>
                  <span className="adcon__version-label">{t('adminConsultancies.currentVersion')}</span>
                  <span className="adcon__version-value">
                    {template?.version != null ? `v${template.version}` : t('adminConsultancies.versionNone')}
                  </span>
                </div>
              </div>

              {tplNotice && <div className="adcon__alert adcon__alert--info">{tplNotice}</div>}
              {tplError && <div className="adcon__alert adcon__alert--error">{tplError}</div>}

              <Input
                label={t('adminConsultancies.fieldTitle')}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder={t('adminConsultancies.fieldTitlePlaceholder')}
                required
              />

              <Input
                label={t('adminConsultancies.fieldTerm')}
                type="number"
                min="1"
                max="120"
                step="1"
                value={form.termMonths}
                onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
                required
              />

              <div className="adcon__field">
                <label className="adcon__field-label" htmlFor="adcon-body">
                  {t('adminConsultancies.fieldBody')}
                </label>
                <textarea
                  id="adcon-body"
                  className="adcon__textarea"
                  value={form.body}
                  onChange={(e) => setForm({ ...form, body: e.target.value })}
                  placeholder={t('adminConsultancies.fieldBodyPlaceholder')}
                  spellCheck="false"
                  required
                />
                <span className="adcon__field-hint">{t('adminConsultancies.fieldBodyHint')}</span>
              </div>

              <div className="adcon__warning">
                <AlertTriangle size={18} className="adcon__warning-icon" />
                <p>{t('adminConsultancies.publishWarning')}</p>
              </div>

              <div className="adcon__form-actions">
                <Button type="submit" variant="primary" loading={saving}>
                  {t('adminConsultancies.publishButton')}
                </Button>
              </div>
            </form>
          )}
        </section>
      )}

      {/* Edit partner. Only the profile fields are editable here — the KPI
          figures are derived from the referral ledger and must not be typed
          over. The commission rate stays on Commission Tiers, which is where
          it is set for every partner type. */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={t('common.edit')}>
        <form onSubmit={submitEdit} className="adcon__card">
          {kpiError && (
            <div className="adcon__alert adcon__alert--error">
              <AlertCircle size={16} /><span>{kpiError}</span>
            </div>
          )}
          <NameFields
            idPrefix="edit-consultancy-name"
            value={editForm.full_name}
            onChange={(v) => setEditForm((p) => ({ ...p, full_name: v }))}
            required
          />
          <Input
            label={`${t('auth.email')} *`}
            type="email"
            id="edit-consultancy-email"
            name="email"
            value={editForm.email}
            onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <Input
            label={t('admin.companyName')}
            id="edit-consultancy-company"
            name="company_name"
            value={editForm.company_name}
            onChange={(e) => setEditForm((p) => ({ ...p, company_name: e.target.value }))}
          />
          <Input
            label={t('admin.country')}
            id="edit-consultancy-country"
            name="country"
            placeholder={t('admin.countryPlaceholder')}
            value={editForm.country}
            onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))}
          />
          <div className="adcon__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowEdit(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={savingPartner}>
              {t('common.save')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* View partner (read-only) */}
      <DetailModal
        isOpen={showView}
        onClose={() => setShowView(false)}
        title={viewingPartner ? partnerName(viewingPartner) : t('common.view')}
        columns={detailColumns}
        row={viewingPartner}
      />
    </div>
  );
}
