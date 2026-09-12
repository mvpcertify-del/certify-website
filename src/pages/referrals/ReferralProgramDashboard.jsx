import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { TRAINING_TOPICS } from './trainingTopics';
import {
  Bell, Users, CircleDollarSign, TrendingUp, Megaphone, Send, GraduationCap,
} from 'lucide-react';
import DashboardBoxes from '../../components/ui/DashboardBoxes';
import { Select } from '../../components/ui/FormElements';
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
  { key: 'training',      icon: GraduationCap,    path: '/referrals/training',    color: '#8b5cf6' },
  { key: 'clients',       icon: Users,            path: '/referrals',             color: '#3ECF8E' },
  // Sales and Credit are two different numbers — what the partner's clients
  // paid, and what the partner earned from it — but one subject, so both open
  // the same ledger. Two screens showing one table is two to keep correct.
  { key: 'sales',         icon: TrendingUp,       path: '/referrals/commissions', color: '#0ea5e9', currency: true },
  { key: 'commissions',   icon: CircleDollarSign, path: '/referrals/commissions', color: '#10b981', currency: true },
  // Marketing Tools and Auto Proposal likewise: the client described picking a
  // standard, ticking the letter/profile/brochure and sending, then described
  // an auto proposal sent with the partner's discount code. That is one action,
  // and it is one composer.
  { key: 'marketing',     icon: Megaphone,        path: '/referrals/marketing',   color: '#6366f1' },
  { key: 'proposal',      icon: Send,             path: '/referrals/marketing',   color: '#f97316' },
  { key: 'notifications', icon: Bell,             path: '/notifications',         color: '#f59e0b', text: true },
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
  // Super Admin only: regional_admin does not hold VIEW_REFERRALS, so it can
  // never reach this route in the first place.
  const isAdmin = user?.role === ROLES.SUPER_ADMIN;
  const [partners, setPartners] = useState([]);
  const [viewingId, setViewingId] = useState('');

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
      .then((r) => { if (mounted) setPartners(r?.partners || []); })
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
        if (!targetPartner) {
          setCounts({});
          setLoading(false);
          return;
        }
        const materialsForAdmin = await apiPost('/api/outreach-assets', { action: 'partner-list' })
          .then((r) => (r?.assets || []).length, () => null);
        if (!mounted) return;
        setCounts({
          training: TRAINING_TOPICS.length,
          clients: targetPartner.total_referrals ?? null,
          sales: targetPartner.total_sales ?? null,
          commissions: targetPartner.total_commission ?? null,
          marketing: materialsForAdmin,
          proposal: targetPartner.pending ?? null,
          notifications: (targetPartner.notifications_unread == null
            || targetPartner.notifications_total == null)
            ? null
            : t('refDash.notificationsValue', {
              unread: targetPartner.notifications_unread,
              total: targetPartner.notifications_total,
            }),
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
  }, [user?.id, t, isAdmin, targetPartner]);

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
                : t('refDash.adminPreviewNone'))
              : t('refDash.welcome', { name: user?.full_name || user?.name || t('common.user') })}
          </p>
        </div>
      </div>

      {isAdmin && (
        <div className="refdash__admin-preview">
          <p className="refdash__admin-preview-hint">{t('refDash.adminPreviewHint')}</p>
          <Select
            id="refdash-partner"
            label={t('refDash.adminPreviewPick')}
            value={viewingId}
            onChange={(e) => setViewingId(e.target.value)}
          >
            <option value="">{t('refDash.adminPreviewNone')}</option>
            {partners.map((p) => (
              <option key={p.profile_id} value={p.profile_id}>
                {p.full_name || p.email}{p.company_name ? ` — ${p.company_name}` : ''}
              </option>
            ))}
          </Select>
        </div>
      )}

      <DashboardBoxes
        loading={loading}
        boxes={BOXES.map((box) => ({
          ...box,
          value: formatValue(box),
          label: t(`refDash.${box.key}`),
          desc: t(`refDash.${box.key}Desc`),
        }))}
      />
    </div>
  );
}
