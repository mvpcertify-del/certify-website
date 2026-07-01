import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { CircleDollarSign, CheckCircle2, Clock } from 'lucide-react';

// Super-Admin sales overview built on the existing `payments` table. Shows total
// collected revenue, pending revenue, and the most recent transactions. This is
// the destination for the "Sales" box on the Main Dashboard.
const PAID_STATUSES = ['paid', 'completed', 'succeeded'];

export default function Sales() {
  const { t } = useTranslation();
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');
      const { data, error: err } = await supabase
        .from('payments')
        .select('id, amount, currency, payment_type, status, created_at, client:profiles!payments_client_id_fkey ( full_name, email )')
        .order('created_at', { ascending: false })
        .limit(100);
      if (!mounted) return;
      if (err) {
        console.error('Sales load failed:', err);
        setError(err.message);
      } else {
        setPayments(data || []);
      }
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, []);

  const isPaid = (p) => PAID_STATUSES.includes((p.status || '').toLowerCase());
  const sum = (rows) => rows.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const fmt = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const paidRows = payments.filter(isPaid);
  const pendingRows = payments.filter((p) => !isPaid(p));
  const totalRevenue = sum(paidRows);
  const pendingRevenue = sum(pendingRows);

  const stats = [
    { key: 'revenue', label: t('sales.totalRevenue'), value: fmt(totalRevenue), icon: CircleDollarSign, color: '#10b981' },
    { key: 'paid',    label: t('sales.paidCount'),    value: paidRows.length,    icon: CheckCircle2,     color: '#3ECF8E' },
    { key: 'pending', label: t('sales.pendingAmount'), value: fmt(pendingRevenue), icon: Clock,          color: '#f59e0b' },
  ];

  const columns = [
    {
      key: 'client',
      label: t('sales.client'),
      render: (val) => val?.full_name || val?.email || '—',
    },
    {
      key: 'amount',
      label: t('sales.amount'),
      render: (val, row) => `${(row.currency || 'usd').toUpperCase()} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    { key: 'payment_type', label: t('sales.type'), render: (val) => val || '—' },
    { key: 'status', label: t('dashboard.status'), render: (val) => <StatusBadge status={val || 'pending'} /> },
    { key: 'created_at', label: t('sales.date'), render: (val) => (val ? new Date(val).toLocaleDateString() : '—') },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('sales.title')}</h1>
          <p className="page-subtitle">{t('sales.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div style={{
          padding: '10px 12px',
          marginBottom: 'var(--spacing-md)',
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.3)',
          color: '#ef4444',
          borderRadius: 6,
          fontSize: '0.85rem',
        }}>
          {error}
        </div>
      )}

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 'var(--spacing-lg, 20px)',
        marginBottom: 'var(--spacing-lg, 20px)',
      }}>
        {stats.map((s) => (
          <div key={s.key} style={{
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: 20,
            background: 'var(--color-surface, #fff)',
            border: '1px solid var(--color-border, #e5e7eb)',
            borderRadius: 12,
          }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 48, height: 48, borderRadius: 12,
              background: `${s.color}1a`, color: s.color,
            }}>
              <s.icon size={24} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', lineHeight: 1.1 }}>
                {loading ? '…' : s.value}
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--color-text-tertiary)' }}>{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {loading ? (
        <p>{t('common.loading')}</p>
      ) : (
        <DataTable
          columns={columns}
          data={payments}
          emptyMessage={t('sales.noPayments')}
        />
      )}
    </div>
  );
}
