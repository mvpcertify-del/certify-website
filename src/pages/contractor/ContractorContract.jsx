import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle2, Clock, Download } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../lib/apiClient';
import { Button, Input } from '../../components/ui/FormElements';
import './ContractorContract.css';

// A contractor's own view of the agreement(s) an admin has authored for them
// (phase42, 28 Oct). Signing here is the 2nd-party signature in the
// WCA GLOBAL / Contractor / Certify.cx tri-party flow — see
// api/_contractorContract.js for the full design.
export default function ContractorContract() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [contracts, setContracts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [signedName, setSignedName] = useState(user?.full_name || '');
  const [signing, setSigning] = useState(null);
  const [error, setError] = useState('');

  const fetchContracts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiPost('/api/user', { action: 'list-contractor-contracts' });
      setContracts(res?.contracts || []);
    } catch (e) {
      setError(e?.message || 'Could not load your contracts.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchContracts(); }, [fetchContracts]);

  const hasSigned = (c) => (c.contractor_contract_signatures || []).some((s) => s.party_role === 'contractor');

  const sign = async (contractId) => {
    if (!signedName.trim()) {
      setError('Please type your full name to sign.');
      return;
    }
    setError('');
    setSigning(contractId);
    try {
      await apiPost('/api/user', { action: 'sign-contractor-contract', contractId, signedName });
      await fetchContracts();
    } catch (e) {
      setError(e?.message || 'Could not record your signature.');
    }
    setSigning(null);
  };

  const downloadPdf = async (contractId) => {
    try {
      const res = await apiPost('/api/user', { action: 'get-contractor-contract-pdf-url', contractId });
      if (res?.url) window.open(res.url, '_blank', 'noopener');
    } catch (e) {
      setError(e?.message || 'PDF not available yet.');
    }
  };

  if (loading) return <div className="ctrc">{t('common.loading')}</div>;

  return (
    <div className="ctrc">
      <h1>{t('contractorContract.title', 'My Contract')}</h1>
      {error && <div className="ctrc__error">{error}</div>}

      {contracts.length === 0 && (
        <p className="ctrc__empty">{t('contractorContract.none', 'No contract has been sent to you yet.')}</p>
      )}

      {contracts.map((c) => (
        <div key={c.id} className="ctrc__card">
          <div className="ctrc__top">
            <span className="ctrc__ref"><FileText size={14} /> {c.reference}</span>
            {c.status === 'signed' ? (
              <span className="ctrc__pill ctrc__pill--active"><CheckCircle2 size={13} /> {t('contractorContract.active', 'Active')}</span>
            ) : (
              <span className="ctrc__pill ctrc__pill--pending"><Clock size={13} /> {t('contractorContract.pending', 'Pending your signature')}</span>
            )}
          </div>

          <h2 className="ctrc__job">{c.job_title}</h2>
          <p className="ctrc__section-label">{t('contractorContract.description', 'Job Description')}</p>
          <p className="ctrc__text">{c.job_description}</p>
          <p className="ctrc__section-label">{t('contractorContract.responsibilities', 'Key Responsibilities')}</p>
          <p className="ctrc__text">{c.key_responsibilities}</p>

          <p className="ctrc__section-label">{t('contractorContract.compensation', 'Compensation')}</p>
          <p className="ctrc__text">
            {c.compensation_currency} {Number(c.compensation_rate).toLocaleString()} &middot; {c.compensation_type} &middot; {c.payment_schedule}
          </p>

          {Array.isArray(c.kpi_definitions) && c.kpi_definitions.length > 0 && (
            <>
              <p className="ctrc__section-label">{t('contractorContract.kpis', 'KPIs')}</p>
              <table className="ctrc__kpi-table">
                <thead>
                  <tr><th>{t('contractorContract.kpiDesc', 'Description')}</th><th>{t('contractorContract.kpiTarget', 'Target')}</th><th>{t('contractorContract.kpiMeasure', 'Measurement')}</th><th>{t('contractorContract.kpiConseq', 'Consequence')}</th></tr>
                </thead>
                <tbody>
                  {c.kpi_definitions.map((k, i) => (
                    <tr key={i}>
                      <td>{k.description}</td><td>{k.target}</td><td>{k.measurement}</td><td>{k.consequence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}

          {c.status === 'signed' ? (
            <Button variant="secondary" onClick={() => downloadPdf(c.id)} style={{ marginTop: 16 }}>
              <Download size={15} /> {t('contractorContract.download', 'Download signed PDF')}
            </Button>
          ) : hasSigned(c) ? (
            <p className="ctrc__waiting">{t('contractorContract.waitingAdmin', 'You have signed. Waiting for Certify.cx to finalize.')}</p>
          ) : (
            <div className="ctrc__sign-box">
              <Input
                label={t('contractorContract.signName', 'Type your full legal name to sign *')}
                value={signedName}
                onChange={(e) => setSignedName(e.target.value)}
              />
              <Button loading={signing === c.id} onClick={() => sign(c.id)}>
                {t('contractorContract.signButton', 'I agree — Sign this contract')}
              </Button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
