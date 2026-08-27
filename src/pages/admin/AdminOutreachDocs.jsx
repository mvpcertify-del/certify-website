import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ISO_CATALOG_LIST } from '../../utils/isoCatalog';
import { apiPost } from '../../lib/apiClient';
import { Button } from '../../components/ui/FormElements';
import {
  FileText, Upload, Trash2, AlertCircle, CheckCircle, Paperclip,
} from 'lucide-react';
import './AdminOutreachDocs.css';

// ============================================================================
// Outreach briefing documents — Super Admin (phase32)
// ============================================================================
// The client asked (27 Aug) that a referral partner be able to send a proposal
// letter with a file attached, and supplied one file: a four-page ISO 21001
// briefing note.
//
// This page is the answer to "and what gets attached to the other eleven?".
// One document per standard; a standard with nothing uploaded still sends the
// letter, just without an attachment. That is why this screen shows EVERY
// standard rather than only the ones that have a file — the gaps are the point,
// and a list that hid them would look complete when it is not.
//
// Upload goes through api/outreach-assets.js (Super Admin, service role), not
// straight to storage: the bucket is private and deliberately carries no
// browser-facing policy.
// ============================================================================

// Kept in step with MAX_BYTES in api/outreach-assets.js. Checked here purely so
// an oversized file is refused instantly instead of after a slow upload — the
// server check is the real one.
const MAX_BYTES = 3 * 1024 * 1024;

const formatSize = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export default function AdminOutreachDocs() {
  const { t } = useTranslation();
  const [assets, setAssets] = useState({});
  const [loading, setLoading] = useState(true);
  const [busySlug, setBusySlug] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPost('/api/outreach-assets', { action: 'list' });
      const map = {};
      (res?.assets || []).forEach((a) => { map[a.standard_slug] = a; });
      setAssets(map);
    } catch (err) {
      setError(err.message || t('outreachDocs.loadFailed'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => { load(); }, [load]);

  const handleFile = async (slug, file) => {
    if (!file) return;
    setError('');
    setSuccess('');

    if (file.type !== 'application/pdf') {
      setError(t('outreachDocs.pdfOnly'));
      return;
    }
    if (file.size > MAX_BYTES) {
      setError(t('outreachDocs.tooLarge', { max: MAX_BYTES / (1024 * 1024) }));
      return;
    }

    setBusySlug(slug);
    try {
      // FileReader rather than a manual loop over the byte array: building a
      // base64 string by hand blows the call stack on anything past a few
      // hundred KB (String.fromCharCode.apply on a large array), which is
      // squarely inside the sizes we accept.
      const contentBase64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const result = String(reader.result || '');
          const comma = result.indexOf(',');
          resolve(comma >= 0 ? result.slice(comma + 1) : '');
        };
        reader.onerror = () => reject(new Error(t('outreachDocs.readFailed')));
        reader.readAsDataURL(file);
      });

      const res = await apiPost('/api/outreach-assets', {
        action: 'upload',
        standardSlug: slug,
        fileName: file.name,
        contentBase64,
      });
      setAssets((prev) => ({ ...prev, [slug]: res.asset }));
      setSuccess(t('outreachDocs.uploaded', { name: file.name }));
    } catch (err) {
      setError(err.message || t('outreachDocs.uploadFailed'));
    } finally {
      setBusySlug(null);
    }
  };

  const handleRemove = async (slug) => {
    setError('');
    setSuccess('');
    setBusySlug(slug);
    try {
      await apiPost('/api/outreach-assets', { action: 'delete', standardSlug: slug });
      setAssets((prev) => {
        const next = { ...prev };
        delete next[slug];
        return next;
      });
      setSuccess(t('outreachDocs.removed'));
    } catch (err) {
      setError(err.message || t('outreachDocs.removeFailed'));
    } finally {
      setBusySlug(null);
    }
  };

  const withDoc = ISO_CATALOG_LIST.filter((iso) => assets[iso.slug]).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('outreachDocs.title')}</h1>
          <p className="page-subtitle">{t('outreachDocs.subtitle')}</p>
        </div>
      </div>

      {error && (
        <div className="admin-users__error" style={{ marginBottom: 'var(--spacing-md)' }}>
          <AlertCircle size={16} /><span>{error}</span>
        </div>
      )}
      {success && (
        <div className="outreach-docs__success">
          <CheckCircle size={16} /><span>{success}</span>
        </div>
      )}

      <p className="outreach-docs__count">
        <Paperclip size={15} />
        <span>{t('outreachDocs.count', { have: withDoc, total: ISO_CATALOG_LIST.length })}</span>
      </p>

      {loading ? (
        <p style={{ color: 'var(--color-text-secondary)' }}>{t('common.loading')}</p>
      ) : (
        <div className="outreach-docs__grid">
          {ISO_CATALOG_LIST.map((iso) => {
            const asset = assets[iso.slug];
            const busy = busySlug === iso.slug;
            return (
              <div
                key={iso.slug}
                className={`outreach-doc${asset ? ' outreach-doc--filled' : ''}`}
              >
                <div className="outreach-doc__head">
                  <span className="outreach-doc__code">{iso.code}</span>
                  <span className="outreach-doc__name">{t(iso.titleKey)}</span>
                </div>

                {asset ? (
                  <div className="outreach-doc__file">
                    <FileText size={16} />
                    <div className="outreach-doc__file-text">
                      <span className="outreach-doc__file-name">{asset.file_name}</span>
                      <span className="outreach-doc__file-size">{formatSize(asset.byte_size)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="outreach-doc__empty">{t('outreachDocs.none')}</p>
                )}

                <div className="outreach-doc__actions">
                  {/* A styled <label> wrapping a hidden <input type="file">: the
                      native control cannot be restyled, and this keeps the
                      keyboard and screen-reader behaviour the real input has. */}
                  <label className={`outreach-doc__upload${busy ? ' is-busy' : ''}`}>
                    <Upload size={15} />
                    {asset ? t('outreachDocs.replace') : t('outreachDocs.upload')}
                    <input
                      type="file"
                      accept="application/pdf"
                      disabled={busy}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        // Cleared so re-picking the SAME file fires change
                        // again — otherwise a failed upload cannot be retried
                        // without choosing a different file first.
                        e.target.value = '';
                        handleFile(iso.slug, file);
                      }}
                    />
                  </label>
                  {asset && (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy}
                      onClick={() => handleRemove(iso.slug)}
                    >
                      <Trash2 size={15} /> {t('common.delete')}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
