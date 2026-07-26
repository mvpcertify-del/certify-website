import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { Input, Button } from '../../components/ui/FormElements';
import { apiPost } from '../../lib/apiClient';
import { Link2, Copy, Check, Users, DollarSign, UserPlus, Gift, Plus, AlertCircle, CheckCircle, Mail, PenLine } from 'lucide-react';
import './Referrals.css';

export default function Referrals() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tiers, setTiers] = useState([]);

  // "Add Referral" modal — referral partner uploads a client they refer.
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ referred_name: '', referred_email: '', referred_company: '', referred_whatsapp: '', referred_website: '' });
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Per-client invite email + the editable signature it carries.
  const [sendingId, setSendingId] = useState(null);
  const [invitedIds, setInvitedIds] = useState(() => new Set());
  const [showSignature, setShowSignature] = useState(false);
  const [signature, setSignature] = useState(user?.email_signature || '');
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [success, setSuccess] = useState('');

  // The partner's real, stored code (phase25 profiles.referral_code).
  //
  // This used to be `user.id.slice(0, 8)` — computed here in the browser,
  // stored nowhere, and resolved server-side by scanning the first 1000 users
  // for a UUID prefix. Partner #1001 could never be resolved, and a prefix
  // collision would pay the wrong partner. It also could not be typed into
  // the checkout coupon box, so it discounted nobody.
  //
  // The fallback keeps the screen usable for a partner whose row predates the
  // migration; it cannot be redeemed, which is why it is labelled as pending.
  const referralCode = user?.referral_code || '';
  const codeReady = Boolean(referralCode);

  // The code points at CHECKOUT, not at signup. The old link sent buyers to
  // /signup, but the live funnel creates the account during payment — so a
  // buyer who followed it registered first and then bought through a path
  // that recorded no referral at all.
  const referralLink = codeReady
    ? `${window.location.origin}/checkout?ref=${encodeURIComponent(referralCode)}`
    : '';

  const fetchReferrals = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data } = await supabase
      .from('referrals')
      .select('*')
      .eq('referrer_id', user.id)
      .order('created_at', { ascending: false });

    setReferrals(data || []);
    setLoading(false);
  }, [user?.id]);

  useEffect(() => { fetchReferrals(); }, [fetchReferrals]);

  useEffect(() => {
    supabase
      .from('referral_commission_tiers')
      .select('*')
      .eq('is_active', true)
      .order('min_conversions', { ascending: true })
      .then(({ data }) => setTiers(data || []));
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* fallback */ }
  };

  const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);

  const openAdd = () => {
    setAddForm({ referred_name: '', referred_email: '', referred_company: '', referred_whatsapp: '', referred_website: '' });
    setAddError('');
    setShowAdd(true);
  };

  const handleAddReferral = async (e) => {
    e.preventDefault();
    setAddError('');
    const email = addForm.referred_email.trim().toLowerCase();
    if (!addForm.referred_name.trim() || !email) {
      setAddError(t('admin.fillRequired'));
      return;
    }
    if (!isValidEmail(email)) {
      setAddError(t('auth.validationEmail'));
      return;
    }
    // Guard against referring yourself.
    if (user?.email && email === user.email.toLowerCase()) {
      setAddError(t('referrals.noSelfReferral'));
      return;
    }
    // Prevent duplicate referred emails for this referrer.
    if (referrals.some(r => (r.referred_email || '').toLowerCase() === email)) {
      setAddError(t('referrals.alreadyReferred'));
      return;
    }

    setSaving(true);
    try {
      // Insert is enforced by RLS to referrer_id = auth.uid().
      const { data, error } = await supabase
        .from('referrals')
        .insert({
          referrer_id: user.id,
          referred_email: email,
          referred_name: addForm.referred_name.trim(),
          referred_company: addForm.referred_company.trim() || null,
          referred_whatsapp: addForm.referred_whatsapp.trim() || null,
          referred_website: addForm.referred_website.trim() || null,
          status: 'pending',
        })
        .select()
        .single();
      if (error) throw error;
      setReferrals(prev => [data, ...prev]);
      setSuccess(`${t('referrals.referralAdded')}: ${addForm.referred_name.trim()}`);
      setShowAdd(false);
    } catch (err) {
      setAddError(err.message);
    }
    setSaving(false);
  };

  // Send the pre-set invite email to one added client. The server owns the
  // content, the discount code, the rate limit and the ownership check — the
  // browser only names which referral row to send to.
  const handleSendInvite = async (row) => {
    if (!codeReady) { setSuccess(''); setAddError(t('referrals.codePending')); return; }
    setSendingId(row.id);
    setAddError('');
    try {
      await apiPost('/api/referrals', { action: 'send-client-invite', referralId: row.id });
      setInvitedIds(prev => new Set(prev).add(row.id));
      setSuccess(`${t('referrals.inviteSent')}: ${row.referred_email}`);
    } catch (err) {
      setAddError(err.message || t('referrals.inviteFailed'));
    } finally {
      setSendingId(null);
    }
  };

  const handleSaveSignature = async () => {
    setSignatureSaving(true);
    setAddError('');
    try {
      // Routed through the service role, NOT a direct profiles update: a
      // browser-side profiles.update() is a column-level escalation path (RLS
      // is row-level only, so the same policy that lets you write your
      // signature would let you write your own role). The server action touches
      // only email_signature.
      await apiPost('/api/referrals', { action: 'save-signature', signature });
      setSuccess(t('referrals.signatureSaved'));
      setShowSignature(false);
    } catch (err) {
      setAddError(err.message);
    } finally {
      setSignatureSaving(false);
    }
  };

  // Stats
  const totalReferred = referrals.length;
  const signedUp = referrals.filter(r => r.status === 'signed_up' || r.status === 'converted').length;
  const converted = referrals.filter(r => r.status === 'converted').length;
  const totalEarnings = referrals.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);

  // Rolling-12-month conversion count — tier evaluation window
  const twelveMonthsAgo = new Date();
  twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
  const convertedLast12mo = referrals.filter(r =>
    r.status === 'converted' && r.converted_at && new Date(r.converted_at) >= twelveMonthsAgo
  ).length;

  // Pick the current tier based on conversions within the 12-month window
  const currentTier = (() => {
    const sorted = [...tiers].sort((a, b) => a.min_conversions - b.min_conversions);
    const next = convertedLast12mo + 1;
    for (const tier of sorted) {
      const max = tier.max_conversions ?? Infinity;
      if (next >= tier.min_conversions && next < max) return tier;
    }
    return sorted[sorted.length - 1] || null;
  })();

  const columns = [
    {
      key: 'referred_name',
      label: t('referrals.referredName'),
      render: (val) => val || '—',
    },
    {
      key: 'referred_email',
      label: t('referrals.referredEmail'),
      render: (val) => val || '—',
    },
    {
      key: 'referred_company',
      label: t('referrals.referredCompany'),
      render: (val) => val || '—',
    },
    {
      key: 'status',
      label: t('dashboard.status'),
      render: (val) => (
        <StatusBadge
          status={val}
          label={val === 'converted' ? t('settings.converted') : val === 'signed_up' ? t('referrals.signedUp') : t('admin.pending')}
        />
      ),
    },
    {
      key: 'payment_amount',
      label: t('settings.saleAmount'),
      render: (val) => val ? `$${parseFloat(val).toFixed(2)}` : '—',
    },
    {
      key: 'commission_amount',
      label: t('referrals.yourCommission'),
      render: (val) => val && parseFloat(val) > 0 ? `$${parseFloat(val).toFixed(2)}` : '—',
    },
    {
      key: 'payout_status',
      label: t('referrals.payout'),
      render: (val, row) => row.status === 'converted' ? (
        <StatusBadge status={val || 'pending'} label={val === 'paid' ? t('settings.paid') : t('common.processing')} />
      ) : '—',
    },
    {
      key: 'created_at',
      label: t('dashboard.date'),
      render: (val) => val ? new Date(val).toLocaleDateString() : '—',
    },
    {
      key: 'invite',
      label: t('referrals.invite'),
      render: (_val, row) => {
        // Once a client has paid there is nothing to invite — show their state.
        if (row.status === 'converted') return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
        const already = invitedIds.has(row.id);
        return (
          <Button
            size="sm"
            variant={already ? 'outline' : 'primary'}
            loading={sendingId === row.id}
            disabled={sendingId === row.id || !row.referred_email}
            onClick={() => handleSendInvite(row)}
          >
            {already ? <><Check size={15} /> {t('referrals.inviteResend')}</> : <><Mail size={15} /> {t('referrals.sendInvite')}</>}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('referrals.title')}</h1>
          <p className="page-subtitle">{t('referrals.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button variant="outline" size="md" onClick={() => { setSignature(user?.email_signature || ''); setShowSignature(true); }}>
            <PenLine size={18} /> {t('referrals.editSignature')}
          </Button>
          <Button variant="primary" size="md" onClick={openAdd}>
            <Plus size={18} /> {t('referrals.addReferral')}
          </Button>
        </div>
      </div>

      {success && (
        <div className="admin-users__success">
          <CheckCircle size={16} />
          <span>{success}</span>
        </div>
      )}

      {/* Stats */}
      <div className="referral-stats">
        <StatCard title={t('referrals.totalReferrals')} value={totalReferred} icon={Users} iconColor="#6366f1" />
        <StatCard title={t('referrals.signedUp')} value={signedUp} icon={UserPlus} iconColor="#2563eb" />
        <StatCard title={t('referrals.convertedPaid')} value={converted} icon={Gift} iconColor="#10b981" />
        <StatCard title={t('referrals.totalEarnings')} value={`$${totalEarnings.toFixed(2)}`} icon={DollarSign} iconColor="#f59e0b" />
      </div>

      {/* Discount code — the thing the client asked to be "activated in the
          referral Dashboard to enable them share with their clients". One
          code: the buyer types it for their discount, and it credits us. */}
      <div className="referral-link-card">
        <div className="referral-link-card__title">{t('referrals.yourDiscountCode')}</div>
        {codeReady ? (
          <>
            <div className="referral-code-display">{referralCode}</div>
            <p className="referral-link-card__hint">{t('referrals.discountCodeHint')}</p>

            <div className="referral-link-card__title" style={{ marginTop: '1.25rem' }}>
              {t('referrals.yourReferralLink')}
            </div>
            <div className="referral-link-card__row">
              <input
                className="referral-link-card__input"
                value={referralLink}
                readOnly
                onClick={(e) => e.target.select()}
              />
              <button className="referral-link-card__btn" onClick={handleCopy}>
                {copied ? <><Check size={16} /> {t('common.copied')}</> : <><Copy size={16} /> {t('referrals.copyLink')}</>}
              </button>
            </div>
            <p className="referral-link-card__hint">{t('referrals.shareLinkHint')}</p>
          </>
        ) : (
          <p className="referral-link-card__hint">{t('referrals.codePending')}</p>
        )}
      </div>

      {/* Commission Tier */}
      {tiers.length > 0 && (
        <div className="referral-section">
          <h3 className="referral-section__title">{t('referrals.commissionTier')}</h3>
          <div style={{
            padding: '16px 20px',
            background: 'linear-gradient(135deg, rgba(62,207,142,0.08), rgba(37,99,235,0.06))',
            border: '1px solid rgba(62,207,142,0.25)',
            borderRadius: 12,
            marginBottom: 16,
          }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)', marginBottom: 4 }}>
              {t('referrals.yourTier', { count: convertedLast12mo })}
            </div>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-accent)' }}>
              {currentTier
                ? `${currentTier.label || `${currentTier.min_conversions}+`} — ${currentTier.commission_percent}%`
                : t('referrals.noTierYet')}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
            {tiers.map(tier => {
              const isCurrent = currentTier?.id === tier.id;
              return (
                <div key={tier.id} style={{
                  padding: 14,
                  border: isCurrent ? '2px solid var(--color-accent)' : '1px solid var(--color-border)',
                  borderRadius: 10,
                  background: isCurrent ? 'var(--color-bg-page)' : 'transparent',
                }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {tier.label || `${tier.min_conversions}+ ${t('referrals.certs')}`}
                  </div>
                  <div style={{ fontSize: '1.5rem', fontWeight: 700, marginTop: 4 }}>
                    {tier.commission_percent}%
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {tier.max_conversions == null
                      ? `${tier.min_conversions}+ ${t('referrals.certsIn12mo')}`
                      : `${tier.min_conversions}–${tier.max_conversions} ${t('referrals.certsIn12mo')}`}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* How It Works */}
      <div className="referral-section">
        <h3 className="referral-section__title">{t('referrals.howItWorks')}</h3>
        <div className="referral-how-it-works">
          <div className="referral-how-step">
            <div className="referral-how-step__num">1</div>
            <div className="referral-how-step__title">{t('referrals.step1Title')}</div>
            <div className="referral-how-step__desc">{t('referrals.step1Desc')}</div>
          </div>
          <div className="referral-how-step">
            <div className="referral-how-step__num">2</div>
            <div className="referral-how-step__title">{t('referrals.step2Title')}</div>
            <div className="referral-how-step__desc">{t('referrals.step2Desc')}</div>
          </div>
          <div className="referral-how-step">
            <div className="referral-how-step__num">3</div>
            <div className="referral-how-step__title">{t('referrals.step3Title')}</div>
            <div className="referral-how-step__desc">{t('referrals.step3Desc')}</div>
          </div>
          <div className="referral-how-step">
            <div className="referral-how-step__num">4</div>
            <div className="referral-how-step__title">{t('referrals.step4Title')}</div>
            <div className="referral-how-step__desc">{t('referrals.step4Desc')}</div>
          </div>
        </div>
      </div>

      {/* Referrals Table */}
      <div className="referral-section">
        <h3 className="referral-section__title">{t('referrals.yourReferrals')}</h3>
        {loading ? (
          <p style={{ color: 'var(--color-text-secondary)' }}>{t('referrals.loadingReferrals')}</p>
        ) : referrals.length === 0 ? (
          <div className="referral-empty">
            <div className="referral-empty__icon"><Link2 size={40} /></div>
            <p>{t('referrals.noReferrals')}</p>
          </div>
        ) : (
          <DataTable columns={columns} data={referrals} emptyMessage={t('referrals.noReferralsShort')} />
        )}
      </div>

      {/* Add Referral Modal */}
      <Modal isOpen={showAdd} onClose={() => setShowAdd(false)} title={t('referrals.addReferral')}>
        <form onSubmit={handleAddReferral} className="admin-users__form">
          {addError && (
            <div className="auth-form__error">
              <AlertCircle size={16} />
              <span>{addError}</span>
            </div>
          )}
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.85rem', marginTop: 0 }}>
            {t('referrals.addReferralHint')}
          </p>
          <Input
            label={t('referrals.referredName')}
            id="ref-name"
            name="referred_name"
            value={addForm.referred_name}
            onChange={(e) => setAddForm(p => ({ ...p, referred_name: e.target.value }))}
            required
          />
          <Input
            label={t('referrals.referredEmail')}
            type="email"
            id="ref-email"
            name="referred_email"
            value={addForm.referred_email}
            onChange={(e) => setAddForm(p => ({ ...p, referred_email: e.target.value }))}
            required
          />
          <Input
            label={t('referrals.referredCompany')}
            id="ref-company"
            name="referred_company"
            value={addForm.referred_company}
            onChange={(e) => setAddForm(p => ({ ...p, referred_company: e.target.value }))}
          />
          <Input
            label={t('referrals.referredWhatsapp')}
            id="ref-whatsapp"
            name="referred_whatsapp"
            type="tel"
            placeholder={t('referrals.referredWhatsappPlaceholder')}
            value={addForm.referred_whatsapp}
            onChange={(e) => setAddForm(p => ({ ...p, referred_whatsapp: e.target.value }))}
          />
          <Input
            label={t('referrals.referredWebsite')}
            id="ref-website"
            name="referred_website"
            type="url"
            placeholder={t('referrals.referredWebsitePlaceholder')}
            value={addForm.referred_website}
            onChange={(e) => setAddForm(p => ({ ...p, referred_website: e.target.value }))}
          />
          <div className="admin-users__form-actions">
            <Button type="button" variant="ghost" size="md" onClick={() => setShowAdd(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={saving}>
              {t('referrals.addReferral')}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Email signature editor — appended to every client invite this partner
          sends. Saved once on the profile, reused on every send. */}
      <Modal isOpen={showSignature} onClose={() => setShowSignature(false)} title={t('referrals.editSignature')}>
        <p className="referral-link-card__hint" style={{ marginTop: 0 }}>
          {t('referrals.signatureHint')}
        </p>
        <textarea
          className="referral-signature-input"
          rows={5}
          value={signature}
          onChange={(e) => setSignature(e.target.value)}
          placeholder={t('referrals.signaturePlaceholder')}
          maxLength={600}
        />
        {addError && (
          <div className="admin-users__error" style={{ marginTop: '12px' }}>
            <AlertCircle size={16} /><span>{addError}</span>
          </div>
        )}
        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <Button variant="outline" size="md" onClick={() => setShowSignature(false)}>
            {t('common.cancel')}
          </Button>
          <Button variant="primary" size="md" loading={signatureSaving} onClick={handleSaveSignature}>
            {t('common.save')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
