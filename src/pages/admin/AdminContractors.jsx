import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2, FileText, Send, CheckCircle2, Download, Clock, ListChecks, XCircle, Link as LinkIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import { Button, Input, Select, Textarea } from '../../components/ui/FormElements';
import Modal from '../../components/ui/Modal';
import './AdminContractors.css';

// Admin screen for authoring and sending per-contractor agreements (phase42,
// 28 Oct — replaces the earlier one-size-fits-all "accept the contract"
// checkbox the client correctly rejected). A contract is specific to one
// contractor: job scope, compensation, and a KPI table, signed by WCA GLOBAL
// (the admin, acting on its behalf — it's a fixed company, not a separate
// login), then the contractor from their own dashboard, then finalized here
// once they have.
const EMPTY_KPI = { description: '', target: '', measurement: '', consequence: '' };
const EMPTY_FORM = {
  jobTitle: '', jobDescription: '', keyResponsibilities: '',
  compensationType: '', compensationRate: '', compensationCurrency: 'USD',
  paymentSchedule: '', jurisdiction: '', noticePeriodDays: '', startDate: '', endDate: '',
  kpiDefinitions: [{ ...EMPTY_KPI }],
};

const STATUS_LABEL = {
  draft: 'Draft',
  pending_signatures: 'Pending signatures',
  signed: 'Signed / Active',
  terminated: 'Terminated',
};
const STATUS_COLOR = {
  draft: '#94a3b8',
  pending_signatures: '#d97706',
  signed: '#059669',
  terminated: '#dc2626',
};

const EMPTY_TASK_FORM = { taskDescription: '', kpiTarget: '', deadlineDate: '', contractId: '' };
const TASK_STATUS_LABEL = { pending: 'Pending', submitted: 'Submitted — needs review', completed: 'Completed', missed: 'Missed' };
const TASK_STATUS_COLOR = { pending: '#94a3b8', submitted: '#2563eb', completed: '#059669', missed: '#dc2626' };

