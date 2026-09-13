import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { ROLES } from '../../utils/roles';
import { Users, Building, UserCheck, Briefcase, Gift, CircleDollarSign, MessagesSquare, Bell } from 'lucide-react';
import DashboardBoxes from '../../components/ui/DashboardBoxes';
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
  { key: 'messages',      icon: MessagesSquare,   path: '/messages',                         color: '#8b5cf6' },
  { key: 'notifications', icon: Bell,             path: '/notifications',                    color: '#f97316' },
];

// 'verified' is the legacy offline-verified value; both mean money arrived.
const PAID_STATUSES = ['paid', 'verified'];

export default function MainDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
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
        const [clients, certBodies, auditors, consultancies, referrals, revenue, messages, notifications] = await Promise.all([
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
          // Every thread, not `has_unread` ones. That flag belongs to the
          // PARTNER — phase33 clears it when the partner opens the thread, and
          // Messages.jsx only clears it for the thread's own referrer — so an
          // "unread" count on the admin's dashboard would be a number no
          // action of theirs could ever move. RLS on partner_conversations
          // already returns every thread to a super admin, so no filter here;
          // the page behind this box is scoped the same way.
          countRows('partner_conversations'),
          // Notifications are per recipient, so this counts the admin's own
          // unread ones — the same set the bell in the top bar shows.
          user?.id
            ? countRows('notifications', (q) => q.eq('user_id', user.id).eq('read', false))
            : Promise.resolve(null),
        ]);

        if (mounted) {
          setCounts({ clients, certBodies, auditors, consultancies, referrals, sales: revenue, messages, notifications });
        }
      } catch (err) {
        console.error('Main dashboard counts failed:', err);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    return () => { mounted = false; };
  }, [isRegionalAdmin, userRegion, user?.id]);

  const formatValue = (box) => {
    const v = counts[box.key];
    // null is handed straight through: DashboardBoxes draws the em-dash, so
    // the "could not read this" rule lives in one place.
    if (v == null) return null;
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

      <DashboardBoxes
        loading={loading}
        boxes={BOXES.map((box) => ({
          ...box,
          value: formatValue(box),
          label: t(`mainDash.${box.key}`),
          desc: t(`mainDash.${box.key}Desc`),
        }))}
      />
    </div>
  );
}
