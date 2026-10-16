import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { Button, Input } from '../ui/FormElements';
import '../../pages/admin/AdminConsultancies.css';

// The partner contract template editor, extracted from AdminConsultancies.jsx
// (16 Oct) so a second partner_type — Referral/Affiliate — can publish its own
// agreement too. Until this existed, api/user.js's get/save-contract-template
// actions already accepted a `partnerType` body field, but nothing in the UI
// ever sent one, so every call silently defaulted to 'consultancy' — there
// was no way to see or edit the Referral contract at all.
//
// Super admin only; saving publishes a NEW version rather than editing a
// signed one in place (api/_contract.js saveTemplate).
//
// `{{commission_percent}}` in the body is replaced, per signer, with their
// actual resolved commission rate (their agreed override, or the role's flat
// default) when the contract is shown or signed — see withCommissionToken in
// api/_contract.js. Use it instead of typing a fixed number so a partner on a
// negotiated rate (e.g. a 25% "Business Developer" tier, client 16 Oct) reads
// their own number rather than everyone else's.
export default function ContractTemplateEditor({ partnerType }) {
  const { t } = useTranslation();

  const [template, setTemplate] = useState(null);
  const [form, setForm] = useState({ title: '', body: '', termMonths: 12 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  const loadTemplate = useCallback(async () => {
    setLoading(true);
    setError('');
    setNotice('');
    try {
      const data = await apiPost('/api/user', { action: 'get-contract-template', partnerType });
      const tpl = data?.template || null;
      setTemplate(tpl);
      setForm({
        title: tpl?.title || '',
        body: tpl?.body || '',
        termMonths: tpl?.term_months ?? 12,
      });
    } catch (err) {
      const msg = err.message || '';
      if (/no contract has been published/i.test(msg) || /not found/i.test(msg)) {
        setTemplate(null);
        setForm({ title: '', body: '', termMonths: 12 });
        setNotice(t('adminConsultancies.noTemplateYet'));
      } else {
        setError(msg || t('adminConsultancies.templateLoadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [partnerType, t]);

  useEffect(() => { loadTemplate(); }, [loadTemplate]);

  const handleSave = async (e) => {
    e.preventDefault();
    setError('');
    setNotice('');

    const title = form.title.trim();
    const body = form.body.trim();
    const months = Number(form.termMonths);

    if (!title) { setError(t('adminConsultancies.titleRequired')); return; }
    if (!body) { setError(t('adminConsultancies.bodyRequired')); return; }
    if (!Number.isInteger(months) || months < 1 || months > 120) {
      setError(t('adminConsultancies.termInvalid'));
      return;
    }

    setSaving(true);
    try {
      const data = await apiPost('/api/user', {
        action: 'save-contract-template',
        partnerType,
        title,
        body,
        termMonths: months,
      });
      if (data?.template) {
        setTemplate(data.template);
        setForm({
          title: data.template.title || '',
          body: data.template.body || '',
          termMonths: data.template.term_months ?? months,
        });
      }
      setNotice(data?.unchanged
        ? t('adminConsultancies.saveUnchanged')
        : t('adminConsultancies.savePublished', { version: data?.template?.version ?? '' }));
    } catch (err) {
      setError(err.message || t('adminConsultancies.saveFailed'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="adcon__loading">{t('adminConsultancies.loading')}</p>;
  }

  return (
    <section className="adcon__agreement">
      <form onSubmit={handleSave} className="adcon__card">
        <div className="adcon__version-row">
          <div>
            <span className="adcon__version-label">{t('adminConsultancies.currentVersion')}</span>
            <span className="adcon__version-value">
              {template?.version != null ? `v${template.version}` : t('adminConsultancies.versionNone')}
            </span>
          </div>
        </div>

        {notice && <div className="adcon__alert adcon__alert--info">{notice}</div>}
        {error && <div className="adcon__alert adcon__alert--error">{error}</div>}

        <Input
          label={t('adminConsultancies.fieldTitle')}
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder={t('adminConsultancies.fieldTitlePlaceholder')}
          required
        />

        <Input
          label={t('adminConsultancies.fieldTerm')}
          type="number"
          min="1"
          max="120"
          step="1"
          value={form.termMonths}
          onChange={(e) => setForm({ ...form, termMonths: e.target.value })}
          required
        />

        <div className="adcon__field">
          <label className="adcon__field-label" htmlFor={`contract-body-${partnerType}`}>
            {t('adminConsultancies.fieldBody')}
          </label>
          <textarea
            id={`contract-body-${partnerType}`}
            className="adcon__textarea"
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            placeholder={t('adminConsultancies.fieldBodyPlaceholder')}
            spellCheck="false"
            required
          />
          <span className="adcon__field-hint">{t('adminConsultancies.fieldBodyHint')}</span>
          <span className="adcon__field-hint">
            {t('adminConsultancies.commissionTokenHint', { commissionToken: '{{commission_percent}}' })}
          </span>
        </div>

        <div className="adcon__warning">
          <AlertTriangle size={18} className="adcon__warning-icon" />
          <p>{t('adminConsultancies.publishWarning')}</p>
        </div>

        <div className="adcon__form-actions">
          <Button type="submit" variant="primary" loading={saving}>
            {t('adminConsultancies.publishButton')}
          </Button>
        </div>
      </form>
    </section>
  );
}
