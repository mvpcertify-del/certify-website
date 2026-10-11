import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Send, AlertCircle, CheckCircle, Sparkles, X } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { Button, Input, Textarea } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import DataTable from '../../components/ui/DataTable';

// Investor email campaigns (phase39, client 10-11 Oct) — bulk-email the
// investors register, with rotating content and per-recipient tracking.
// Tab inside AdminInvestors.jsx, not its own route — see that file.
//
// What the stats columns do NOT and cannot show: whether a delivered email
// landed in spam/junk for a given recipient. No sender-side signal exists for
// that anywhere — bounced/complained are the real, trackable proxy for
// deliverability health. Said plainly in the UI rather than left unexplained.
export default function InvestorCampaigns() {
  const { t } = useTranslation();

  const [campaigns, setCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [showCompose, setShowCompose] = useState(false);
  const [form, setForm] = useState({ campaignId: null, subject: '', body: '' });
  const [saving, setSaving] = useState(false);

  const [sendingId, setSendingId] = useState(null);

  const [detail, setDetail] = useState(null); // { campaign, stats, recipients }
  const [detailLoading, setDetailLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiPost('/api/referrals', { action: 'list-investor-campaigns' });
      setCampaigns(Array.isArray(data?.campaigns) ? data.campaigns : []);
    } catch (err) {
      setError(err.message || t('investorCampaigns.loadFailed'));
    }
    setLoading(false);
  }, [t]);

  // Fetch-on-mount, same pattern as every other admin list page in this repo
  // (e.g. AdminReferralPartners.jsx) — load() itself is the thing that calls
  // setState, not this effect body directly.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  const openCompose = (campaign = null) => {
    setError('');
    setForm(campaign
      ? { campaignId: campaign.id, subject: campaign.subject, body: campaign.body }
      : { campaignId: null, subject: '', body: '' });
    setShowCompose(true);
  };

  const saveDraft = async (e) => {
    e.preventDefault();
    setError('');
    if (!form.subject.trim() || !form.body.trim()) {
      setError(t('investorCampaigns.fillRequired'));
      return;
    }
    setSaving(true);
    try {
      await apiPost('/api/referrals', {
        action: 'save-investor-campaign',
        campaignId: form.campaignId || undefined,
        subject: form.subject.trim(),
        body: form.body.trim(),
      });
      setShowCompose(false);
      setNotice(t('investorCampaigns.draftSaved'));
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSaving(false);
  };

  const sendCampaign = async (campaign) => {
    if (!window.confirm(t('investorCampaigns.confirmSend', { subject: campaign.subject }))) return;
    setSendingId(campaign.id);
    setError('');
    try {
      const result = await apiPost('/api/referrals', {
        action: 'send-investor-campaign',
        campaignId: campaign.id,
      });
      setNotice(t('investorCampaigns.sendResult', { sent: result.sent, attempted: result.attempted }));
      await load();
    } catch (err) {
      setError(err.message);
    }
    setSendingId(null);
  };

  const openDetail = async (campaign) => {
    setDetail({ campaign, stats: null, recipients: [] });
    setDetailLoading(true);
    try {
      const data = await apiPost('/api/referrals', { action: 'get-investor-campaign', campaignId: campaign.id });
      setDetail(data);
    } catch (err) {
      setError(err.message);
      setDetail(null);
    }
    setDetailLoading(false);
  };

  const formatDate = (v) => v ? new Date(v).toLocaleString() : '—';

  const columns = [
    {
      key: 'subject',
      label: t('investorCampaigns.colSubject'),
      render: (v, row) => (
        <div style={{ display: 'grid', gap: 2 }}>
          <strong>{v}</strong>
          {row.ai_generated && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.75rem', color: 'var(--color-accent)' }}>
              <Sparkles size={12} /> {t('investorCampaigns.aiDrafted')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'sent_at',
      label: t('investorCampaigns.colStatus'),
      render: (v) => v
        ? <span style={{ color: '#0ea5e9', fontWeight: 600 }}>{t('investorCampaigns.statusSent')}</span>
        : <span style={{ color: 'var(--color-text-secondary)' }}>{t('investorCampaigns.statusDraft')}</span>,
    },
    {
      key: 'stats',
      label: t('investorCampaigns.colStats'),
      render: (v, row) => row.sent_at ? (
        <span style={{ fontSize: '0.82rem', color: 'var(--color-text-secondary)' }}>
          {t('investorCampaigns.statsLine', {
            sent: v.sent, delivered: v.delivered, opened: v.opened, clicked: v.clicked,
            bounced: v.bounced, complained: v.complained, replied: v.replied,
          })}
        </span>
      ) : <Plain />,
    },
    { key: 'created_at', label: t('investorCampaigns.colCreated'), render: formatDate },
    {
      key: 'actions',
      label: t('dashboard.action'),
      render: (_, row) => (
        <div style={{ display: 'flex', gap: 6 }}>
          <Button variant="ghost" size="sm" onClick={() => row.sent_at ? openDetail(row) : openCompose(row)}>
            {row.sent_at ? t('common.view') : t('common.edit')}
          </Button>
          {!row.sent_at && (
            <Button variant="primary" size="sm" loading={sendingId === row.id} onClick={() => sendCampaign(row)}>
              <Send size={14} /> {t('investorCampaigns.send')}
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBlockEnd: 'var(--spacing-lg)' }}>
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', maxWidth: '62ch', fontSize: '0.9rem' }}>
          {t('investorCampaigns.pageDesc')}
        </p>
        <Button variant="primary" size="md" onClick={() => openCompose()}>
          <Plus size={16} /> {t('investorCampaigns.newCampaign')}
        </Button>
      </div>

      {(error || notice) && (
        <div style={{
          padding: '10px 12px', borderRadius: 6, fontSize: '0.85rem', marginBlockEnd: 'var(--spacing-md)',
          background: error ? 'rgba(239,68,68,0.08)' : 'rgba(16,185,129,0.10)',
          border: `1px solid ${error ? 'rgba(239,68,68,0.3)' : 'rgba(16,185,129,0.3)'}`,
          color: error ? '#ef4444' : '#047857',
        }}>
          {error || notice}
        </div>
      )}

      {loading ? (
        <p>{t('investorCampaigns.loading')}</p>
      ) : (
        <DataTable columns={columns} data={campaigns} emptyMessage={t('investorCampaigns.empty')} />
      )}

      <div style={{
        marginBlockStart: 'var(--spacing-lg)', padding: '12px 14px', borderRadius: 8,
        background: 'var(--color-surface-alt, rgba(148,163,184,0.08))', fontSize: '0.8rem', color: 'var(--color-text-secondary)',
      }}>
        {t('investorCampaigns.spamDisclaimer')}
      </div>

      {/* Compose / edit draft */}
      <Modal isOpen={showCompose} onClose={() => setShowCompose(false)} title={form.campaignId ? t('investorCampaigns.editTitle') : t('investorCampaigns.newCampaign')} size="lg">
        <form onSubmit={saveDraft} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {error && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 6, fontSize: '0.85rem', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444' }}>
              <AlertCircle size={16} /><span>{error}</span>
            </div>
          )}
          <Input
            label={`${t('investorCampaigns.subject')} *`}
            id="campaign-subject"
            value={form.subject}
            onChange={(e) => setForm((p) => ({ ...p, subject: e.target.value }))}
            required
          />
          <Textarea
            label={`${t('investorCampaigns.body')} *`}
            rows={10}
            id="campaign-body"
            value={form.body}
            onChange={(e) => setForm((p) => ({ ...p, body: e.target.value }))}
            placeholder={t('investorCampaigns.bodyPlaceholder')}
            required
          />
          <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--color-text-secondary)' }}>
            {t('investorCampaigns.bodyHint')}
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginBlockStart: 8 }}>
            <Button type="button" variant="ghost" onClick={() => setShowCompose(false)}>{t('common.cancel')}</Button>
            <Button type="submit" variant="primary" loading={saving}>{t('investorCampaigns.saveDraft')}</Button>
          </div>
        </form>
      </Modal>

      {/* Sent-campaign detail: per-recipient breakdown */}
      <Modal isOpen={!!detail} onClose={() => setDetail(null)} title={detail?.campaign?.subject || ''} size="lg">
        {detailLoading ? (
          <p>{t('investorCampaigns.loading')}</p>
        ) : detail ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--color-text-secondary)' }}>
              {t('investorCampaigns.statsLine', {
                sent: detail.stats.sent, delivered: detail.stats.delivered, opened: detail.stats.opened,
                clicked: detail.stats.clicked, bounced: detail.stats.bounced, complained: detail.stats.complained,
                replied: detail.stats.replied,
              })}
            </div>
            <div style={{ maxHeight: 360, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--color-border)' }}>
                    <th style={{ padding: 8 }}>{t('investorCampaigns.colFund')}</th>
                    <th style={{ padding: 8 }}>{t('investorCampaigns.colEmail')}</th>
                    <th style={{ padding: 8 }}>{t('investorCampaigns.colRecipientStatus')}</th>
                    <th style={{ padding: 8 }}>{t('investorCampaigns.colReplied')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.recipients.map((r) => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td style={{ padding: 8 }}>{r.fund_name || '—'}</td>
                      <td style={{ padding: 8 }}>{r.email}</td>
                      <td style={{ padding: 8, textTransform: 'capitalize' }}>{t(`investorCampaigns.recipientStatus.${r.status}`, r.status)}</td>
                      <td style={{ padding: 8 }}>{r.replied_at ? <CheckCircle size={14} color="#0ea5e9" /> : <X size={14} color="var(--color-text-secondary)" />}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

function Plain() {
  return <span style={{ color: 'var(--color-text-secondary)' }}>—</span>;
}
