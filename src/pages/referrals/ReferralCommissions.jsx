import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import BackButton from '../../components/ui/BackButton';
import { DollarSign, Gift, Clock, TrendingUp } from 'lucide-react';
import './Referrals.css';

// "Commissions" — one of the six boxes the client asked for on the Referral
// Program Dashboard (6 Sep).
//
// The tier ladder was moved off the Clients screen and joined here with the
// thing it was always missing: the money itself, line by line. A partner
// looking at "45%" wants to know which sales earned it and which of them have
// actually been paid out, and that answer used to live nowhere.
export default function ReferralCommissions() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [rows, setRows] = useState([]);
  const [tiers, setTiers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return;
    let mounted = true;
    (async () => {
      setLoading(true);
      const [refRes, tierRes] = await Promise.all([
        supabase
          .from('referrals')
          .select('*')
          .eq('referrer_id', user.id)
          .order('created_at', { ascending: false }),
        supabase
          .from('referral_commission_tiers')
          .select('*')
          .eq('is_active', true)
          .order('min_conversions', { ascending: true }),
      ]);
      if (!mounted) return;
      setRows(refRes.data || []);
      setTiers(tierRes.data || []);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, [user?.id]);

  // Only converted rows carry money. Everything else is a lead.
  //
  // Two different numbers, and the client named them separately on 7 Sep:
  // "Sales which they have generated" is what the CLIENT paid; "Credit amount
  // which they have generated from sales" is the partner's cut of it. Both
  // dashboard boxes open this screen, so both numbers have to be on it —
  // landing on a page that answers only one of them is what makes a box feel
  // broken.
  const salesTotal = rows.reduce((sum, r) => sum + (parseFloat(r.payment_amount) || 0), 0);
  const earned = rows.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);
  const paid = rows
    .filter(r => r.payout_status === 'paid')
    .reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);
  // Derived by subtraction rather than by a second filter: any row that is not
  // marked paid is still owed, including rows whose payout_status is null,
  // which a `.filter(r => r.payout_status === 'pending')` would silently drop.
  const outstanding = earned - paid;

  // Rolling-12-month conversion count — the tier evaluation window.
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const convertedLast12mo = rows.filter(r =>
    r.status === 'converted' && r.converted_at && new Date(r.converted_at) >= twelveMonthsAgo
  ).length;

  const currentTier = (() => {
    const sorted = [...tiers].sort((a, b) => a.min_conversions - b.min_conversions);
    const next = convertedLast12mo + 1;
    for (const tier of sorted) {
      const max = tier.max_conversions ?? Infinity;
      if (next >= tier.min_conversions && next < max) return tier;
    }
    return sorted[sorted.length - 1] || null;
  })();

  // The ledger shows only rows that earned something. A partner's full lead
  // list is the Clients screen; mixing eighty pending leads into a payments
  // table is what makes a payments table unreadable.
  const earning = rows.filter(r => parseFloat(r.commission_amount) > 0);

  const columns = [
    { key: 'referred_name', label: t('referrals.referredName'), render: (v) => v || '—' },
    { key: 'referred_company', label: t('referrals.referredCompany'), render: (v) => v || '—' },
    {
      key: 'payment_amount',
      label: t('settings.saleAmount'),
      render: (v) => (v ? `$${parseFloat(v).toFixed(2)}` : '—'),
    },
    {
      key: 'commission_amount',
      label: t('referrals.yourCommission'),
      render: (v) => (v ? `$${parseFloat(v).toFixed(2)}` : '—'),
    },
    {
      key: 'payout_status',
      label: t('referrals.payout'),
      render: (v) => (
        <StatusBadge status={v || 'pending'} label={v === 'paid' ? t('settings.paid') : t('common.processing')} />
      ),
    },
    {
      key: 'converted_at',
      label: t('dashboard.date'),
      render: (v) => (v ? new Date(v).toLocaleDateString() : '—'),
    },
  ];

  return (
    <div className="page-container">
      <BackButton fallback="/referral-dashboard" />
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('refDash.earningsTitle')}</h1>
          <p className="page-subtitle">{t('refDash.earningsDesc')}</p>
        </div>
      </div>

      <div className="referral-stats">
        <StatCard title={t('refDash.sales')} value={`$${salesTotal.toFixed(2)}`} icon={TrendingUp} iconColor="#0ea5e9" />
        <StatCard title={t('referrals.totalEarnings')} value={`$${earned.toFixed(2)}`} icon={DollarSign} iconColor="#f59e0b" />
        <StatCard title={t('referrals.commissionPaid')} value={`$${paid.toFixed(2)}`} icon={Gift} iconColor="#10b981" />
        <StatCard title={t('referrals.commissionOutstanding')} value={`$${outstanding.toFixed(2)}`} icon={Clock} iconColor="#6366f1" />
      </div>

      {tiers.length > 0 && (
        <div className="referral-section">
          <h3 className="referral-section__title">{t('referrals.commissionTier')}</h3>
          <div className="referral-tier-current">
            <div className="referral-tier-current__label">
              {t('referrals.yourTier', { count: convertedLast12mo })}
            </div>
            <div className="referral-tier-current__value">
              {currentTier
                ? `${currentTier.label || `${currentTier.min_conversions}+`} — ${currentTier.commission_percent}%`
                : t('referrals.noTierYet')}
            </div>
          </div>
          <div className="referral-tier-grid">
            {tiers.map(tier => (
              <div
                key={tier.id}
                className={`referral-tier${currentTier?.id === tier.id ? ' referral-tier--current' : ''}`}
              >
                <div className="referral-tier__label">
                  {tier.label || `${tier.min_conversions}+ ${t('referrals.certs')}`}
                </div>
                <div className="referral-tier__percent">{tier.commission_percent}%</div>
                <div className="referral-tier__range">
                  {tier.max_conversions == null
                    ? `${tier.min_conversions}+ ${t('referrals.certsIn12mo')}`
                    : `${tier.min_conversions}–${tier.max_conversions} ${t('referrals.certsIn12mo')}`}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="referral-section">
        <h3 className="referral-section__title">{t('referrals.commissionLedger')}</h3>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>{t('referrals.loadingReferrals')}</p>
        ) : (
          <DataTable columns={columns} data={earning} emptyMessage={t('referrals.noCommissionsYet')} />
        )}
      </div>
    </div>
  );
}
