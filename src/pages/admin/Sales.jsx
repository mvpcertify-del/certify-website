import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import { CircleDollarSign, CheckCircle2, Clock } from 'lucide-react';

// Super-Admin sales overview. Revenue is derived from the orders themselves
// (`applications`) plus phase20's `invoices` — NOT from the `payments` table,
// which no code path has ever written to and which made this page report $0
// while real paid business existed.
const PAID_STATUSES = ['paid', 'verified'];
const PENDING_STATUSES = ['pending', 'awaiting_verification'];

const METHOD_LABEL_KEYS = {
  card: 'payment.methodCard',
  cash: 'payment.methodCash',
  bank_transfer: 'payment.methodBankTransfer',
  paypal: 'payment.methodPaypal',
  moneygram: 'payment.methodMoneygram',
};

const STATUS_VARIANTS = {
  paid: 'success',
  verified: 'success',
  pending: 'warning',
  awaiting_verification: 'warning',
  unpaid: 'danger',
};

export default function Sales() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  const userRegion = user?.region || null;

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      setLoading(true);
      setError('');

      // No .limit(): the stat tiles above the table are totals, and a silently
      // truncated total is worse than a slow page.
      const [appsRes, invoicesRes] = await Promise.all([
        supabase
          .from('applications')
          .select('id, company_name, total_amount, payment_status, payment_method, created_at, client:profiles!client_id(full_name, email, company_name, region)')
          .order('created_at', { ascending: false }),
        supabase
          .from('invoices')
          .select('application_id, total, amount_paid, invoice_number, currency'),
      ]);

      if (!mounted) return;
      if (appsRes.error) {
        console.error('Sales load failed:', appsRes.error);
        setError(appsRes.error.message);
        setLoading(false);
        return;
      }
      // Invoices are only the fallback amount source, so a failure there
      // degrades the figures rather than blanking the page.
      if (invoicesRes.error) console.error('Sales invoice load failed:', invoicesRes.error);

      const invoiceByApp = new Map();
      (invoicesRes.data || []).forEach((inv) => {
        if (inv.application_id && !invoiceByApp.has(inv.application_id)) {
          invoiceByApp.set(inv.application_id, inv);
        }
      });

      const mapped = (appsRes.data || []).map((app) => {
        const invoice = invoiceByApp.get(app.id) || null;
        return {
          id: app.id,
          // An admin-created order often has no total_amount but does have an
          // invoice — without this fallback those sales count as $0.
          amount: app.total_amount != null ? Number(app.total_amount) : Number(invoice?.total || 0),
          currency: invoice?.currency || 'USD',
          company: app.company_name || app.client?.company_name || app.client?.full_name || app.client?.email || '—',
          payment_method: app.payment_method || null,
          payment_status: app.payment_status || null,
          created_at: app.created_at,
          region: app.client?.region || null,
        };
      });

      // Regional admins see only their own region. An admin with no region set
      // sees nothing rather than everything.
      const scoped = isRegionalAdmin
        ? (userRegion ? mapped.filter((r) => r.region === userRegion) : [])
        : mapped;

      setRows(scoped);
      setLoading(false);
    };
    load();
    return () => { mounted = false; };
  }, [isRegionalAdmin, userRegion]);

  const sum = (list) => list.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const fmt = (n) => `$${Number(n || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const paidRows = rows.filter((r) => PAID_STATUSES.includes(r.payment_status));
  const pendingRows = rows.filter((r) => PENDING_STATUSES.includes(r.payment_status));
  const totalRevenue = sum(paidRows);
  const pendingRevenue = sum(pendingRows);

  const stats = [
    { key: 'revenue', label: t('sales.totalRevenue'), value: fmt(totalRevenue), icon: CircleDollarSign, color: '#10b981' },
    { key: 'paid',    label: t('sales.paidCount'),    value: paidRows.length,    icon: CheckCircle2,     color: '#3ECF8E' },
    { key: 'pending', label: t('sales.pendingAmount'), value: fmt(pendingRevenue), icon: Clock,          color: '#f59e0b' },
  ];

  const columns = [
    { key: 'company', label: t('sales.client'), render: (val) => val || '—' },
    {
      key: 'amount',
      label: t('sales.amount'),
      render: (val, row) => `${(row.currency || 'USD').toUpperCase()} ${Number(val || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}`,
    },
    {
      key: 'payment_method',
      label: t('sales.type'),
      render: (val) => (val ? t(METHOD_LABEL_KEYS[val] || 'sales.type', val) : '—'),
    },
    {
      key: 'payment_status',
      label: t('dashboard.status'),
      render: (val) => (val
        ? <StatusBadge status={val} variant={STATUS_VARIANTS[val]} label={t(`admin.paymentStatus_${val}`, val)} />
        : '—'),
    },
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
          data={rows}
          emptyMessage={t('sales.noPayments')}
        />
      )}
    </div>
  );
}
