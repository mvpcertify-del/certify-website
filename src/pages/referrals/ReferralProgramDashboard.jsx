import { useState, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { TRAINING_TOPICS } from './trainingTopics';
import {
  Bell, Users, CircleDollarSign, TrendingUp, Megaphone, Send, GraduationCap,
} from 'lucide-react';
import DashboardBoxes from '../../components/ui/DashboardBoxes';
import DataTable from '../../components/ui/DataTable';
import { Button, Input } from '../../components/ui/FormElements';
import { ROLES } from '../../utils/roles';

// The Referral Program Dashboard (client, 6 Sep).
//
//   "This is to be renamed as Referral Program Dashboard, which should include
//    all Notifications, Clients, Commissions, Coupons to share, Marketing
//    Material, Ready Email templates, & the Referral Partner can select. It
//    should be similar to the Super Admin which will enable the partner to
//    select from the boxes"
//
// So this is deliberately the SAME grid of boxes as the Super Admin's landing
// screen — it imports MainDashboard.css rather than growing a second card
// style, because "similar to the Super Admin" is the requirement, and two
// stylesheets for one card is how they stop being similar.
//
// Each box shows a live number so the grid is a status board, not a menu with
// pictures. The number is the one fact that decides whether the partner needs
// to open that screen at all.
const BOXES = [
  // Training leads, on the client's explicit instruction (7 Sep: "Position it
  // as the first box"). It is also the right first box on its own merits — a
  // partner who has just been approved has nothing to look at in the other six
  // and everything to learn.
  // `adminPath` is where a Super Admin lands instead. Without it every box
  // sent the admin to the signed-in partner's own screen — their own empty
  // referral list — which is the opposite of "take the SA to that particular
  // section to check the detailed data" (client, 13 Sep).
  { key: 'training',      icon: GraduationCap,    path: '/referrals/training',    color: '#8b5cf6' },
  { key: 'clients',       icon: Users,            path: '/referrals', adminPath: '/admin/referral-partners',             color: '#3ECF8E' },
  // Sales and Credit are two different numbers — what the partner's clients
  // paid, and what the partner earned from it — but one subject, so both open
  // the same ledger. Two screens showing one table is two to keep correct.
  { key: 'sales',         icon: TrendingUp,       path: '/referrals/commissions', adminPath: '/admin/sales', color: '#0ea5e9', currency: true },
  { key: 'commissions',   icon: CircleDollarSign, path: '/referrals/commissions', adminPath: '/admin/payouts', color: '#10b981', currency: true },
  // Marketing Tools and Auto Proposal likewise: the client described picking a
  // standard, ticking the letter/profile/brochure and sending, then described
  // an auto proposal sent with the partner's discount code. That is one action,
  // and it is one composer.
  { key: 'marketing',     icon: Megaphone,        path: '/referrals/marketing', adminPath: '/referrals/marketing',   color: '#6366f1' },
  { key: 'proposal',      icon: Send,             path: '/referrals/marketing', adminPath: '/referrals/marketing',   color: '#f97316' },
  { key: 'notifications', icon: Bell,             path: '/notifications', adminPath: '/notifications',         color: '#f59e0b', text: true },
];


export default function ReferralProgramDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  // An admin opening this screen is reviewing somebody else's dashboard, not
  // their own. Without the picker below they would see their own empty figures
  // and reasonably conclude the feature was never switched on — which is
  // exactly what happened on 12 Sep.
  // Super Admin only, and checked by role rather than by permission on
  // purpose. VIEW_REFERRALS is not proof of being an admin here: a super admin
  // can grant it to any role from /admin/permissions, and a country admin who
  // received it would then reach this route. Such a user falls through to the
  // partner branch below and reads only their own rows under RLS, which is the
  // safe outcome — but it means the region scoping in `listReferralPartners`
  // is currently unreachable, and a country admin sees an empty dashboard
  // rather than their region's partners. Worth revisiting if the client asks
  // for country admins to review their own region.
  const isAdmin = user?.role === ROLES.SUPER_ADMIN;
  const [partners, setPartners] = useState([]);
  const [viewingId, setViewingId] = useState('');
  const [partnerQuery, setPartnerQuery] = useState('');
  // `partners` is [] both before the fetch lands and after it fails, and those
  // two mean the opposite of each other. Without this flag the totals below
  // read a failed fetch as a real "$0.00 across 0 partners" — the one thing
  // DashboardBoxes is explicit about never faking.
  const [partnersLoaded, setPartnersLoaded] = useState(false);

  // Whose dashboard is on screen. A partner always sees their own, and reads it
  // straight from the tables under RLS; an admin previews one of these rows,
  // because those same policies would hand them nothing.
  const targetPartner = partners.find((p) => p.profile_id === viewingId) || null;

  // The list an admin chooses from. Country admins are scoped to their own
  // region by the endpoint itself, so this needs no filter here.
  useEffect(() => {
    if (!isAdmin) return undefined;
    let mounted = true;
    apiPost('/api/referrals', { action: 'partner-list' })
      .then((r) => {
        if (!mounted) return;
        // Carry `id` alongside `profile_id`: DataTable keys rows on `row.id`
        // and would otherwise fall back to the array index, which shifts under
        // the search box as the admin types.
        setPartners((r?.partners || []).map((p) => ({ ...p, id: p.profile_id })));
        setPartnersLoaded(true);
      })
      .catch(() => { if (mounted) setPartners([]); });
    return () => { mounted = false; };
  }, [isAdmin]);

  useEffect(() => {
    if (!user?.id) return undefined;
    let mounted = true;

    const load = async () => {
      setLoading(true);

      // Admin preview. Every figure comes from the partner-list aggregate
      // because RLS scopes both `referrals` and `notifications` to the signed-in
      // user — an admin querying them from the browser would correctly get
      // nothing back, which is not the same as the partner having nothing.
      if (isAdmin) {
        const materialsForAdmin = await apiPost('/api/outreach-assets', { action: 'partner-list' })
          .then((r) => (r?.assets || []).length, () => null);
        if (!mounted) return;

        // With nobody picked the boxes summarise EVERY partner rather than
        // showing seven dashes. The client's objection on 13 Sep was that
        // reviewing 500 partners one at a time is not a review at all — the
        // programme-wide figure is the one an admin opens this screen for, and
        // a single partner is the drill-down, not the entry point.
        const scope = targetPartner ? [targetPartner] : partners;
        // A dash until the list is actually in hand. Once it is, a programme
        // with no partners really does total zero, so zero is the right answer.
        const total = (field) => (partnersLoaded
          ? scope.reduce((acc, p) => acc + (Number(p[field]) || 0), 0)
          : null);

        const unread = total('notifications_unread');
        const totalNotes = total('notifications_total');

        setCounts({
          training: TRAINING_TOPICS.length,
          clients: total('total_referrals'),
          sales: total('total_sales'),
          commissions: total('total_commission'),
          marketing: materialsForAdmin,
          proposal: total('pending'),
          notifications: (unread == null || totalNotes == null)
            ? null
            : t('refDash.notificationsValue', { unread, total: totalNotes }),
        });
        setLoading(false);
        return;
      }


      // Each count is asked for independently and allowed to fail on its own.
      // One box that cannot answer shows a dash; it does not blank the other
      // six — a partner whose notifications query errors should still be able
      // to see what they have earned.

      // Unread AND total, because the client asked for both (7 Sep:
      // "Notifications Box of Unread Notifications & total notifications").
      // Two head-only counts rather than fetching the rows and filtering in
      // the browser: the partner never sees the bodies on this screen, and a
      // partner with a thousand notifications should not download them to
      // render one number.
      const unread = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .then(({ count, error }) => (error ? null : count || 0), () => null);

      const totalNotes = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .then(({ count, error }) => (error ? null : count || 0), () => null);

      // Clients, sales and credit all come from ONE read of the partner's own
      // referral rows. They are three of the client's seven boxes but they are
      // answered by the same three columns, so asking three times would be
      // three round trips for one table.
      const rows = supabase
        .from('referrals')
        .select('commission_amount, payment_amount, status')
        .eq('referrer_id', user.id)
        .then(({ data, error }) => (error ? null : data || []), () => null);

      // The document library. Served through the API, not read from the bucket:
      // the bucket is private on purpose (see api/outreach-assets.js).
      const materials = apiPost('/api/outreach-assets', { action: 'partner-list' })
        .then((r) => (r?.assets || []).length, () => null);

      const [unreadCount, totalCount, referralRows, materialCount] =
        await Promise.all([unread, totalNotes, rows, materials]);

      if (!mounted) return;

      const sum = (field) => referralRows
        ? referralRows.reduce((acc, r) => acc + (parseFloat(r[field]) || 0), 0)
        : null;

      setCounts({
        // Not a count — the number of walkthroughs, which is fixed by the
        // build rather than by data, because the tutorials are written into
        // the platform. See trainingTopics.js.
        training: TRAINING_TOPICS.length,
        clients: referralRows ? referralRows.length : null,
        // What the partner's clients actually PAID. Distinct from the credit
        // below, and the number the client named first.
        sales: sum('payment_amount'),
        commissions: sum('commission_amount'),
        marketing: materialCount,
        // How many leads are still worth writing to. A converted client has
        // already bought, so counting them here would tell the partner they
        // have work waiting when they do not.
        proposal: referralRows
          ? referralRows.filter(r => r.status !== 'converted').length
          : null,
        // "3 unread of 12" in one tile, rather than a bare unread count that
        // reads identically whether the partner has no news or no history.
        notifications: (unreadCount == null || totalCount == null)
          ? null
          : t('refDash.notificationsValue', { unread: unreadCount, total: totalCount }),
      });
      setLoading(false);
    };

    load();
    return () => { mounted = false; };
    // `t` is in the deps because the notifications tile is built from a
    // translated string here rather than at render time; without it the tile
    // keeps the old language after a switch.
  }, [user?.id, t, isAdmin, targetPartner, partners, partnersLoaded]);

  // Name, company, email and referral code are all things an admin might be
  // handed when someone asks about a partner, so any of them finds the row.
  const filteredPartners = useMemo(() => {
    const q = partnerQuery.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((p) => [p.full_name, p.company_name, p.email, p.referral_code]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [partners, partnerQuery]);

  const money = (v) => `$${Number(v || 0).toFixed(2)}`;

  const partnerColumns = [
    {
      key: 'full_name',
      label: t('refDash.adminColPartner'),
      render: (v, row) => (
        <div style={{ display: 'grid', gap: 2 }}>
          <strong>{v || row.email}</strong>
          {row.company_name && (
            <span style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem' }}>
              {row.company_name}
            </span>
          )}
        </div>
      ),
    },
    { key: 'total_referrals', label: t('refDash.clients'), render: (v) => Number(v || 0).toLocaleString() },
    { key: 'converted', label: t('refDash.adminColConverted'), render: (v) => Number(v || 0).toLocaleString() },
    { key: 'total_sales', label: t('refDash.sales'), render: money },
    { key: 'total_commission', label: t('refDash.commissions'), render: money },
    { key: 'unpaid_commission', label: t('refDash.adminColUnpaid'), render: money },
    {
      key: 'notifications_unread',
      label: t('refDash.notifications'),
      render: (v, row) => t('refDash.notificationsValue', {
        unread: Number(v || 0),
        total: Number(row.notifications_total || 0),
      }),
    },
  ];

  const formatValue = (box) => {
    const v = counts[box.key];
    if (v == null) return null;
    if (box.text) return v;
    if (box.currency) return `$${Number(v).toFixed(2)}`;
    return Number(v).toLocaleString();
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('refDash.title')}</h1>
          <p className="page-subtitle">
            {isAdmin
              ? (targetPartner
                ? t('refDash.adminViewingPartner', { name: targetPartner.full_name || targetPartner.email })
                : (partnersLoaded
                  ? t('refDash.adminAllPartners', { count: partners.length })
                  : t('refDash.adminLoadingPartners')))
              : t('refDash.welcome', { name: user?.full_name || user?.name || t('common.user') })}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="refdash__admin-preview">
          <p className="refdash__admin-preview-hint">{t('refDash.adminScopeHint')}</p>
          {targetPartner && (
            <Button variant="secondary" size="sm" onClick={() => setViewingId('')}>
              {t('refDash.adminBackToAll')}
            </Button>
          )}
        </div>
      )}

      <DashboardBoxes
        loading={loading}
        boxes={BOXES.map((box) => ({
          ...box,
          path: isAdmin ? (box.adminPath || box.path) : box.path,
          value: formatValue(box),
          label: t(`refDash.${box.key}`),
          desc: t(`refDash.${box.key}Desc`),
        }))}
      />

      {isAdmin && (
        <div style={{ marginTop: 24 }}>
          <div className="page-header" style={{ marginBottom: 12 }}>
            <div>
              <h2 className="page-title" style={{ fontSize: '1.25rem' }}>
                {t('refDash.adminPartnersTitle')}
              </h2>
              <p className="page-subtitle">
                {partnersLoaded
                  ? t('refDash.adminPartnersFound', { count: filteredPartners.length })
                  : t('refDash.adminLoadingPartners')}
              </p>
            </div>
            <Input
              id="refdash-partner-search"
              name="partnerSearch"
              value={partnerQuery}
              onChange={(e) => setPartnerQuery(e.target.value)}
              placeholder={t('refDash.adminSearchPartners')}
              style={{ width: '260px' }}
            />
          </div>
          {/* A table rather than the old dropdown: it carries each partner's
              figures, so the admin reads the whole programme in one pass and
              opens a partner only when a row is worth a closer look. */}
          <DataTable
            columns={partnerColumns}
            data={filteredPartners}
            onRowClick={(row) => setViewingId(
              row.profile_id === viewingId ? '' : row.profile_id
            )}
            emptyMessage={t('refDash.adminNoPartners')}
          />
        </div>
      )}
    </div>
  );
}
