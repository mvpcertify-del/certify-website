import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { Button } from '../../components/ui/FormElements';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { apiPost } from '../../lib/apiClient';
import { DollarSign } from 'lucide-react';
import '../settings/Settings.css';

// Referral payouts — Super Admin.
//
// This used to be a tab inside Settings, which was also My Profile (12 Sep:
// the client asked what the difference between the two was, and there was
// none). It was the only admin tab on that page doing real work, so it moved to
// a screen of its own instead of going with the tabs that were removed.
//
// Calls go through apiPost rather than raw fetch so a platform error page can
// never be printed to the admin as a message (see src/lib/apiClient.js).
export default function AdminPayouts() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [message, setMessage] = useState(null);

  const fetchReferrals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await apiPost('/api/referrals', { action: 'list', adminId: user.id });
      setReferrals(data?.referrals || []);
    } catch (err) {
      console.error('Failed to fetch referrals:', err);
      setMessage({ type: 'error', text: err.message });
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  const handleMarkPaid = async (referralId) => {
    setActionLoading(referralId);
    setMessage(null);
    try {
      await apiPost('/api/referrals', {
        action: 'mark-payout', adminId: user.id, referralId, payoutStatus: 'paid',
      });
      setMessage({ type: 'success', text: t('settings.payoutMarkedPaid') });
      fetchReferrals();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || t('settings.failedMarkPayout') });
    } finally {
      setActionLoading(null);
    }
  };

  const pendingPayouts = referrals.filter(r => r.payout_status !== 'paid');
  const paidPayouts = referrals.filter(r => r.payout_status === 'paid');
  const totalPending = pendingPayouts.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);
  const totalPaid = paidPayouts.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);

  const columns = [
    { key: 'referrer_name', label: t('settings.referrer'), render: (val, row) => (
      <div>
        <div style={{ fontWeight: 600 }}>{val}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>{row.referrer_email}</div>
      </div>
    )},
    { key: 'referred_email', label: t('settings.referredClient') },
    { key: 'payment_amount', label: t('settings.saleAmount'), render: (val) => val ? `$${parseFloat(val).toFixed(2)}` : '-' },
    { key: 'commission_amount', label: t('settings.commission'), render: (val) => val ? `$${parseFloat(val).toFixed(2)}` : '-' },
    { key: 'payout_status', label: t('settings.payoutStatus'), render: (val) => (
      <StatusBadge status={val || 'pending'} label={val === 'paid' ? t('settings.paid') : t('settings.pendingPayout')} />
    )},
    { key: 'converted_at', label: t('settings.converted'), render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { key: 'action', label: t('settings.action'), render: (_, row) => row.payout_status !== 'paid' ? (
      <Button
        size="sm"
        variant="primary"
        onClick={() => handleMarkPaid(row.id)}
        loading={actionLoading === row.id}
      >
        {t('settings.markPaid')}
      </Button>
    ) : (
      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)' }}>
        {row.paid_at ? new Date(row.paid_at).toLocaleDateString() : t('settings.paid')}
      </span>
    )},
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('settings.referralPayouts')}</h1>
          <p className="page-subtitle">{t('settings.payoutsDesc')}</p>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px',
          borderRadius: '8px',
          marginBottom: '16px',
          backgroundColor: message.type === 'error' ? '#fee2e2' : '#dcfce7',
          color: message.type === 'error' ? '#b91c1c' : '#15803d',
          border: `1px solid ${message.type === 'error' ? '#fca5a5' : '#86efac'}`,
        }}>
          {message.text}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="payout-stat-card">
          <span className="payout-stat-card__label">{t('settings.totalConversions')}</span>
          <span className="payout-stat-card__value">{referrals.length}</span>
        </div>
        <div className="payout-stat-card">
          <span className="payout-stat-card__label">{t('settings.pendingPayouts')}</span>
          <span className="payout-stat-card__value" style={{ color: '#f59e0b' }}>${totalPending.toFixed(2)}</span>
        </div>
        <div className="payout-stat-card">
          <span className="payout-stat-card__label">{t('settings.totalPaidOut')}</span>
          <span className="payout-stat-card__value" style={{ color: '#10b981' }}>${totalPaid.toFixed(2)}</span>
        </div>
      </div>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('settings.loadingPayouts')}</p>
      ) : referrals.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
          <DollarSign size={40} style={{ marginBottom: '12px', opacity: 0.4 }} />
          <p>{t('settings.noConvertedReferrals')}</p>
        </div>
      ) : (
        <DataTable columns={columns} data={referrals} emptyMessage={t('settings.noPayoutsFound')} />
      )}
    </div>
  );
}
