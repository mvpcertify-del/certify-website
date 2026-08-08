import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, RefreshCw, Search, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../lib/apiClient';
import { Button, Input } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import DetailModal from '../../components/ui/DetailModal';
import RowActions from '../../components/ui/RowActions';
import { ROLES } from '../../utils/roles';
import './AdminReferralPartners.css';

// Super Admin / Country Admin view over referral partners — the "Referral
// Partners" entry the client asked for under Clients in the left menu (7 Aug).
//
// 8 Aug: the client asked for the same four row actions Clients carries —
// View, Edit, Deactivate, Delete — so the screen is no longer read-only. The
// split follows Clients exactly: a Super Admin gets all four, every other admin
// who can reach the list gets View alone. The actions are not a second way to
// manage users; they call the same endpoints User Management does
// (/api/user + /api/delete-user), which re-check the caller's rights server-side.
//
// The region scope is applied by the API (a country admin only ever receives
// their own region's partners), not by this component — the browser must not be
// the thing deciding which countries an admin may see.
export default function AdminReferralPartners() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();
  const isSuperAdmin = user?.role === ROLES.SUPER_ADMIN;

  const [partners, setPartners] = useState([]);
  const [defaultPercent, setDefaultPercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch] = useState('');

  // Row actions
  const [showView, setShowView] = useState(false);
  const [viewingPartner, setViewingPartner] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const [editingPartner, setEditingPartner] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: '', email: '', company_name: '', country: '' });
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

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/referrals', { action: 'partner-list' });
      setPartners(Array.isArray(data?.partners) ? data.partners : []);
      if (Number.isFinite(Number(data?.defaultCommissionPercent))) {
        setDefaultPercent(Number(data.defaultCommissionPercent));
      }
    } catch (err) {
      setError(err.message || t('adminReferralPartners.loadFailed'));
      setPartners([]);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) =>
      [p.company_name, p.full_name, p.email, p.referral_code, p.country]
        .some((field) => String(field || '').toLowerCase().includes(q))
    );
  }, [partners, search]);

  // The summary describes what is on screen, so it follows the search filter —
  // a total that ignored the filter would read as the platform-wide figure and
  // be quietly wrong the moment an admin typed anything.
  const summary = useMemo(() => filtered.reduce((acc, p) => ({
    total: acc.total + 1,
    converted: acc.converted + (Number(p.converted) || 0),
    commission: acc.commission + (Number(p.total_commission) || 0),
    unpaid: acc.unpaid + (Number(p.unpaid_commission) || 0),
  }), { total: 0, converted: 0, commission: 0, unpaid: 0 }), [filtered]);

  const partnerName = (p) => p?.full_name || p?.company_name || p?.email || '—';

  const renderStatusCell = (p) => {
    if (p.is_active === false) {
      return <span className="adref__badge adref__badge--muted">{t('common.inactive')}</span>;
    }
    if (p.approval_status && p.approval_status !== 'approved') {
      return (
        <span className="adref__badge adref__badge--warn">
          {t(`adminReferralPartners.status.${p.approval_status}`, p.approval_status)}
        </span>
      );
    }
    return <span className="adref__badge adref__badge--ok">{t('common.active')}</span>;
  };

  // ---------------------------------------------------------------------
  // Row actions — View / Edit / Deactivate / Delete
  //
  // Every write goes through the same service-role endpoint the Clients screen
  // uses, so the authorization rules live in one place: /api/user re-verifies
  // the Bearer token and refuses a target the caller may not manage, and
  // /api/delete-user does its own ownership check before it clears the ~15
  // tables that reference the user.
  // ---------------------------------------------------------------------
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
    setError('');
    setShowEdit(true);
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setError('');
    if (!editForm.full_name.trim() || !editForm.email.trim()) {
      setError(t('admin.fillRequired'));
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/user', {
        action: 'update-profile',
        userId: editingPartner.profile_id,
        full_name: editForm.full_name,
        email: editForm.email,
        company_name: editForm.company_name || null,
        country: editForm.country || null,
      });
      // Patch the row in place rather than refetching: only a Super Admin can
      // reach this form and they are not region-scoped, so an edited country
      // (which the API turns into a new `region`) cannot move the partner out
      // of the list being shown.
      setPartners((prev) => prev.map((p) =>
        p.profile_id === editingPartner.profile_id ? { ...p, ...editForm } : p
      ));
      setShowEdit(false);
      setSuccess(`${t('common.save')}: ${editForm.full_name || editForm.email}`);
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const handleToggleActive = async (p) => {
    setError('');
    const next = !(p.is_active !== false);
    try {
      await apiPost('/api/user', { action: 'set-active', userId: p.profile_id, isActive: next });
      setPartners((prev) => prev.map((x) =>
        x.profile_id === p.profile_id ? { ...x, is_active: next } : x
      ));
      setSuccess(`${next ? t('common.activate') : t('common.deactivate')}: ${partnerName(p)}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (p) => {
    setError('');
    const name = partnerName(p);
    // Deleting a partner also removes their referral ledger rows, so this one
    // is confirmed before it is sent — same guard as the Clients screen.
    if (!window.confirm(t('admin.deleteUserConfirm') + ` ${name}?`)) return;
    try {
      await apiPost('/api/delete-user', { userId: p.profile_id });
      setPartners((prev) => prev.filter((x) => x.profile_id !== p.profile_id));
      setSuccess(`${t('admin.successDeleted')} ${name}`);
    } catch (err) {
      setError(err.message);
    }
  };

  // The View popup reuses the table's own fields so the two can never disagree.
  // DetailModal calls render(rawValue, row).
  const detailColumns = [
    { key: 'full_name', label: t('adminReferralPartners.colPartner'), render: (_, row) => partnerName(row) },
    { key: 'email', label: t('auth.email'), render: (v) => v || '—' },
    { key: 'company_name', label: t('admin.companyName'), render: (v) => v || '—' },
    { key: 'country', label: t('adminReferralPartners.colCountry'), render: (v, row) => v || row.region || '—' },
    {
      key: 'referral_code',
      label: t('adminReferralPartners.colCode'),
      render: (v) => (v
        ? <code className="adref__code" dir="ltr">{v}</code>
        : <span className="adref__muted">{t('adminReferralPartners.noCode')}</span>),
    },
    { key: 'total_referrals', label: t('adminReferralPartners.colIntroduced'), render: formatInt },
    { key: 'converted', label: t('adminReferralPartners.colConverted'), render: formatInt },
    { key: 'converted_this_month', label: t('adminReferralPartners.colThisMonth'), render: formatInt },
    { key: 'total_commission', label: t('adminReferralPartners.colCommission'), render: formatMoney },
    { key: 'unpaid_commission', label: t('adminReferralPartners.colUnpaid'), render: formatMoney },
    {
      key: 'commission_percent',
      label: t('adminReferralPartners.colRate'),
      render: (v, row) => `${Number(v ?? defaultPercent).toLocaleString(locale, { maximumFractionDigits: 2 })}%`
        + (row.has_agreed_rate ? ` — ${t('adminReferralPartners.agreedRate')}` : ''),
    },
    { key: 'joined_at', label: t('adminReferralPartners.colJoined'), render: formatDate },
    { key: 'is_active', label: t('adminReferralPartners.colStatus'), render: (_, row) => renderStatusCell(row) },
  ];

  if (authLoading || !user) {
    return <div className="page-container"><p>{t('common.loadingDashboard')}</p></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('adminReferralPartners.title')}</h1>
          <p className="page-subtitle">{t('adminReferralPartners.subtitle')}</p>
        </div>
      </div>

      <div className="adref__summary">
        <div className="adref__stat">
          <span className="adref__stat-label">{t('adminReferralPartners.statPartners')}</span>
          <span className="adref__stat-value">{formatInt(summary.total)}</span>
        </div>
        <div className="adref__stat">
          <span className="adref__stat-label">{t('adminReferralPartners.statConverted')}</span>
          <span className="adref__stat-value">{formatInt(summary.converted)}</span>
        </div>
        <div className="adref__stat adref__stat--money">
          <span className="adref__stat-label">{t('adminReferralPartners.statCommission')}</span>
          <span className="adref__stat-value">{formatMoney(summary.commission)}</span>
        </div>
        <div className="adref__stat adref__stat--due">
          <span className="adref__stat-label">{t('adminReferralPartners.statUnpaid')}</span>
          <span className="adref__stat-value">{formatMoney(summary.unpaid)}</span>
        </div>
      </div>

      <div className="adref__toolbar">
        <div className="adref__search">
          <Input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('adminReferralPartners.searchPlaceholder')}
            aria-label={t('adminReferralPartners.searchPlaceholder')}
            rightElement={<Search size={16} />}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
          <RefreshCw size={14} /> {t('adminReferralPartners.refresh')}
        </Button>
      </div>

      {success && (
        <div className="adref__alert adref__alert--success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {error && !showEdit && (
        <div className="adref__alert adref__alert--error">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <p className="adref__loading">{t('adminReferralPartners.loading')}</p>
      ) : filtered.length === 0 ? (
        <div className="adref__empty">
          <Gift size={34} />
          <h3>
            {partners.length === 0
              ? t('adminReferralPartners.emptyTitle')
              : t('adminReferralPartners.noMatchTitle')}
          </h3>
          <p>
            {partners.length === 0
              ? t('adminReferralPartners.emptyBody')
              : t('adminReferralPartners.noMatchBody')}
          </p>
        </div>
      ) : (
        <div className="adref__table-wrap">
          <table className="adref__table">
            <thead>
              <tr>
                <th>{t('adminReferralPartners.colPartner')}</th>
                <th>{t('adminReferralPartners.colCountry')}</th>
                <th>{t('adminReferralPartners.colCode')}</th>
                <th>{t('adminReferralPartners.colIntroduced')}</th>
                <th>{t('adminReferralPartners.colConverted')}</th>
                <th>{t('adminReferralPartners.colThisMonth')}</th>
                <th>{t('adminReferralPartners.colCommission')}</th>
                <th>{t('adminReferralPartners.colUnpaid')}</th>
                <th>{t('adminReferralPartners.colRate')}</th>
                <th>{t('adminReferralPartners.colJoined')}</th>
                <th>{t('adminReferralPartners.colStatus')}</th>
                <th>{t('dashboard.action')}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr key={p.profile_id}>
                  <td>
                    <div className="adref__partner">
                      <span className="adref__partner-name">
                        {p.full_name || p.company_name || p.email || '—'}
                      </span>
                      {p.email && <span className="adref__partner-sub">{p.email}</span>}
                      {p.company_name && p.full_name && (
                        <span className="adref__partner-sub">{p.company_name}</span>
                      )}
                    </div>
                  </td>
                  <td>{p.country || p.region || '—'}</td>
                  <td>
                    {/* The partner's share link carries this code, so it is the
                        value an admin is asked for when a client disputes who
                        introduced them. Forced LTR: the code is ASCII and would
                        otherwise be re-ordered inside the Arabic layout. */}
                    {p.referral_code
                      ? <code className="adref__code" dir="ltr">{p.referral_code}</code>
                      : <span className="adref__muted">{t('adminReferralPartners.noCode')}</span>}
                  </td>
                  <td>{formatInt(p.total_referrals)}</td>
                  <td>{formatInt(p.converted)}</td>
                  <td>{formatInt(p.converted_this_month)}</td>
                  <td className="adref__money">{formatMoney(p.total_commission)}</td>
                  <td className="adref__money adref__money--due">
                    {formatMoney(p.unpaid_commission)}
                  </td>
                  <td>
                    <span className="adref__rate">
                      {`${Number(p.commission_percent ?? defaultPercent)
                        .toLocaleString(locale, { maximumFractionDigits: 2 })}%`}
                    </span>
                    {p.has_agreed_rate && (
                      <span className="adref__rate-note">
                        {t('adminReferralPartners.agreedRate')}
                      </span>
                    )}
                  </td>
                  <td>{formatDate(p.joined_at)}</td>
                  <td>{renderStatusCell(p)}</td>
                  <td className="adref__actions">
                    {/* View is available to every admin who can reach the list;
                        only the Super Admin gets the three write actions, the
                        same split the Clients screen applies. */}
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="adref__footnote">
        {t('adminReferralPartners.footnote', { percent: defaultPercent })}
      </p>

      {/* Edit partner */}
      <Modal isOpen={showEdit} onClose={() => setShowEdit(false)} title={t('adminReferralPartners.editTitle')}>
        <form onSubmit={submitEdit} className="adref__form">
          {error && (
            <div className="adref__alert adref__alert--error">
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}
          {/* admin.fullName already carries its own asterisk. */}
          <Input
            label={t('admin.fullName')}
            id="edit-partner-name"
            name="full_name"
            value={editForm.full_name}
            onChange={(e) => setEditForm((p) => ({ ...p, full_name: e.target.value }))}
            required
          />
          <Input
            label={`${t('auth.email')} *`}
            type="email"
            id="edit-partner-email"
            name="email"
            value={editForm.email}
            onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <Input
            label={t('admin.companyName')}
            id="edit-partner-company"
            name="company_name"
            value={editForm.company_name}
            onChange={(e) => setEditForm((p) => ({ ...p, company_name: e.target.value }))}
          />
          <Input
            label={t('admin.country')}
            id="edit-partner-country"
            name="country"
            placeholder={t('admin.countryPlaceholder')}
            value={editForm.country}
            onChange={(e) => setEditForm((p) => ({ ...p, country: e.target.value }))}
          />
          <div className="adref__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowEdit(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>
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
