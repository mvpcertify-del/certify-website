import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { apiPost } from '../../lib/apiClient';
import { Button } from '../../components/ui/FormElements';
import { READY_TEMPLATES } from './readyTemplates';
import { getIsoBySlug } from '../../utils/isoCatalog';
import { Mail, Paperclip, Ticket, Send, ShieldCheck } from 'lucide-react';
import './Referrals.css';

// "Ready Email templates" — one of the six boxes the client asked for on the
// Referral Program Dashboard (6 Sep).
//
// The screen shows what each letter is, what it carries, and takes the partner
// to where it is sent. It does NOT show an editable body, and that is the
// client's own instruction rather than a shortcut:
//
//   "Proposals should be centrally generated and controlled. The Referral
//    Partner should not create proposals manually in Word or PDF."
//
// The letters leave the certify.cx domain under the company's name, so their
// wording stays server-side (api/_emailTemplates.js). What a partner chooses is
// the recipient, the standard, and whether the lead already holds a
// certification — the three facts the letter actually turns on.
export default function ReferralTemplates() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [attachable, setAttachable] = useState([]);

  // Which standards currently have a briefing note, so the proposal card can
  // say what would actually go out rather than promising an attachment in
  // general terms.
  useEffect(() => {
    let mounted = true;
    apiPost('/api/outreach-assets', { action: 'partner-list' })
      .then((r) => { if (mounted) setAttachable(r?.assets || []); })
      .catch(() => { /* the cards still stand up without this */ });
    return () => { mounted = false; };
  }, []);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('refDash.templates')}</h1>
          <p className="page-subtitle">{t('refDash.templatesDesc')}</p>
        </div>
      </div>

      <div className="referral-template-grid">
        {READY_TEMPLATES.map((tpl) => (
          <div className="referral-template" key={tpl.key}>
            <div className="referral-template__head">
              <div className="referral-template__icon"><Mail size={20} /></div>
              <div>
                <h3 className="referral-template__title">{t(`refTemplates.${tpl.key}Title`)}</h3>
                <p className="referral-template__subject">
                  {t('refTemplates.subjectLabel')}: {t(`refTemplates.${tpl.key}Subject`)}
                </p>
              </div>
            </div>

            <p className="referral-template__desc">{t(`refTemplates.${tpl.key}Desc`)}</p>

            <ul className="referral-template__facts">
              {tpl.carriesDiscountCode && (
                <li><Ticket size={14} /> {t('refTemplates.carriesCode')}</li>
              )}
              {tpl.carriesAttachment && (
                <li>
                  <Paperclip size={14} />
                  {attachable.length > 0
                    ? t('refTemplates.carriesDoc', {
                        list: attachable
                          .map(a => getIsoBySlug(a.standard_slug)?.code || a.standard_slug)
                          .join(', '),
                      })
                    : t('refTemplates.carriesDocNone')}
                </li>
              )}
              <li><ShieldCheck size={14} /> {t('refTemplates.centrallyWritten')}</li>
            </ul>

            <Button variant="primary" size="md" onClick={() => navigate(tpl.sendPath)}>
              <Send size={16} /> {t(`refTemplates.${tpl.key}Cta`)}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
