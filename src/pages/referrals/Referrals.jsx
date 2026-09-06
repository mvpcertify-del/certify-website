import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import StatCard from '../../components/ui/StatCard';
import DataTable from '../../components/ui/DataTable';
import StatusBadge from '../../components/ui/StatusBadge';
import Modal from '../../components/ui/Modal';
import { Input, Button } from '../../components/ui/FormElements';
import NameFields from '../../components/ui/NameFields';
import BackButton from '../../components/ui/BackButton';
import { apiPost } from '../../lib/apiClient';
import { ISO_CATALOG_LIST } from '../../utils/isoCatalog';
import { Link2, Check, Users, DollarSign, UserPlus, Gift, Plus, AlertCircle, CheckCircle, Mail, Send, Paperclip } from 'lucide-react';
import './Referrals.css';

export default function Referrals() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [referrals, setReferrals] = useState([]);
  const [loading, setLoading] = useState(true);

  // "Add Referral" modal — referral partner uploads a client they refer.
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ referred_name: '', referred_email: '', referred_company: '', referred_whatsapp: '', referred_website: '' });
  const [saving, setSaving] = useState(false);
  const [addError, setAddError] = useState('');

  // Per-client invite email.
  //
  // The partner-editable email signature that used to live alongside this was
  // removed on the client's instruction (6 Sep) for every role, existing and
  // new. Partner mail now signs off with the partner's own stored name, which
  // is the name the company already holds on the signed agreement — nothing a
  // partner types is placed under the company's domain any more.
  const [sendingId, setSendingId] = useState(null);
  const [invitedIds, setInvitedIds] = useState(() => new Set());

  // ---- The standard proposal letter (phase32) ----
  // A second, different letter from the invite above: it pitches ONE named
  // standard and carries that standard's briefing document as an attachment.
  // Which standards HAVE a document is admin-managed and changes without a
  // deploy, so it is read at runtime rather than assumed.
  const [proposalRow, setProposalRow] = useState(null);
  const [proposalStandard, setProposalStandard] = useState('');
  const [proposalExisting, setProposalExisting] = useState('');
  const [proposalSending, setProposalSending] = useState(false);
  const [proposedIds, setProposedIds] = useState(() => new Set());
  const [assetSlugs, setAssetSlugs] = useState(() => new Set());
  const [success, setSuccess] = useState('');
  // Shown when the client WAS saved but something optional about it was not.
  // Separate from `success` so a partial save never reads as a clean one.
  const [notice, setNotice] = useState('');

  // The partner's real, stored code (phase25 profiles.referral_code). The code
  // itself is shown on /referrals/coupons now; what this screen still needs is
  // the yes/no — every invite and proposal carries the code, so a partner
  // without one must be told that before they press send, not after.
  const codeReady = Boolean(user?.referral_code);

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

  // Which standards have a briefing document to attach. Read directly (the
  // table's RLS grants SELECT to any signed-in user) because this answers a
  // presentational question — it tells the partner what will be attached
  // BEFORE they send. The server does its own lookup at send time and does not
  // trust this; a stale set here changes what the form says, never what goes
  // out.
  useEffect(() => {
    supabase
      .from('outreach_assets')
      .select('standard_slug')
      .then(({ data }) => setAssetSlugs(new Set((data || []).map(a => a.standard_slug))));
  }, []);

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
    setNotice('');
    try {
      // The row the partner actually filled in. Insert is enforced by RLS to
      // referrer_id = auth.uid().
      const row = {
        referrer_id: user.id,
        referred_email: email,
        referred_name: addForm.referred_name.trim(),
        referred_company: addForm.referred_company.trim() || null,
        referred_whatsapp: addForm.referred_whatsapp.trim() || null,
        referred_website: addForm.referred_website.trim() || null,
        status: 'pending',
      };

      const insert = (payload) => supabase
        .from('referrals')
        .insert(payload)
        .select()
        .single();

      let { data, error } = await insert(row);

      // If the database has not yet had phase28 applied, referred_whatsapp /
      // referred_website do not exist and PostgREST rejects the WHOLE row with
      // PGRST204 — so the partner cannot add any client at all, which is what
      // the client reported on 15 Aug. Those two fields are optional contact
      // details; losing the referral over them is far worse than saving it
      // without them, so retry with the core fields and say plainly what was
      // dropped. Once HOTFIX_2026-08-15_referral_columns.sql has been run this
      // branch is dead code.
      const missingOptionalColumn =
        error &&
        (error.code === 'PGRST204' || /schema cache/i.test(error.message || '')) &&
        /referred_whatsapp|referred_website/.test(error.message || '');

      if (missingOptionalColumn) {
        const { referred_whatsapp, referred_website, ...core } = row;
        const retry = await insert(core);
        if (!retry.error && (referred_whatsapp || referred_website)) {
          setNotice(t('referrals.extraFieldsNotSaved'));
        }
        data = retry.data;
        error = retry.error;
      }

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

  // Open the proposal composer for one lead. The standard resets each time
  // rather than remembering the last pick — the previous lead's standard is
  // exactly the wrong default for the next one, and a pre-filled wrong answer
  // is what gets sent by accident.
  const openProposal = (row) => {
    setProposalRow(row);
    setProposalStandard('');
    setProposalExisting('');
    setAddError('');
  };

  const handleSendProposal = async () => {
    if (!proposalRow || !proposalStandard) return;
    if (!codeReady) { setSuccess(''); setAddError(t('referrals.codePending')); return; }
    setProposalSending(true);
    setAddError('');
    try {
      const res = await apiPost('/api/referrals', {
        action: 'send-outreach',
        referralId: proposalRow.id,
        standardSlug: proposalStandard,
        existingCert: proposalExisting.trim() || null,
      });
      setProposedIds(prev => new Set(prev).add(proposalRow.id));
      setSuccess(`${t('referrals.proposalSent')}: ${proposalRow.referred_email}`);
      // The server is the authority on whether a document actually went with
      // it. Saying so matters: the partner is about to tell this lead "see the
      // attached briefing note" on a follow-up call.
      if (!res?.attached) setNotice(t('referrals.proposalNoAttachment'));
      setProposalRow(null);
    } catch (err) {
      setAddError(err.message || t('referrals.proposalFailed'));
    } finally {
      setProposalSending(false);
    }
  };

  // Stats
  const totalReferred = referrals.length;
  const signedUp = referrals.filter(r => r.status === 'signed_up' || r.status === 'converted').length;
  const converted = referrals.filter(r => r.status === 'converted').length;
  const totalEarnings = referrals.reduce((sum, r) => sum + (parseFloat(r.commission_amount) || 0), 0);

  // The tier ladder moved to /referrals/commissions with the money it
  // explains; this screen no longer computes it.

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
    {
      key: 'proposal',
      label: t('referrals.proposal'),
      render: (_val, row) => {
        // A converted client has already bought; pitching them a standard they
        // are mid-certification on reads as a mistake, so the column goes quiet
        // exactly where the invite column does.
        if (row.status === 'converted') return <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>;
        const already = proposedIds.has(row.id);
        return (
          <Button
            size="sm"
            variant="outline"
            disabled={!row.referred_email}
            onClick={() => openProposal(row)}
          >
            {already ? <><Check size={15} /> {t('referrals.proposalResend')}</> : <><Send size={15} /> {t('referrals.sendProposal')}</>}
          </Button>
        );
      },
    },
  ];

  return (
    <div className="page-container">
      {/* Back to the box grid. Falls back to a real link rather than
          history.back() for a partner who arrived here on a bookmark. */}
      <BackButton fallback="/referral-dashboard" />
      <div className="page-header">
        <div>
          {/* Titled "Clients", matching the dashboard box that opens it. The
              old "Referral Program" title now belongs to the dashboard. */}
          <h1 className="page-title">{t('refDash.clients')}</h1>
          <p className="page-subtitle">{t('refDash.clientsDesc')}</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
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

      {/* The client was saved, but not everything about it was. */}
      {notice && (
        <div className="referrals__notice">
          <AlertCircle size={16} />
          <span>{notice}</span>
        </div>
      )}

      {/* Stats */}
      <div className="referral-stats">
        <StatCard title={t('referrals.totalReferrals')} value={totalReferred} icon={Users} iconColor="#6366f1" />
        <StatCard title={t('referrals.signedUp')} value={signedUp} icon={UserPlus} iconColor="#2563eb" />
        <StatCard title={t('referrals.convertedPaid')} value={converted} icon={Gift} iconColor="#10b981" />
        <StatCard title={t('referrals.totalEarnings')} value={`$${totalEarnings.toFixed(2)}`} icon={DollarSign} iconColor="#f59e0b" />
      </div>

      {/* The discount code, the commission tiers and the "how it works"
          steps used to sit here. They moved to their own screens on 6 Sep
          (/referrals/coupons and /referrals/commissions) when the client asked
          for a Referral Program Dashboard whose boxes each open one subject.
          Moved, not copied — one code shown in two places is one place too
          many to keep correct. This screen is now the client list. */}

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
          <NameFields
            idPrefix="ref-name"
            value={addForm.referred_name}
            onChange={(v) => setAddForm(p => ({ ...p, referred_name: v }))}
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

      {/* Standard proposal composer (phase32).
          The partner chooses which standard to pitch and, optionally, names a
          certification the organization already holds — the one fact the
          letter's opening paragraph turns on. Everything else is fixed copy;
          there is no free-text body, on purpose, because this letter goes out
          over the company's own domain under the company's own name. */}
      <Modal
        isOpen={Boolean(proposalRow)}
        onClose={() => setProposalRow(null)}
        title={t('referrals.sendProposal')}
      >
        <p className="referral-link-card__hint" style={{ marginTop: 0 }}>
          {t('referrals.proposalHint', {
            name: proposalRow?.referred_company || proposalRow?.referred_name || '',
            email: proposalRow?.referred_email || '',
          })}
        </p>

        <label className="referral-field-label" htmlFor="proposal-standard">
          {t('referrals.proposalStandard')}
        </label>
        <select
          id="proposal-standard"
          className="referral-select"
          value={proposalStandard}
          onChange={(e) => setProposalStandard(e.target.value)}
        >
          <option value="">{t('referrals.proposalStandardPlaceholder')}</option>
          {ISO_CATALOG_LIST.map((iso) => (
            <option key={iso.slug} value={iso.slug}>
              {iso.code} — {t(iso.titleKey)}
            </option>
          ))}
        </select>

        {/* Tell the partner what will actually be attached BEFORE they send,
            not after. A standard with no uploaded briefing note still sends —
            the letter simply does not mention an attachment. */}
        {proposalStandard && (
          <p className="referral-attach-note">
            <Paperclip size={14} />
            <span>
              {assetSlugs.has(proposalStandard)
                ? t('referrals.proposalWillAttach')
                : t('referrals.proposalNoDoc')}
            </span>
          </p>
        )}

        <Input
          label={t('referrals.proposalExisting')}
          id="proposal-existing"
          name="proposal_existing"
          placeholder={t('referrals.proposalExistingPlaceholder')}
          value={proposalExisting}
          onChange={(e) => setProposalExisting(e.target.value)}
          maxLength={60}
        />
        <p className="referral-link-card__hint" style={{ marginTop: '-6px' }}>
          {t('referrals.proposalExistingHint')}
        </p>

        {addError && (
          <div className="admin-users__error" style={{ marginTop: '12px' }}>
            <AlertCircle size={16} /><span>{addError}</span>
          </div>
        )}

        <div className="modal-actions" style={{ marginTop: '16px' }}>
          <Button variant="outline" size="md" onClick={() => setProposalRow(null)}>
            {t('common.cancel')}
          </Button>
          <Button
            variant="primary"
            size="md"
            loading={proposalSending}
            disabled={!proposalStandard || proposalSending}
            onClick={handleSendProposal}
          >
            <Send size={16} /> {t('referrals.proposalSend')}
          </Button>
        </div>
      </Modal>
    </div>
  );
}
