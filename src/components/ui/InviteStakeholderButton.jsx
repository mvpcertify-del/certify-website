import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { UserPlus, AlertCircle } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { Button, Input } from './FormElements';
import NameFields from './NameFields';
import Modal from './Modal';
import { STAKEHOLDER_TYPES } from '../../utils/stakeholderTypes';

// Shared "Invite <stakeholder>" trigger + modal, dropped onto each admin list
// page (Clients, Auditors, CB, Consultancy, Investors) so a Super Admin can
// email a prospect the registration link without ever touching a mailbox.
//
// Client, 16-17 Sep: approved this for referral partners first (built as a
// one-off on AdminReferralPartners.jsx, its own bespoke copy left untouched
// since the client already tested and approved that exact email), then asked
// for the same thing on all six stakeholder types. This is that same feature,
// generalized and reusable, for the other five.
//
// `type` is one of the STAKEHOLDER_TYPES slugs ('client', 'auditor',
// 'certification-body', 'consultancy', 'investor'; 'referral' also works here
// but AdminReferralPartners.jsx keeps its own copy rather than switching to
// this, to avoid touching the wording the client already signed off on).
//
// Sends via POST /api/referrals { action: 'invite-partner', stakeholderType }
// — same endpoint, same rate limit, same support@certify.cx business
// identity as the referral one; see api/referrals.js.
export default function InviteStakeholderButton({ type, variant = 'primary', size = 'md' }) {
  const { t } = useTranslation();
  const config = STAKEHOLDER_TYPES[type];
  const label = config ? t(`stakeholder.${config.i18nKey}.singular`) : type;

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: '', name: '', note: '' });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const openModal = () => {
    setForm({ email: '', name: '', note: '' });
    setError('');
    setOpen(true);
  };

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.email.trim()) {
      setError(t('inviteStakeholder.emailRequired'));
      return;
    }
    setSending(true);
    try {
      await apiPost('/api/referrals', {
        action: 'invite-partner',
        stakeholderType: type,
        email: form.email.trim(),
        name: form.name.trim() || undefined,
        note: form.note.trim() || undefined,
      });
      setOpen(false);
      setSuccess(t('inviteStakeholder.sent', { email: form.email.trim() }));
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  return (
    <>
      <Button variant={variant} size={size} onClick={openModal}>
        <UserPlus size={16} /> {t('inviteStakeholder.button', { type: label })}
      </Button>

      {success && (
        <div
          role="status"
          style={{
            marginBlockStart: 8,
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: '0.85rem',
            background: 'rgba(16,185,129,0.10)',
            border: '1px solid rgba(16,185,129,0.3)',
            color: '#047857',
          }}
        >
          {success}
        </div>
      )}

      <Modal isOpen={open} onClose={() => setOpen(false)} title={t('inviteStakeholder.title', { type: label })}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: '0.88rem' }}>
            {t('inviteStakeholder.desc')}
          </p>
          {error && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                borderRadius: 6,
                fontSize: '0.85rem',
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#ef4444',
              }}
            >
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}
          <Input
            label={`${t('auth.email')} *`}
            type="email"
            id={`invite-${type}-email`}
            name="email"
            value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
            required
          />
          <NameFields
            idPrefix={`invite-${type}-name`}
            value={form.name}
            onChange={(v) => setForm((p) => ({ ...p, name: v }))}
          />
          <Input
            label={t('inviteStakeholder.noteLabel')}
            id={`invite-${type}-note`}
            name="note"
            value={form.note}
            onChange={(e) => setForm((p) => ({ ...p, note: e.target.value }))}
            placeholder={t('inviteStakeholder.notePlaceholder')}
          />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBlockStart: 8 }}>
            <Button type="button" variant="ghost" size="md" onClick={() => setOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" variant="primary" size="md" loading={sending}>
              {t('inviteStakeholder.send')}
            </Button>
          </div>
        </form>
      </Modal>
    </>
  );
}
