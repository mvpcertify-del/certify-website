import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { Users, Building, UserCheck, Briefcase, Gift, CircleDollarSign } from 'lucide-react';
import './MainDashboard.css';

// Super Admin landing overview. A grid of clickable "category" boxes that each
// jump to the relevant management screen. Kept config-driven so new boxes can be
// added by extending BOXES (client explicitly asked to "add more" later).
// The existing role dashboard (the "Certification dashboard") is untouched and
// still reachable from the sidebar.
const BOXES = [
  { key: 'clients',       icon: Users,            path: '/admin/companies',                  color: '#3ECF8E' },
  { key: 'certBodies',    icon: Building,         path: '/admin/cb-registry',                color: '#6366f1' },
  { key: 'auditors',      icon: UserCheck,        path: '/admin/auditors',                   color: '#f59e0b' },
  { key: 'consultancies', icon: Briefcase,        path: '/admin/users?stakeholder=consultancy', color: '#0ea5e9' },
  { key: 'referrals',     icon: Gift,             path: '/referrals',                        color: '#ec4899' },
  { key: 'sales',         icon: CircleDollarSign, path: '/admin/sales',                      color: '#10b981', currency: true },
];

const PAID_STATUSES = ['paid', 'completed', 'succeeded'];

export default function MainDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const countRows = async (table, apply) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (apply) q = apply(q);
      const { count, error } = await q;
      return error ? null : (count || 0);
    };

    const load = async () => {
      setLoading(true);
      try {
        const [clients, certBodies, auditors, consultancies, referrals, paidPayments] = await Promise.all([
          countRows('profiles', (q) => q.eq('role', 'client').or('stakeholder_type.is.null,stakeholder_type.eq.client')),
          countRows('certification_bodies'),
          countRows('profiles', (q) => q.eq('role', 'auditor')),
          countRows('profiles', (q) => q.eq('role', 'client').eq('stakeholder_type', 'consultancy')),
          countRows('profiles', (q) => q.eq('role', 'referral')),
          supabase.from('payments').select('amount').in('status', PAID_STATUSES),
        ]);

        const revenue = (paidPayments?.data || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        if (mounted) {
          setCounts({ clients, certBodies, auditors, consultancies, referrals, sales: revenue });
        }
      } catch (err) {
        console.error('Main dashboard counts failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, []);

  const formatValue = (box) => {
    const v = counts[box.key];
    if (v == null) return '—';
    if (box.currency) return `$${Number(v).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
    return Number(v).toLocaleString();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('mainDash.title')}</h1>
          <p className="page-subtitle">
            {t('mainDash.welcome', { name: user?.full_name || user?.name || t('common.user') })}
          </p>
        </div>
      </div>

      <div className="main-dash__grid">
        {BOXES.map((box) => (
          <button
            key={box.key}
            type="button"
            className="main-dash__card"
            onClick={() => navigate(box.path)}
            style={{ '--card-accent': box.color }}
          >
            <div className="main-dash__icon" style={{ background: `${box.color}1a`, color: box.color }}>
              <box.icon size={24} />
            </div>
            <div className="main-dash__value">{loading ? '…' : formatValue(box)}</div>
            <div className="main-dash__label">{t(`mainDash.${box.key}`)}</div>
            <div className="main-dash__desc">{t(`mainDash.${box.key}Desc`)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
