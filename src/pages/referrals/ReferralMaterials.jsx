import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { apiPost } from '../../lib/apiClient';
import { Button } from '../../components/ui/FormElements';
import { getIsoBySlug } from '../../utils/isoCatalog';
import { FileText, Download, AlertCircle, Paperclip } from 'lucide-react';
import './Referrals.css';

// "Marketing Material" — one of the six boxes the client asked for on the
// Referral Program Dashboard (6 Sep), and the screen behind this half of the
// same message:
//
//   "they should have in their dashboards Attachments which could be sent
//    attached to the email — For example if they are targeting a School or
//    University: ISO 21001 Email content + PDF attachment"
//
// The library itself already existed (phase32) but was only ever visible to a
// Super Admin. A partner could learn a document existed only by opening the
// proposal composer and picking a standard one at a time. This lists the lot.
//
// Download goes through /api/outreach-assets, which mints a short-lived signed
// URL. The bucket stays private — deliberately, see the header of that file.
const bytesToLabel = (n) => {
  if (!n) return '';
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

export default function ReferralMaterials() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    apiPost('/api/outreach-assets', { action: 'partner-list' })
      .then((r) => { if (mounted) setAssets(r?.assets || []); })
      .catch((err) => { if (mounted) setError(err.message || t('referrals.materialsFailed')); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDownload = async (slug) => {
    setBusySlug(slug);
    setError('');
    try {
      const { url } = await apiPost('/api/outreach-assets', {
        action: 'partner-download',
        standardSlug: slug,
      });
      // Opened rather than fetched-and-blobbed: the signed URL already carries
      // a download disposition and the file never has to pass through this tab.
      window.open(url, '_blank', 'noopener');
    } catch (err) {
      setError(err.message || t('referrals.materialsFailed'));
    } finally {
      setBusySlug('');
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('refDash.materials')}</h1>
          <p className="page-subtitle">{t('refDash.materialsDesc')}</p>
        </div>
      </div>

      {error && (
        <div className="referrals__notice">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <p className="referral-attach-note" style={{ marginBottom: 'var(--spacing-md)' }}>
        <Paperclip size={14} />
        <span>{t('referrals.materialsHint')}</span>
      </p>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</p>
      ) : assets.length === 0 ? (
        <div className="referral-empty">
          <div className="referral-empty__icon"><FileText size={40} /></div>
          {/* Not an error state. The library is filled in by an admin over
              time, so "none yet" is a normal, temporary answer — and saying who
              adds them is more use to a partner than an empty box. */}
          <p>{t('referrals.materialsEmpty')}</p>
        </div>
      ) : (
        <div className="referral-material-grid">
          {assets.map((a) => {
            const iso = getIsoBySlug(a.standard_slug);
            return (
              <div className="referral-material" key={a.standard_slug}>
                <div className="referral-material__icon"><FileText size={22} /></div>
                <div className="referral-material__body">
                  <div className="referral-material__code">
                    {iso?.code || a.standard_slug}
                  </div>
                  {iso?.titleKey && (
                    <div className="referral-material__title">{t(iso.titleKey)}</div>
                  )}
                  <div className="referral-material__meta">
                    {a.file_name}{a.byte_size ? ` · ${bytesToLabel(a.byte_size)}` : ''}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  loading={busySlug === a.standard_slug}
                  onClick={() => handleDownload(a.standard_slug)}
                >
                  <Download size={15} /> {t('common.download')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
