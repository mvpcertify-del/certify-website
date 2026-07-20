import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  FileSignature, CheckCircle2, Download, AlertTriangle, FileX2, RefreshCw,
} from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { Button } from '../../components/ui/FormElements';
import './PartnerContract.css';

// The agreement body is admin-authored PLAIN TEXT. It is never HTML and must
// never be injected as HTML — split on newlines and render each paragraph as
// its own node so the text can't carry markup into the page.
function ContractBody({ text }) {
  const blocks = String(text || '').split(/\n{2,}/);
  return (
    <div className="pcontract__body">
      {blocks.map((block, i) => (
        <p key={i} className="pcontract__para">
          {block.split('\n').map((line, j, arr) => (
            <span key={j}>
              {line}
              {j < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      ))}
    </div>
  );
}

const formatDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, {
    year: 'numeric', month: 'long', day: 'numeric',
  });
};

export default function PartnerContract() {
  const { t } = useTranslation();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  // A 404 ("no contract published") is an expected state, not a failure —
  // it gets a calm empty screen rather than a red error box.
  const [noContract, setNoContract] = useState(false);

  const [signedName, setSignedName] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  // Every outcome sets all three result states rather than clearing them up
  // front, so nothing here calls setState synchronously — a prologue of
  // resets would fire a cascading render on mount (react-hooks/
  // set-state-in-effect). The retry button owns the visible "loading" flip.
  const fetchContract = useCallback(async () => {
    try {
      const result = await apiPost('/api/user', { action: 'get-contract' });
      setData(result);
      setNoContract(false);
      setLoadError('');
    } catch (err) {
      setData(null);
      const missing = /no contract has been published/i.test(err.message || '');
      setNoContract(missing);
      setLoadError(missing ? '' : err.message);
    }
    setLoading(false);
  }, []);

  // fetchContract only sets state after awaiting the request, so this cannot
  // cascade renders — the rule cannot see past the async boundary. Same
  // fetch-on-mount shape as the other data pages in this app.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchContract(); }, [fetchContract]);

  const handleRetry = () => {
    setLoading(true);
    fetchContract();
  };

  const canSubmit = signedName.trim().length > 0 && confirmed && !submitting;

  const handleAccept = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitError('');
    setSubmitting(true);
    try {
      await apiPost('/api/user', {
        action: 'accept-contract',
        signedName: signedName.trim(),
        confirmed: true,
      });
      setSignedName('');
      setConfirmed(false);
      // Re-fetch rather than patching state locally: the server also mints the
      // PDF and its signed download URL, which we have no way to synthesise.
      await fetchContract();
    } catch (err) {
      setSubmitError(err.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
  };

  // ---- Loading -------------------------------------------------------------
  if (loading) {
    return (
      <div className="page-container">
        <div className="pcontract__state">
          <RefreshCw size={28} className="pcontract__spin" />
          <p>{t('partnerContract.loading')}</p>
        </div>
      </div>
    );
  }

  // ---- No published contract ----------------------------------------------
  if (noContract) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('partnerContract.title')}</h1>
            <p className="page-subtitle">{t('partnerContract.subtitle')}</p>
          </div>
        </div>
        <div className="pcontract__state">
          <FileX2 size={36} className="pcontract__state-icon" />
          <h2 className="pcontract__state-title">{t('partnerContract.noneTitle')}</h2>
          <p>{t('partnerContract.noneBody')}</p>
        </div>
      </div>
    );
  }

  // ---- Load failure --------------------------------------------------------
  if (loadError) {
    return (
      <div className="page-container">
        <div className="page-header">
          <div>
            <h1 className="page-title">{t('partnerContract.title')}</h1>
          </div>
        </div>
        <div className="pcontract__alert pcontract__alert--error">
          <AlertTriangle size={18} />
          <span>{loadError}</span>
        </div>
        <Button variant="secondary" size="md" onClick={handleRetry}>
          <RefreshCw size={16} /> {t('partnerContract.retry')}
        </Button>
      </div>
    );
  }

  const template = data?.template || {};
  const acceptance = data?.acceptance || null;
  const signed = !!data?.signedCurrentVersion;
  // Signed something, but not the version currently published — the terms
  // changed underneath them and must be re-accepted.
  const outdated = !!acceptance && !signed;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">{t('partnerContract.title')}</h1>
          <p className="page-subtitle">{t('partnerContract.subtitle')}</p>
        </div>
      </div>

      {/* ---- Signed confirmation ---- */}
      {signed && (
        <div className="pcontract__signed">
          <div className="pcontract__signed-head">
            <CheckCircle2 size={22} />
            <div>
              <div className="pcontract__signed-title">{t('partnerContract.signedTitle')}</div>
              <div className="pcontract__signed-sub">{t('partnerContract.signedSubtitle')}</div>
            </div>
          </div>

          <dl className="pcontract__meta">
            <div className="pcontract__meta-item">
              <dt>{t('partnerContract.signedBy')}</dt>
              <dd>{acceptance.signed_name}</dd>
            </div>
            <div className="pcontract__meta-item">
              <dt>{t('partnerContract.acceptedOn')}</dt>
              <dd>{formatDate(acceptance.accepted_at) || '—'}</dd>
            </div>
            <div className="pcontract__meta-item">
              <dt>{t('partnerContract.effectiveFrom')}</dt>
              <dd>
                {acceptance.effective_from
                  ? formatDate(acceptance.effective_from)
                  : (
                    <span className="pcontract__pending">
                      {t('partnerContract.startsOnApproval')}
                    </span>
                  )}
              </dd>
            </div>
            <div className="pcontract__meta-item">
              <dt>{t('partnerContract.validUntil')}</dt>
              <dd>
                {acceptance.expires_at
                  ? formatDate(acceptance.expires_at)
                  : <span className="pcontract__pending">—</span>}
              </dd>
            </div>
            <div className="pcontract__meta-item">
              <dt>{t('partnerContract.version')}</dt>
              <dd>{t('partnerContract.versionValue', { version: acceptance.version })}</dd>
            </div>
          </dl>

          {data.downloadUrl && (
            <a
              className="pcontract__download"
              href={data.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Download size={16} /> {t('partnerContract.downloadPdf')}
            </a>
          )}
        </div>
      )}

      {/* ---- Superseded-version notice ---- */}
      {outdated && (
        <div className="pcontract__alert pcontract__alert--warning">
          <AlertTriangle size={18} />
          <div>
            <strong>{t('partnerContract.updatedTitle')}</strong>
            <p>
              {t('partnerContract.updatedBody', {
                oldVersion: acceptance.version,
                newVersion: template.version,
              })}
            </p>
          </div>
        </div>
      )}

      {/* ---- The agreement itself ---- */}
      <div className="pcontract__card">
        <div className="pcontract__card-head">
          <FileSignature size={18} />
          <div>
            <h2 className="pcontract__card-title">{template.title}</h2>
            <div className="pcontract__card-sub">
              {t('partnerContract.versionValue', { version: template.version })}
              {template.term_months
                ? ` · ${t('partnerContract.termMonths', { months: template.term_months })}`
                : ''}
            </div>
          </div>
        </div>

        <div className={`pcontract__scroll${signed ? ' pcontract__scroll--readonly' : ''}`}>
          <ContractBody text={template.body} />
        </div>
      </div>

      {/* ---- Signature form ---- */}
      {!signed && (
        <form className="pcontract__sign" onSubmit={handleAccept}>
          <h3 className="pcontract__sign-title">{t('partnerContract.signHeading')}</h3>
          <p className="pcontract__sign-hint">{t('partnerContract.signHint')}</p>

          <label className="pcontract__label" htmlFor="pcontract-name">
            {t('partnerContract.nameLabel')}
          </label>
          <input
            id="pcontract-name"
            type="text"
            className="pcontract__input"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder={t('partnerContract.namePlaceholder')}
            autoComplete="name"
            maxLength={200}
          />

          <label className="pcontract__check">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>{t('partnerContract.confirmLabel')}</span>
          </label>

          {submitError && (
            <div className="pcontract__alert pcontract__alert--error">
              <AlertTriangle size={18} />
              <span>{submitError}</span>
            </div>
          )}

          <Button type="submit" variant="primary" size="md" disabled={!canSubmit}>
            {submitting ? t('partnerContract.submitting') : t('partnerContract.acceptButton')}
          </Button>
        </form>
      )}
    </div>
  );
}
