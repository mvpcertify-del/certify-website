import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { Bell, Users, CircleDollarSign, Ticket, Paperclip, Mail } from 'lucide-react';
import { READY_TEMPLATES } from './readyTemplates';
import '../dashboard/MainDashboard.css';

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
  { key: 'notifications', icon: Bell,             path: '/notifications',          color: '#f59e0b' },
  { key: 'clients',       icon: Users,            path: '/referrals',              color: '#3ECF8E' },
  { key: 'commissions',   icon: CircleDollarSign, path: '/referrals/commissions',  color: '#10b981', currency: true },
  { key: 'coupons',       icon: Ticket,           path: '/referrals/coupons',      color: '#ec4899', text: true },
  { key: 'materials',     icon: Paperclip,        path: '/referrals/materials',    color: '#6366f1' },
  { key: 'templates',     icon: Mail,             path: '/referrals/templates',    color: '#0ea5e9' },
];

export default function ReferralProgramDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) return undefined;
    let mounted = true;

    const load = async () => {
      setLoading(true);

      // Each count is asked for independently and allowed to fail on its own.
      // One box that cannot answer shows a dash; it does not blank the other
      // five — a partner whose notifications query errors should still be able
      // to see what they have earned.
      const unread = supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('read', false)
        .then(({ count, error }) => (error ? null : count || 0), () => null);

      // Commission and client count come from ONE read of the partner's own
      // rows rather than two round trips, because both boxes are answered by
      // the same handful of columns.
      const rows = supabase
        .from('referrals')
        .select('commission_amount')
        .eq('referrer_id', user.id)
        .then(({ data, error }) => (error ? null : data || []), () => null);

      // The document library. Served through the API, not read from the bucket:
      // the bucket is private on purpose (see api/outreach-assets.js).
      const materials = apiPost('/api/outreach-assets', { action: 'partner-list' })
        .then((r) => (r?.assets || []).length, () => null);

      const [unreadCount, referralRows, materialCount] = await Promise.all([unread, rows, materials]);

      if (!mounted) return;
      setCounts({
        notifications: unreadCount,
        clients: referralRows ? referralRows.length : null,
        commissions: referralRows
          ? referralRows.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0)
          : null,
        // Not a count: the partner's own code, which is the thing they are
        // going to the Coupons screen to copy.
        coupons: user?.referral_code || null,
        materials: materialCount,
        // Fixed, because these letters are written into the platform rather
        // than uploaded — the number changes with a deploy, not with data.
        templates: READY_TEMPLATES.length,
      });
      setLoading(false);
    };

    load();
    return () => { mounted = false; };
  }, [user?.id, user?.referral_code]);

  const formatValue = (box) => {
    const v = counts[box.key];
    if (v == null) return '—';
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
            {t('refDash.welcome', { name: user?.full_name || user?.name || t('common.user') })}
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
            <div className="main-dash__label">{t(`refDash.${box.key}`)}</div>
            <div className="main-dash__desc">{t(`refDash.${box.key}Desc`)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
