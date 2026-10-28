import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileText, CheckCircle2, Clock, Download, ListChecks, XCircle, UploadCloud, Wallet } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../lib/apiClient';
import { Button, Input, Textarea } from '../../components/ui/FormElements';
import './ContractorContract.css';

// 3 MB — kept in step with MAX_DOC_BYTES in api/user.js.
const MAX_EVIDENCE_MB = 3;

const fileToBase64 = (file) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(String(reader.result).split(',')[1] || '');
  reader.onerror = () => reject(new Error('Could not read file'));
  reader.readAsDataURL(file);
});

const TASK_STATUS_LABEL = { pending: 'Not submitted yet', submitted: 'Submitted — under review', completed: 'Completed', missed: 'Missed' };
const TASK_STATUS_COLOR = { pending: '#94a3b8', submitted: '#2563eb', completed: '#059669', missed: '#dc2626' };

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

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);
  const [taskDrafts, setTaskDrafts] = useState({}); // taskId -> { workLink, completionDate, evidenceNote, file }
  const [submittingTask, setSubmittingTask] = useState(null);

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

  const fetchTasks = useCallback(async () => {
    setTasksLoading(true);
    try {
      const res = await apiPost('/api/user', { action: 'list-contractor-tasks' });
      setTasks(res?.tasks || []);
    } catch (e) {
      setError(e?.message || 'Could not load your tasks.');
    }
    setTasksLoading(false);
  }, []);

  const [payments, setPayments] = useState([]);
  const [paymentsLoading, setPaymentsLoading] = useState(true);

  const fetchPayments = useCallback(async () => {
    setPaymentsLoading(true);
    try {
      const res = await apiPost('/api/user', { action: 'list-contractor-payments' });
      setPayments(res?.payments || []);
    } catch (e) {
      setError(e?.message || 'Could not load your payments.');
    }
    setPaymentsLoading(false);
  }, []);

  useEffect(() => { fetchContracts(); fetchTasks(); fetchPayments(); }, [fetchContracts, fetchTasks, fetchPayments]);

  const updateDraft = (taskId, patch) => setTaskDrafts((d) => ({ ...d, [taskId]: { ...d[taskId], ...patch } }));

  const submitTask = async (taskId) => {
    const draft = taskDrafts[taskId] || {};
    setError('');
    setSubmittingTask(taskId);
    try {
      const payload = {
        action: 'submit-contractor-task',
        taskId,
        workLink: draft.workLink || undefined,
        completionDate: draft.completionDate || undefined,
        evidenceNote: draft.evidenceNote || undefined,
      };
      if (draft.file) {
        if (draft.file.size > MAX_EVIDENCE_MB * 1024 * 1024) {
          throw new Error(`Evidence file must be ${MAX_EVIDENCE_MB} MB or smaller.`);
        }
        payload.fileName = draft.file.name;
        payload.mimeType = draft.file.type || null;
        payload.dataBase64 = await fileToBase64(draft.file);
      }
      await apiPost('/api/user', payload);
      setTaskDrafts((d) => ({ ...d, [taskId]: {} }));
      await fetchTasks();
    } catch (e) {
      setError(e?.message || 'Could not submit this task.');
    }
    setSubmittingTask(null);
  };

  const downloadEvidence = async (taskId) => {
    try {
      const res = await apiPost('/api/user', { action: 'get-contractor-task-evidence-url', taskId });
      if (res?.url) window.open(res.url, '_blank', 'noopener');
    } catch (e) {
      setError(e?.message || 'No evidence file on this task.');
    }
  };

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

  if (loading) return <div className="ctrc__page-bg ctrc">{t('common.loading')}</div>;

  return (
    <div className="ctrc__page-bg ctrc">
      <h2 className="ctrc__section-title">
        <span className="ctrc__section-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><FileText size={17} /></span>
        {t('contractorContract.title', 'My Contract')}
      </h2>
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

      <h2 className="ctrc__section-title">
        <span className="ctrc__section-icon" style={{ background: '#fef3c7', color: '#d97706' }}><ListChecks size={17} /></span>
        {t('contractorContract.tasksTitle', 'My Tasks')}
      </h2>

      {tasksLoading ? <p>{t('common.loading')}</p> : tasks.length === 0 ? (
        <p className="ctrc__empty">{t('contractorContract.noTasks', 'No tasks assigned to you yet.')}</p>
      ) : tasks.map((task) => {
        const draft = taskDrafts[task.id] || {};
        const editable = task.status === 'pending' || task.status === 'submitted';
        return (
          <div key={task.id} className="ctrc__card">
            <div className="ctrc__top">
              <span className="ctrc__ref">{t('contractorContract.due', 'Due')} {task.deadline_date}</span>
              <span className="ctrc__pill" style={{ background: `${TASK_STATUS_COLOR[task.status]}18`, color: TASK_STATUS_COLOR[task.status] }}>
                {task.status === 'completed' ? <CheckCircle2 size={13} /> : task.status === 'missed' ? <XCircle size={13} /> : <Clock size={13} />}
                {TASK_STATUS_LABEL[task.status] || task.status}
              </span>
            </div>
            <p className="ctrc__text">{task.task_description}</p>
            {task.kpi_target && <p className="ctrc__section-label">KPI: {task.kpi_target}</p>}

            {task.evidence_storage_path && (
              <Button size="sm" variant="secondary" onClick={() => downloadEvidence(task.id)} style={{ marginTop: 8 }}>
                <Download size={14} /> {t('contractorContract.viewEvidence', 'View submitted evidence')}
              </Button>
            )}

            {editable && (
              <div className="ctrc__sign-box">
                <Input
                  label={t('contractorContract.workLink', 'Completed work link')}
                  placeholder="https://..."
                  value={draft.workLink ?? task.work_link ?? ''}
                  onChange={(e) => updateDraft(task.id, { workLink: e.target.value })}
                />
                <Input
                  label={t('contractorContract.completionDate', 'Completion date')}
                  type="date"
                  value={draft.completionDate ?? task.completion_date ?? ''}
                  onChange={(e) => updateDraft(task.id, { completionDate: e.target.value })}
                />
                <Textarea
                  label={t('contractorContract.evidenceNote', 'Evidence note (optional)')}
                  rows={2}
                  value={draft.evidenceNote ?? task.evidence_note ?? ''}
                  onChange={(e) => updateDraft(task.id, { evidenceNote: e.target.value })}
                />
                <div>
                  <label className="form-label" htmlFor={`evidence-${task.id}`}>{t('contractorContract.evidenceFile', 'Evidence file (optional)')}</label>
                  <input
                    className="form-input"
                    id={`evidence-${task.id}`}
                    type="file"
                    onChange={(e) => updateDraft(task.id, { file: e.target.files?.[0] || null })}
                  />
                </div>
                <Button loading={submittingTask === task.id} onClick={() => submitTask(task.id)}>
                  <UploadCloud size={15} /> {task.status === 'submitted' ? t('contractorContract.resubmit', 'Update Submission') : t('contractorContract.submit', 'Submit')}
                </Button>
              </div>
            )}
          </div>
        );
      })}

      <h2 className="ctrc__section-title">
        <span className="ctrc__section-icon" style={{ background: '#fce7f3', color: '#db2777' }}><Wallet size={17} /></span>
        {t('contractorContract.paymentsTitle', 'Payments')}
      </h2>

      {paymentsLoading ? <p>{t('common.loading')}</p> : payments.length === 0 ? (
        <p className="ctrc__empty">{t('contractorContract.noPayments', 'No payment requests yet.')}</p>
      ) : (
        <>
          {(() => {
            const credit = payments.filter((p) => p.status === 'approved');
            const totals = credit.reduce((acc, p) => {
              acc[p.currency] = (acc[p.currency] || 0) + Number(p.amount);
              return acc;
            }, {});
            const totalStrings = Object.entries(totals).map(([cur, amt]) => `${cur} ${amt.toLocaleString()}`);
            return totalStrings.length > 0 ? (
              <div className="ctrc__card" style={{ background: '#ecfdf5', borderColor: '#86efac' }}>
                <p className="ctrc__section-label">{t('contractorContract.totalCredit', 'Total Credit (Finance-approved)')}</p>
                <p className="ctrc__job" style={{ color: '#059669' }}>{totalStrings.join(' + ')}</p>
              </div>
            ) : null;
          })()}

          {payments.map((p) => (
            <div key={p.id} className="ctrc__card">
              <div className="ctrc__top">
                <span className="ctrc__ref">{p.currency} {Number(p.amount).toLocaleString()}</span>
                {p.status === 'approved' ? (
                  <span className="ctrc__pill ctrc__pill--active"><CheckCircle2 size={13} /> {t('contractorContract.credited', 'Credited')}</span>
                ) : p.status === 'rejected' ? (
                  <span className="ctrc__pill" style={{ background: '#fef2f2', color: '#dc2626' }}><XCircle size={13} /> {t('contractorContract.notApproved', 'Not approved')}</span>
                ) : (
                  <span className="ctrc__pill ctrc__pill--pending"><Clock size={13} /> {t('contractorContract.awaitingFinance', 'Awaiting Finance')}</span>
                )}
              </div>
              <p className="ctrc__text">{p.description}</p>
              {p.status === 'rejected' && p.rejection_reason && (
                <p className="ctrc__section-label" style={{ color: '#dc2626' }}>{t('contractorContract.reason', 'Reason')}: {p.rejection_reason}</p>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