export default function AdminContractors() {
  const { t } = useTranslation();
  const [contractors, setContractors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [selected, setSelected] = useState(null); // contractor row
  const [contracts, setContracts] = useState([]);
  const [contractsLoading, setContractsLoading] = useState(false);

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [actionLoading, setActionLoading] = useState(null);

  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [showTaskCreate, setShowTaskCreate] = useState(false);
  const [taskForm, setTaskForm] = useState(EMPTY_TASK_FORM);
  const [taskFormError, setTaskFormError] = useState('');
  const [taskSaving, setTaskSaving] = useState(false);
  const [taskActionLoading, setTaskActionLoading] = useState(null);

  const fetchContractors = useCallback(async () => {
    setLoading(true);
    const { data, error: fetchErr } = await supabase
      .from('profiles')
      .select('id, full_name, email, approval_status, activity')
      .eq('role', 'contractor')
      .eq('approval_status', 'approved')
      .order('full_name', { ascending: true });
    if (fetchErr) setError(fetchErr.message);
    setContractors(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchContractors(); }, [fetchContractors]);

  const fetchContracts = useCallback(async (contractorId) => {
    setContractsLoading(true);
    try {
      const res = await apiPost('/api/user', { action: 'list-contractor-contracts', contractorId });
      setContracts(res?.contracts || []);
    } catch (e) {
      console.error('Could not load contracts:', e);
      setContracts([]);
    }
    setContractsLoading(false);
  }, []);

  const fetchTasks = useCallback(async (contractorId) => {
    setTasksLoading(true);
    try {
      const res = await apiPost('/api/user', { action: 'list-contractor-tasks', contractorId });
      setTasks(res?.tasks || []);
    } catch (e) {
      console.error('Could not load tasks:', e);
      setTasks([]);
    }
    setTasksLoading(false);
  }, []);

  const openContractor = (c) => {
    setSelected(c);
    fetchContracts(c.id);
    fetchTasks(c.id);
  };

  const openTaskCreate = () => {
    setTaskForm(EMPTY_TASK_FORM);
    setTaskFormError('');
    setShowTaskCreate(true);
  };

  const submitTaskCreate = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setTaskFormError('');
    setTaskSaving(true);
    try {
      await apiPost('/api/user', {
        action: 'create-contractor-task',
        contractorId: selected.id,
        taskDescription: taskForm.taskDescription,
        kpiTarget: taskForm.kpiTarget || null,
        deadlineDate: taskForm.deadlineDate,
        contractId: taskForm.contractId || null,
      });
      setShowTaskCreate(false);
      await fetchTasks(selected.id);
    } catch (err) {
      setTaskFormError(err?.message || 'Could not create the task.');
    }
    setTaskSaving(false);
  };

  const reviewTask = async (taskId, decision) => {
    setTaskActionLoading(taskId);
    try {
      await apiPost('/api/user', { action: 'review-contractor-task', taskId, decision });
      await fetchTasks(selected.id);
    } catch (err) {
      setError(err?.message || 'Could not review the task.');
    }
    setTaskActionLoading(null);
  };

  const downloadEvidence = async (taskId) => {
    try {
      const res = await apiPost('/api/user', { action: 'get-contractor-task-evidence-url', taskId });
      if (res?.url) window.open(res.url, '_blank', 'noopener');
    } catch (err) {
      setError(err?.message || 'No evidence file on this task.');
    }
  };

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormError('');
    setShowCreate(true);
  };

  const updateKpi = (i, field, value) => {
    setForm((f) => {
      const next = [...f.kpiDefinitions];
      next[i] = { ...next[i], [field]: value };
      return { ...f, kpiDefinitions: next };
    });
  };
  const addKpi = () => setForm((f) => ({ ...f, kpiDefinitions: [...f.kpiDefinitions, { ...EMPTY_KPI }] }));
  const removeKpi = (i) => setForm((f) => ({
    ...f, kpiDefinitions: f.kpiDefinitions.filter((_, idx) => idx !== i),
  }));

  const submitCreate = async (e) => {
    e.preventDefault();
    if (!selected) return;
    setFormError('');
    setSaving(true);
    try {
      const created = await apiPost('/api/user', {
        action: 'create-contractor-contract',
        contractorId: selected.id,
        ...form,
        compensationRate: Number(form.compensationRate),
        noticePeriodDays: form.noticePeriodDays === '' ? null : Number(form.noticePeriodDays),
      });
      await apiPost('/api/user', { action: 'send-contractor-contract', contractId: created.contract.id });
      setShowCreate(false);
      await fetchContracts(selected.id);
    } catch (err) {
      setFormError(err?.message || 'Could not create the contract.');
    }
    setSaving(false);
  };

  const finalize = async (contractId) => {
    setActionLoading(contractId);
    try {
      await apiPost('/api/user', { action: 'finalize-contractor-contract', contractId });
      await fetchContracts(selected.id);
    } catch (err) {
      setError(err?.message || 'Could not finalize the contract.');
    }
    setActionLoading(null);
  };

  const downloadPdf = async (contractId) => {
    try {
      const res = await apiPost('/api/user', { action: 'get-contractor-contract-pdf-url', contractId });
      if (res?.url) window.open(res.url, '_blank', 'noopener');
    } catch (err) {
      setError(err?.message || 'PDF not available yet.');
    }
  };

  const hasContractorSigned = (c) => (c.contractor_contract_signatures || []).some((s) => s.party_role === 'contractor');

  return (
    <div className="adctr">
      <div className="adctr__header">
        <h1>{t('adminContractors.title', 'Contractors')}</h1>
        <p className="adctr__subtitle">
          {t('adminContractors.subtitle', 'Author and send a per-contractor agreement, then finalize it once they sign.')}
        </p>
      </div>

      {error && <div className="adctr__error">{error}</div>}

      <div className="adctr__layout">
        <div className="adctr__list">
          {loading ? <p>{t('common.loading')}</p> : contractors.length === 0 ? (
            <p className="adctr__empty">{t('adminContractors.noneApproved', 'No approved contractors yet.')}</p>
          ) : contractors.map((c) => (
            <button
              key={c.id}
              type="button"
              className={`adctr__row ${selected?.id === c.id ? 'adctr__row--active' : ''}`}
              onClick={() => openContractor(c)}
            >
              <span className="adctr__row-name">{c.full_name || c.email}</span>
              <span className="adctr__row-sub">{c.activity || c.email}</span>
            </button>
          ))}
        </div>

        <div className="adctr__detail">
          {!selected ? (
            <p className="adctr__empty">{t('adminContractors.pickOne', 'Select a contractor to see or create their contract.')}</p>
          ) : (
            <>
              <div className="adctr__detail-header">
                <h2>{selected.full_name || selected.email}</h2>
                <Button onClick={openCreate}><Plus size={16} /> {t('adminContractors.newContract', 'New Contract')}</Button>
              </div>

              {contractsLoading ? <p>{t('common.loading')}</p> : contracts.length === 0 ? (
                <p className="adctr__empty">{t('adminContractors.noContracts', 'No contracts yet for this contractor.')}</p>
              ) : (
                <div className="adctr__contracts">
                  {contracts.map((c) => (
                    <div key={c.id} className="adctr__contract-card">
                      <div className="adctr__contract-top">
                        <span className="adctr__contract-ref"><FileText size={14} /> {c.reference}</span>
                        <span className="adctr__status-pill" style={{ background: `${STATUS_COLOR[c.status]}18`, color: STATUS_COLOR[c.status] }}>
                          {STATUS_LABEL[c.status] || c.status}
                        </span>
                      </div>
                      <p className="adctr__contract-title">{c.job_title}</p>
                      <p className="adctr__contract-meta">
                        {c.compensation_currency} {Number(c.compensation_rate).toLocaleString()} &middot; {c.compensation_type} &middot; {c.payment_schedule}
                      </p>
                      <div className="adctr__contract-actions">
                        {c.status === 'pending_signatures' && !hasContractorSigned(c) && (
                          <span className="adctr__waiting"><Clock size={13} /> {t('adminContractors.waitingContractor', 'Waiting for contractor to sign')}</span>
                        )}
                        {c.status === 'pending_signatures' && hasContractorSigned(c) && (
                          <Button size="sm" loading={actionLoading === c.id} onClick={() => finalize(c.id)}>
                            <Send size={14} /> {t('adminContractors.finalize', 'Finalize')}
                          </Button>
                        )}
                        {c.status === 'signed' && (
                          <>
                            <span className="adctr__waiting adctr__waiting--done"><CheckCircle2 size={13} /> {t('adminContractors.active', 'Active')}</span>
                            <Button size="sm" variant="secondary" onClick={() => downloadPdf(c.id)}>
                              <Download size={14} /> PDF
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="adctr__detail-header" style={{ marginTop: 28 }}>
                <h3 className="adctr__section-title"><ListChecks size={16} /> {t('adminContractors.tasks', 'Tasks')}</h3>
                <Button size="sm" onClick={openTaskCreate}><Plus size={14} /> {t('adminContractors.newTask', 'New Task')}</Button>
              </div>

              {tasksLoading ? <p>{t('common.loading')}</p> : tasks.length === 0 ? (
                <p className="adctr__empty">{t('adminContractors.noTasks', 'No tasks assigned yet.')}</p>
              ) : (
                <div className="adctr__contracts">
                  {tasks.map((task) => (
                    <div key={task.id} className="adctr__contract-card">
                      <div className="adctr__contract-top">
                        <span className="adctr__contract-meta" style={{ margin: 0 }}>{t('adminContractors.due', 'Due')} {task.deadline_date}</span>
                        <span className="adctr__status-pill" style={{ background: `${TASK_STATUS_COLOR[task.status]}18`, color: TASK_STATUS_COLOR[task.status] }}>
                          {TASK_STATUS_LABEL[task.status] || task.status}
                        </span>
                      </div>
                      <p className="adctr__contract-title">{task.task_description}</p>
                      {task.kpi_target && <p className="adctr__contract-meta">KPI: {task.kpi_target}</p>}
                      {task.work_link && (
                        <p className="adctr__contract-meta">
                          <LinkIcon size={12} /> <a href={task.work_link} target="_blank" rel="noopener noreferrer">{task.work_link}</a>
                        </p>
                      )}
                      <div className="adctr__contract-actions">
                        {task.evidence_storage_path && (
                          <Button size="sm" variant="secondary" onClick={() => downloadEvidence(task.id)}>
                            <Download size={14} /> {t('adminContractors.evidence', 'Evidence')}
                          </Button>
                        )}
                        {task.status === 'submitted' && (
                          <>
                            <Button size="sm" loading={taskActionLoading === task.id} onClick={() => reviewTask(task.id, 'completed')}>
                              <CheckCircle2 size={14} /> {t('adminContractors.markCompleted', 'Mark Completed')}
                            </Button>
                            <Button size="sm" variant="secondary" loading={taskActionLoading === task.id} onClick={() => reviewTask(task.id, 'missed')}>
                              <XCircle size={14} /> {t('adminContractors.markMissed', 'Mark Missed')}
                            </Button>
                          </>
                        )}
                        {task.status === 'pending' && (
                          <span className="adctr__waiting"><Clock size={13} /> {t('adminContractors.waitingSubmission', 'Waiting for contractor')}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <Modal isOpen={showTaskCreate} onClose={() => setShowTaskCreate(false)} title={t('adminContractors.newTask', 'New Task')}>
        <form onSubmit={submitTaskCreate} className="adctr__form">
          {taskFormError && <div className="adctr__error">{taskFormError}</div>}
          <Textarea label="Task Description *" rows={3} value={taskForm.taskDescription} onChange={(e) => setTaskForm({ ...taskForm, taskDescription: e.target.value })} required />
          <Input label="KPI / Target" placeholder="Which KPI this counts toward" value={taskForm.kpiTarget} onChange={(e) => setTaskForm({ ...taskForm, kpiTarget: e.target.value })} />
          <Input label="Deadline *" type="date" value={taskForm.deadlineDate} onChange={(e) => setTaskForm({ ...taskForm, deadlineDate: e.target.value })} required />
          {contracts.length > 0 && (
            <Select label="Linked Contract (optional)" value={taskForm.contractId} onChange={(e) => setTaskForm({ ...taskForm, contractId: e.target.value })}>
              <option value="">—</option>
              {contracts.map((c) => <option key={c.id} value={c.id}>{c.reference} — {c.job_title}</option>)}
            </Select>
          )}
          <div className="adctr__form-actions">
            <Button type="submit" loading={taskSaving} fullWidth>
              <Send size={16} /> {t('adminContractors.assignTask', 'Assign Task')}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={showCreate} onClose={() => setShowCreate(false)} title={t('adminContractors.newContract', 'New Contract')} size="lg">
        <form onSubmit={submitCreate} className="adctr__form">
          {formError && <div className="adctr__error">{formError}</div>}

          <Input label="Job Title *" value={form.jobTitle} onChange={(e) => setForm({ ...form, jobTitle: e.target.value })} required />
          <Textarea label="Job Description *" rows={3} value={form.jobDescription} onChange={(e) => setForm({ ...form, jobDescription: e.target.value })} required />
          <Textarea label="Key Responsibilities *" rows={3} value={form.keyResponsibilities} onChange={(e) => setForm({ ...form, keyResponsibilities: e.target.value })} required />

          <div className="adctr__form-row">
            <Input label="Compensation Type *" placeholder="e.g. per_task, hourly" value={form.compensationType} onChange={(e) => setForm({ ...form, compensationType: e.target.value })} required />
            <Input label="Compensation Rate *" type="number" min="0" step="0.01" value={form.compensationRate} onChange={(e) => setForm({ ...form, compensationRate: e.target.value })} required />
            <Select label="Currency" value={form.compensationCurrency} onChange={(e) => setForm({ ...form, compensationCurrency: e.target.value })}>
              <option value="USD">US$</option>
              <option value="INR">INR</option>
            </Select>
          </div>

          <Input label="Payment Schedule *" placeholder="e.g. Monthly, on task completion" value={form.paymentSchedule} onChange={(e) => setForm({ ...form, paymentSchedule: e.target.value })} required />

          <div className="adctr__form-row">
            <Input label="Jurisdiction" value={form.jurisdiction} onChange={(e) => setForm({ ...form, jurisdiction: e.target.value })} />
            <Input label="Notice Period (days)" type="number" min="0" value={form.noticePeriodDays} onChange={(e) => setForm({ ...form, noticePeriodDays: e.target.value })} />
          </div>
          <div className="adctr__form-row">
            <Input label="Start Date" type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
            <Input label="End Date" type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>

          <p className="adctr__kpi-label">KPIs *</p>
          {form.kpiDefinitions.map((kpi, i) => (
            <div key={i} className="adctr__kpi-row">
              <Input placeholder="Description" value={kpi.description} onChange={(e) => updateKpi(i, 'description', e.target.value)} required />
              <Input placeholder="Target" value={kpi.target} onChange={(e) => updateKpi(i, 'target', e.target.value)} required />
              <Input placeholder="Measurement" value={kpi.measurement} onChange={(e) => updateKpi(i, 'measurement', e.target.value)} required />
              <Input placeholder="Consequence" value={kpi.consequence} onChange={(e) => updateKpi(i, 'consequence', e.target.value)} required />
              {form.kpiDefinitions.length > 1 && (
                <button type="button" className="adctr__kpi-remove" onClick={() => removeKpi(i)} aria-label="Remove KPI">
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
          <button type="button" className="adctr__kpi-add" onClick={addKpi}><Plus size={14} /> Add KPI</button>

          <div className="adctr__form-actions">
            <Button type="submit" loading={saving} fullWidth>
              <Send size={16} /> Create &amp; Send for Signature
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
