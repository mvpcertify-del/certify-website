import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLES } from '../../utils/roles';
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
  { key: 'consultancies', icon: Briefcase,        path: '/admin/consultancies',               color: '#0ea5e9' },
  // Points at the admin board, not /referrals. /referrals is the signed-in
  // partner's OWN dashboard, so an admin clicking a box that counts 20 referral
  // partners landed on their own empty referral page.
  { key: 'referrals',     icon: Gift,             path: '/admin/referral-partners',          color: '#ec4899' },
  { key: 'sales',         icon: CircleDollarSign, path: '/admin/sales',                      color: '#10b981', currency: true },
];

// 'verified' is the legacy offline-verified value; both mean money arrived.
const PAID_STATUSES = ['paid', 'verified'];

export default function MainDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const isRegionalAdmin = user?.role === ROLES.REGIONAL_ADMIN;
  const userRegion = user?.region || null;

  useEffect(() => {
    let mounted = true;

    const countRows = async (table, apply) => {
      let q = supabase.from(table).select('*', { count: 'exact', head: true });
      if (apply) q = apply(q);
      const { count, error } = await q;
      return error ? null : (count || 0);
    };

    // Revenue is derived from the orders themselves plus phase20's invoices.
    // The `payments` table this tile used to read is never written to by any
    // code path, which is why it always showed $0 despite real paid business.
    const loadRevenue = async () => {
      const [appsRes, invoicesRes] = await Promise.all([
        supabase
          .from('applications')
          .select('id, total_amount, client:profiles!client_id(region)')
          .in('payment_status', PAID_STATUSES),
        supabase.from('invoices').select('application_id, total'),
      ]);
      if (appsRes.error) return null;

      const invoiceTotals = new Map();
      (invoicesRes.data || []).forEach((inv) => {
        if (inv.application_id && !invoiceTotals.has(inv.application_id)) {
          invoiceTotals.set(inv.application_id, Number(inv.total) || 0);
        }
      });

      return (appsRes.data || [])
        // Regional admins see only their own region; no region set → nothing.
        .filter((a) => !isRegionalAdmin || (userRegion && a.client?.region === userRegion))
        // An admin-created order often has no total_amount but does have an
        // invoice — without this fallback those sales count as $0.
        .reduce((sum, a) => sum + (a.total_amount != null
          ? Number(a.total_amount)
          : (invoiceTotals.get(a.id) || 0)), 0);
    };

    const load = async () => {
      setLoading(true);
      try {
        const [clients, certBodies, auditors, consultancies, referrals, revenue] = await Promise.all([
          countRows('profiles', (q) => q.eq('role', 'client').or('stakeholder_type.is.null,stakeholder_type.eq.client')),
          countRows('certification_bodies'),
          countRows('profiles', (q) => q.eq('role', 'auditor')),
          // The consultancy role has moved twice (client → referral in phase 19
          // → consultancy in phase 22) and this box read 0 the whole time phase
          // 19 was live, because no row could satisfy role='client' AND
          // stakeholder_type='consultancy' after that migration. So match
          // either column, which is what the destination page already does:
          // the consultancy_kpi view behind /admin/consultancies (phase23) ends
          // `WHERE p.stakeholder_type = 'consultancy' OR p.role = 'consultancy'`.
          // Matching on stakeholder_type alone left legacy rows
          // that carry role='consultancy' with a NULL stakeholder_type on the
          // page but out of this box, so the box read lower than the list.
          // Still disjoint from the referrals box below: everything added here
          // has role='consultancy', which can never also be role='referral'.
          countRows('profiles', (q) => q.or('stakeholder_type.eq.consultancy,role.eq.consultancy')),
          // Referrals must EXCLUDE consultancies or the two boxes double-count
          // the same people — which is what produced the inflated referral
          // figure while consultancies sat on the referral role.
          // `.neq` alone would silently drop rows whose stakeholder_type is NULL,
          // because NULL <> 'consultancy' is NULL, not true.
          countRows('profiles', (q) => q.eq('role', 'referral')
            .or('stakeholder_type.is.null,stakeholder_type.neq.consultancy')),
          loadRevenue(),
        ]);

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
  }, [isRegionalAdmin, userRegion]);

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
