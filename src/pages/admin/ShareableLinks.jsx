import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { STAKEHOLDER_TYPES, getStakeholderCopy, getStakeholderRoleLabel } from '../../utils/stakeholderTypes';
import { ISO_CATALOG_LIST } from '../../utils/isoCatalog';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../lib/apiClient';
import { Input } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import {
  Link2, Copy, Check, MessageCircle, Mail, ExternalLink,
  Award, Briefcase, Gift, Building2, UserCheck, TrendingUp,
  Globe2, Shield, Lock, Apple, GraduationCap, Zap, Scale, Activity, Stethoscope,
  ShieldCheck, BrainCircuit,
  ToggleLeft, ToggleRight, Send, AlertCircle,
} from 'lucide-react';
import './ShareableLinks.css';

const ICON_MAP = {
  Award, Briefcase, Gift, Building2, UserCheck, TrendingUp,
  Globe2, Shield, Lock, Apple, GraduationCap, Zap, Scale, Activity, Stethoscope,
  ShieldCheck, BrainCircuit,
};

export default function ShareableLinks() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [copiedId, setCopiedId] = useState(null);
  const baseUrl = window.location.origin;

  // Send-by-email, in place (client, 17 Sep: too many separate "Invite" pages
  // was confusing — one page, one Email button per card, is the whole flow).
  // Sends through the platform (POST /api/referrals { action: 'invite-partner' })
  // from support@certify.cx — no mailbox, no local mail client involved.
  const [emailModalType, setEmailModalType] = useState(null);
  const [emailValue, setEmailValue] = useState('');
  const [emailNote, setEmailNote] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState('');
  const [sentNotice, setSentNotice] = useState('');

  // Activation state for each ISO slug. Default: every ISO is active until a
  // row in `iso_link_settings` says otherwise.
  const [isoActive, setIsoActive] = useState({});
  const [savingSlug, setSavingSlug] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase.from('iso_link_settings').select('slug, is_active');
      if (cancelled) return;
      const map = {};
      ISO_CATALOG_LIST.forEach(iso => { map[iso.slug] = true; });
      (data || []).forEach(row => { map[row.slug] = !!row.is_active; });
      setIsoActive(map);
    })();
    return () => { cancelled = true; };
  }, []);

  const types = Object.values(STAKEHOLDER_TYPES);

  const getStakeholderLink = (type) => `${baseUrl}/register/${type.id}`;
  const getIsoLink = (iso) => `${baseUrl}/iso/${iso.slug}`;

  const copyLink = async (link, id) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = link;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleCopyStakeholder = (type) => copyLink(getStakeholderLink(type), `s-${type.id}`);
  const handleCopyIso = (iso) => copyLink(getIsoLink(iso), `i-${iso.slug}`);

  const handleWhatsApp = (type) => {
    const link = getStakeholderLink(type);
    const copy = getStakeholderCopy(type, t);
    // `article` only means anything in English ("a" vs "an Investor"); the
    // other locales ignore the placeholder in their own phrasing.
    const article = type.id === 'investor' ? 'an' : 'a';
    const text = `${t('admin.joinCertifyCXMsg', { article, type: copy.singularTitle })}\n\n${copy.description}\n\n${t('admin.registerHere')} ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const openEmailModal = (type) => {
    setEmailValue('');
    setEmailNote('');
    setSendError('');
    setEmailModalType(type);
  };

  const submitEmailInvite = async (e) => {
    e.preventDefault();
    setSendError('');
    if (!emailValue.trim()) {
      setSendError(t('inviteStakeholder.emailRequired'));
      return;
    }
    setSending(true);
    try {
      await apiPost('/api/referrals', {
        action: 'invite-partner',
        stakeholderType: emailModalType.id,
        email: emailValue.trim(),
        note: emailNote.trim() || undefined,
      });
      setSentNotice(t('inviteStakeholder.sent', { email: emailValue.trim() }));
      setEmailModalType(null);
    } catch (err) {
      setSendError(err.message);
    }
    setSending(false);
  };

  const handlePreview = (link) => {
    window.open(link, '_blank');
  };

  const handleIsoWhatsApp = (iso) => {
    const link = getIsoLink(iso);
    const text = `${t('iso.joinISOMsg', { code: iso.code })}\n\n${t(iso.descKey)}\n\n${t('admin.registerHere')} ${link}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleIsoEmail = (iso) => {
    const link = getIsoLink(iso);
    const subject = `${t('iso.invitationSubject')} ${iso.code}`;
    const body = `${t('admin.hello')}\n\n${t('iso.invitationBody', { code: iso.code })}\n\n${t(iso.descKey)}\n\n${t('admin.learnMore')}\n${link}\n\n${t('admin.bestRegards')}\n${t('admin.certifyCXTeam')}`;
    window.open(`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
  };

  const toggleIsoActive = async (iso) => {
    const next = !isoActive[iso.slug];
    setSavingSlug(iso.slug);
    setIsoActive(prev => ({ ...prev, [iso.slug]: next }));
    const { error } = await supabase
      .from('iso_link_settings')
      .upsert({
        slug: iso.slug,
        is_active: next,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'slug' });
    if (error) {
      console.error('Failed to toggle ISO link:', error);
      // Revert on failure
      setIsoActive(prev => ({ ...prev, [iso.slug]: !next }));
    }
    setSavingSlug(null);
  };

  return (
    <div className="share-links">
      <div className="share-links__header">
        <div>
          <h1 className="share-links__title">{t('admin.shareableLinks')}</h1>
          <p className="share-links__subtitle">
            {t('admin.shareableLinksDesc')}
          </p>
        </div>
      </div>

      {sentNotice && (
        <div
          role="status"
          style={{
            marginBlockEnd: 'var(--spacing-md)',
            padding: '10px 14px',
            borderRadius: 8,
            fontSize: '0.88rem',
            background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#047857',
          }}
        >
          {sentNotice}
        </div>
      )}

      {/* ---- Stakeholder Links ---- */}
      <div className="share-links__grid">
        {types.map((type) => {
          const IconComponent = ICON_MAP[type.icon] || Building2;
          const cardId = `s-${type.id}`;
          const isCopied = copiedId === cardId;
          const link = getStakeholderLink(type);
          // Translated card copy. This used to be English literals in
          // src/utils/stakeholderTypes.js, so an Arabic viewer got an Arabic
          // shell wrapped around English cards (client, 1 Sep).
          const copy = getStakeholderCopy(type, t);

          return (
            <div key={type.id} className="share-links__card">
              <div className="share-links__card-header">
                <div className="share-links__card-icon" style={{ background: `${type.color}18`, color: type.color }}>
                  <IconComponent size={22} />
                </div>
                <div>
                  <h3 className="share-links__card-title">{copy.title}</h3>
                  <span className="share-links__card-role">
                    {t('admin.roleLabel', { role: getStakeholderRoleLabel(type, t) })}
                  </span>
                </div>
              </div>

              <p className="share-links__card-desc">{copy.description}</p>

              <div className="share-links__card-link">
                <Link2 size={14} />
                <span className="share-links__card-url">{link}</span>
              </div>

              <div className="share-links__card-actions">
                <button
                  className={`share-links__action-btn ${isCopied ? 'share-links__action-btn--copied' : ''}`}
                  onClick={() => handleCopyStakeholder(type)}
                  title={t('common.copy')}
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  {isCopied ? t('common.copied') : t('common.copy')}
                </button>
                <button
                  className="share-links__action-btn share-links__action-btn--whatsapp"
                  onClick={() => handleWhatsApp(type)}
                  title={t('admin.whatsApp')}
                >
                  <MessageCircle size={16} />
                  {t('admin.whatsApp')}
                </button>
                <button
                  className="share-links__action-btn share-links__action-btn--email"
                  onClick={() => openEmailModal(type)}
                  title={t('inviteStakeholder.button', { type: copy.singularTitle })}
                >
                  <Mail size={16} />
                  {t('auth.email')}
                </button>
                <button
                  className="share-links__action-btn share-links__action-btn--preview"
                  onClick={() => handlePreview(link)}
                  title={t('admin.preview')}
                >
                  <ExternalLink size={16} />
                  {t('admin.preview')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ---- ISO Certifications Section ---- */}
      <div className="share-links__section-header">
        <h2 className="share-links__section-title">{t('iso.shareableSectionTitle')}</h2>
        <p className="share-links__section-desc">{t('iso.shareableSectionDesc')}</p>
      </div>

      <div className="share-links__grid">
        {ISO_CATALOG_LIST.map((iso) => {
          const IconComponent = ICON_MAP[iso.icon] || Award;
          const cardId = `i-${iso.slug}`;
          const isCopied = copiedId === cardId;
          const link = getIsoLink(iso);
          const active = isoActive[iso.slug] !== false;
          const saving = savingSlug === iso.slug;

          return (
            <div
              key={iso.slug}
              className={`share-links__card ${active ? '' : 'share-links__card--inactive'}`}
            >
              <div className="share-links__card-header">
                <div className="share-links__card-icon" style={{ background: `${iso.color}18`, color: iso.color }}>
                  <IconComponent size={22} />
                </div>
                <div className="share-links__card-header-text">
                  <h3 className="share-links__card-title">{iso.code}</h3>
                  <span className="share-links__card-role">{t(iso.titleKey)}</span>
                </div>
                <button
                  type="button"
                  className={`share-links__toggle ${active ? 'share-links__toggle--on' : 'share-links__toggle--off'}`}
                  onClick={() => toggleIsoActive(iso)}
                  disabled={saving}
                  title={active ? t('iso.deactivate') : t('iso.activate')}
                >
                  {active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                  <span>{active ? t('iso.active') : t('iso.inactive')}</span>
                </button>
              </div>

              <p className="share-links__card-desc">{t(iso.descKey)}</p>

              <div className="share-links__card-link">
                <Link2 size={14} />
                <span className="share-links__card-url">{link}</span>
              </div>

              <div className="share-links__card-actions">
                <button
                  className={`share-links__action-btn ${isCopied ? 'share-links__action-btn--copied' : ''}`}
                  onClick={() => handleCopyIso(iso)}
                  title={t('common.copy')}
                  disabled={!active}
                >
                  {isCopied ? <Check size={16} /> : <Copy size={16} />}
                  {isCopied ? t('common.copied') : t('common.copy')}
                </button>
                <button
                  className="share-links__action-btn share-links__action-btn--whatsapp"
                  onClick={() => handleIsoWhatsApp(iso)}
                  title={t('admin.whatsApp')}
                  disabled={!active}
                >
                  <MessageCircle size={16} />
                  {t('admin.whatsApp')}
                </button>
                <button
                  className="share-links__action-btn share-links__action-btn--email"
                  onClick={() => handleIsoEmail(iso)}
                  title={t('auth.email')}
                  disabled={!active}
                >
                  <Mail size={16} />
                  {t('auth.email')}
                </button>
                <button
                  className="share-links__action-btn share-links__action-btn--preview"
                  onClick={() => handlePreview(link)}
                  title={t('admin.preview')}
                >
                  <ExternalLink size={16} />
                  {t('admin.preview')}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        isOpen={!!emailModalType}
        onClose={() => setEmailModalType(null)}
        title={emailModalType ? t('inviteStakeholder.title', { type: getStakeholderCopy(emailModalType, t).singularTitle }) : ''}
      >
        <form onSubmit={submitEmailInvite} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>
            {t('inviteStakeholder.desc')}
          </p>
          {sendError && (
            <div
              style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem',
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444',
              }}
            >
              <AlertCircle size={16} /><span>{sendError}</span>
            </div>
          )}
          <Input
            label={`${t('auth.email')} *`}
            type="email"
            id="shareable-invite-email"
            name="email"
            value={emailValue}
            onChange={(e) => setEmailValue(e.target.value)}
            required
            autoFocus
          />
          <Input
            label={t('inviteStakeholder.noteLabel')}
            id="shareable-invite-note"
            name="note"
            value={emailNote}
            onChange={(e) => setEmailNote(e.target.value)}
            placeholder={t('inviteStakeholder.notePlaceholder')}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBlockStart: 8 }}>
            <button
              type="button"
              className="share-links__action-btn"
              onClick={() => setEmailModalType(null)}
            >
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              className="share-links__action-btn share-links__action-btn--email"
              disabled={sending}
            >
              <Send size={16} />
              {sending ? t('common.loading') : t('inviteStakeholder.send')}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
