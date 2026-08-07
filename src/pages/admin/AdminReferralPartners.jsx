import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Gift, RefreshCw, Search } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../lib/apiClient';
import { Button, Input } from '../../components/ui/FormElements';
import './AdminReferralPartners.css';

// Super Admin / Country Admin view over referral partners — the "Referral
// Partners" entry the client asked for under Clients in the left menu (7 Aug).
//
// Read-only by design, matching the consultancy board next to it: nothing here
// deactivates a partner or releases a payout. Deactivation stays in User
// Management and payouts stay on the referral ledger, so this screen can be
// shown to anyone who needs the numbers without widening what they can change.
//
// The region scope is applied by the API (a country admin only ever receives
// their own region's partners), not by this component — the browser must not be
// the thing deciding which countries an admin may see.
export default function AdminReferralPartners() {
  const { t, i18n } = useTranslation();
  const { user, loading: authLoading } = useAuth();

  const [partners, setPartners] = useState([]);
  const [defaultPercent, setDefaultPercent] = useState(10);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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

      {error && <div className="adref__alert adref__alert--error">{error}</div>}

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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="adref__footnote">
        {t('adminReferralPartners.footnote', { percent: defaultPercent })}
      </p>
    </div>
  );
}
