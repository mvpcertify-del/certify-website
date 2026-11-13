import { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import {
  ListChecks, Gauge, CheckCircle2, Wallet, Sparkles, X,
  Palette, ShieldCheck, FileSearch, ClipboardList, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { apiPost } from '../../lib/apiClient';
import './ContractorDashboard.css';

// Contractor's main landing page (phase45, 28 Oct) — rebuilt to match a
// mockup the client sent directly. The stat cards, Task & KPI Workspace
// table, Monthly KPIs table and Payments cards are real data, reusing the
// same actions /contractor/contract already calls (list-contractor-tasks,
// list-contractor-contracts, list-contractor-payments) — nothing new on the
// backend for this page.
//
// The "Certify AI Assistant" panel on the right is visual-only, by explicit
// agreement (28 Oct): the mockup's 5 agents (Brand & Style, Compliance
// Pre-Check, Task Instruction Interpreter, Activity Log Verifier, Risk &
// NDA) would each be their own real AI feature — out of scope here. Buttons
// show "Coming soon" instead of doing nothing silently.
const AI_AGENTS = [
  { icon: Palette, label: 'Brand & Style Guide Agent', cta: 'Ask AI Brand Agent', color: '#2563eb' },
  { icon: ShieldCheck, label: 'Compliance Pre-Check Agent', cta: 'Submit Task for AI Review', color: '#059669' },
  { icon: FileSearch, label: 'Task Instruction Interpreter', cta: 'Submit Task for AI Review', color: '#2563eb' },
  { icon: ClipboardList, label: 'Activity Log Verifier', cta: 'Ask Activity Log Verifier', color: '#2563eb' },
  { icon: ShieldAlert, label: 'Risk & NDA Agent', cta: 'Ask AI NDA Agent', color: '#dc2626' },
];

const TASK_STATUS_LABEL = { pending: 'Not submitted', submitted: 'In Progress', completed: 'Completed', missed: 'Missed' };
const TASK_STATUS_COLOR = { pending: '#94a3b8', submitted: '#d97706', completed: '#059669', missed: '#dc2626' };
const PAYMENT_STATUS_LABEL = { pending_finance: 'Pending Verification', approved: 'Paid', rejected: 'Not Approved' };

function isThisMonth(dateStr) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
}

export default function ContractorDashboard() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [tasks, setTasks] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [aiNotice, setAiNotice] = useState('');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [tasksRes, contractsRes, paymentsRes] = await Promise.all([
        apiPost('/api/user', { action: 'list-contractor-tasks' }),
        apiPost('/api/user', { action: 'list-contractor-contracts' }),
        apiPost('/api/user', { action: 'list-contractor-payments' }),
      ]);
      setTasks(tasksRes?.tasks || []);
      setContracts(contractsRes?.contracts || []);
      setPayments(paymentsRes?.payments || []);
    } catch (e) {
      setError(e?.message || 'Could not load your dashboard.');
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const contractById = useMemo(() => {
    const map = new Map();
    contracts.forEach((c) => map.set(c.id, c));
    return map;
  }, [contracts]);

  const stats = useMemo(() => {
    const activeTasks = tasks.filter((tk) => tk.status === 'pending' || tk.status === 'submitted').length;

    const decidedThisMonth = tasks.filter((tk) => isThisMonth(tk.updated_at) && tk.achieved_percent != null);
    const monthlyKpiPct = decidedThisMonth.length
      ? Math.round(decidedThisMonth.reduce((sum, tk) => sum + Number(tk.achieved_percent), 0) / decidedThisMonth.length)
      : null;

    const milestonesMet = tasks.filter((tk) => tk.status === 'completed' && isThisMonth(tk.updated_at)).length;

    const approvedByCurrency = payments.filter((p) => p.status === 'approved').reduce((acc, p) => {
      acc[p.currency] = (acc[p.currency] || 0) + Number(p.amount);
      return acc;
    }, {});
    const payoutsReady = Object.entries(approvedByCurrency).map(([cur, amt]) => `${cur} ${amt.toLocaleString()}`).join(' + ') || null;

    return { activeTasks, monthlyKpiPct, milestonesMet, payoutsReady };
  }, [tasks, payments]);

  // Groups tasks by their free-text kpi_target into the "Monthly KPIs" table
  // rows — there is no separate KPI-category entity in the schema, so this
  // is the closest real grouping available.
  const kpiRows = useMemo(() => {
    const groups = new Map();
    tasks.forEach((tk) => {
      const key = tk.kpi_target || 'General';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(tk);
    });
    return Array.from(groups.entries()).map(([category, rows]) => {
      const goal = rows.length;
      const progress = rows.filter((r) => r.status === 'completed').length;
      const percent = goal ? Math.round((progress / goal) * 100) : 0;
      const linkedPayment = payments.find((p) => rows.some((r) => r.id === p.task_id));
      return {
        category,
        goal,
        progress,
        percent,
        compensationStatus: linkedPayment ? (PAYMENT_STATUS_LABEL[linkedPayment.status] || linkedPayment.status) : '—',
      };
    });
  }, [tasks, payments]);

  const greetingTime = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  if (loading) return <div className="cdash__page-bg cdash">{t('common.loading')}</div>;

  return (
    <div className="cdash__page-bg cdash">
      <div className="cdash__main">
        <div className="cdash__greeting-row">
          <div>
            <h1 className="cdash__greeting">{greetingTime}, {user?.full_name?.split(' ')[0] || 'there'}!</h1>
            <p className="cdash__greeting-sub">{t('contractorDashboard.greetingSub', "Here's where things stand with your documentation and tasks.")}</p>
          </div>
        </div>

        {error && <div className="cdash__error">{error}</div>}

        <div className="cdash__stats">
          <div className="cdash__stat">
            <div className="cdash__stat-icon" style={{ background: '#dbeafe', color: '#2563eb' }}><ListChecks size={20} /></div>
            <div className="cdash__stat-text">
              <p className="cdash__stat-label">{t('contractorDashboard.activeTasks', 'Active Tasks')}</p>
              <p className="cdash__stat-value">{stats.activeTasks}</p>
              <p className="cdash__stat-note">{t('contractorDashboard.activeTasksNote', 'active design/content projects')}</p>
            </div>
          </div>
          <div className="cdash__stat">
            <div className="cdash__stat-icon" style={{ background: '#fef3c7', color: '#d97706' }}><Gauge size={20} /></div>
            <div className="cdash__stat-text">
              <p className="cdash__stat-label">{t('contractorDashboard.monthlyKpi', 'My Monthly KPI')}</p>
              <p className="cdash__stat-value">{stats.monthlyKpiPct != null ? `${stats.monthlyKpiPct}%` : '—'}</p>
              <p className="cdash__stat-note">{t('contractorDashboard.monthlyKpiNote', 'of monthly KPI target achieved')}</p>
            </div>
          </div>
          <div className="cdash__stat">
            <div className="cdash__stat-icon" style={{ background: '#dcfce7', color: '#059669' }}><CheckCircle2 size={20} /></div>
            <div className="cdash__stat-text">
              <p className="cdash__stat-label">{t('contractorDashboard.milestonesMet', 'Milestones Met')}</p>
              <p className="cdash__stat-value">{stats.milestonesMet}</p>
              <p className="cdash__stat-note">{t('contractorDashboard.milestonesMetNote', 'monthly compensation milestones completed')}</p>
            </div>
          </div>
          <div className="cdash__stat">
            <div className="cdash__stat-icon" style={{ background: '#fce7f3', color: '#db2777' }}><Wallet size={20} /></div>
            <div className="cdash__stat-text">
              <p className="cdash__stat-label">{t('contractorDashboard.payoutsReady', 'Payouts Ready')}</p>
              <p className="cdash__stat-value" style={{ fontSize: stats.payoutsReady ? '1.1rem' : undefined }}>{stats.payoutsReady || '—'}</p>
              <p className="cdash__stat-note">{t('contractorDashboard.payoutsReadyNote', 'Current payable amount')}</p>
            </div>
          </div>
        </div>

        <div className="cdash__section">
          <div className="cdash__section-header">
            <h2>{t('contractorDashboard.workspaceTitle', 'Task & KPI Workspace')}</h2>
            <Link to="/contractor/contract" className="cdash__view-all">{t('contractorDashboard.viewAll', 'View all')}</Link>
          </div>
          {tasks.length === 0 ? (
            <p className="cdash__empty">{t('contractorDashboard.noTasks', 'No tasks assigned yet.')}</p>
          ) : (
            <div className="cdash__table-wrap">
              <table className="cdash__table">
                <thead>
                  <tr>
                    <th>{t('contractorDashboard.colProject', 'Project Name')}</th>
                    <th>{t('contractorDashboard.colType', 'Type')}</th>
                    <th>{t('contractorDashboard.colTask', 'Task Description')}</th>
                    <th>{t('contractorDashboard.colDeadline', 'Deadline')}</th>
                    <th>{t('contractorDashboard.colCompensation', 'Compensation')}</th>
                    <th>{t('contractorDashboard.colStatus', 'Status')}</th>
                    <th>{t('contractorDashboard.colUpload', 'Upload Deliverable')}</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.slice(0, 8).map((tk) => {
                    const contract = tk.contract_id ? contractById.get(tk.contract_id) : null;
                    return (
                      <tr key={tk.id}>
                        <td>{contract?.job_title || t('contractorDashboard.generalProject', 'General')}</td>
                        <td>{contract?.compensation_type || '—'}</td>
                        <td className="cdash__td-desc">{tk.task_description}</td>
                        <td>{tk.deadline_date}</td>
                        <td>{contract ? `${contract.compensation_currency} ${Number(contract.compensation_rate).toLocaleString()}` : '—'}</td>
                        <td>
                          <span className="cdash__pill" style={{ background: `${TASK_STATUS_COLOR[tk.status]}18`, color: TASK_STATUS_COLOR[tk.status] }}>
                            {TASK_STATUS_LABEL[tk.status] || tk.status}
                          </span>
                        </td>
                        <td>
                          <Link to="/contractor/contract" className="cdash__upload-btn">{t('contractorDashboard.upload', 'Upload')}</Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="cdash__section">
          <div className="cdash__section-header">
            <h2>{t('contractorDashboard.kpiTableTitle', 'Monthly KPIs (Monthly Compensation)')}</h2>
          </div>
          {kpiRows.length === 0 ? (
            <p className="cdash__empty">{t('contractorDashboard.noKpis', 'No KPI data yet.')}</p>
          ) : (
            <div className="cdash__table-wrap">
              <table className="cdash__table">
                <thead>
                  <tr>
                    <th>{t('contractorDashboard.kpiCategory', 'KPI Category')}</th>
                    <th>{t('contractorDashboard.monthlyGoal', 'Monthly Goal')}</th>
                    <th>{t('contractorDashboard.currentProgress', 'Current Progress')}</th>
                    <th>{t('contractorDashboard.percentageMet', 'Percentage Met')}</th>
                    <th>{t('contractorDashboard.compensationStatus', 'Compensation Status')}</th>
                  </tr>
                </thead>
                <tbody>
                  {kpiRows.map((row) => (
                    <tr key={row.category}>
                      <td>{row.category}</td>
                      <td>{row.goal}</td>
                      <td>{row.progress}</td>
                      <td>{row.percent}%</td>
                      <td>
                        <span className="cdash__pill" style={{ background: '#fffbeb', color: '#d97706' }}>{row.compensationStatus}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="cdash__section">
          <div className="cdash__section-header">
            <h2>{t('contractorDashboard.paymentsTitle', 'Payments')}</h2>
            <Link to="/contractor/contract" className="cdash__view-all">{t('contractorDashboard.viewAll', 'View all')}</Link>
          </div>
          {payments.length === 0 ? (
            <p className="cdash__empty">{t('contractorDashboard.noPayments', 'No payment requests yet.')}</p>
          ) : (
            <div className="cdash__payment-cards">
              {payments.slice(0, 4).map((p) => (
                <div key={p.id} className="cdash__payment-card">
                  <p className="cdash__payment-amount">{p.currency} {Number(p.amount).toLocaleString()}</p>
                  <p className="cdash__payment-desc">{p.description}</p>
                  <span className="cdash__pill" style={{ background: p.status === 'approved' ? '#dcfce7' : p.status === 'rejected' ? '#fef2f2' : '#fffbeb', color: p.status === 'approved' ? '#059669' : p.status === 'rejected' ? '#dc2626' : '#d97706' }}>
                    {PAYMENT_STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <aside className="cdash__ai-panel">
        <div className="cdash__ai-header">
          <span><Sparkles size={16} /> {t('contractorDashboard.aiTitle', 'Certify AI Assistant')}</span>
        </div>
        {aiNotice && (
          <div className="cdash__ai-notice">
            {aiNotice}
            <button type="button" onClick={() => setAiNotice('')}><X size={14} /></button>
          </div>
        )}
        {AI_AGENTS.map((agent) => (
          <div key={agent.label} className="cdash__ai-card">
            <div className="cdash__ai-card-icon" style={{ color: agent.color }}><agent.icon size={18} /></div>
            <p className="cdash__ai-card-label">{agent.label}</p>
            <div className="cdash__ai-progress"><div className="cdash__ai-progress-fill" style={{ background: agent.color }} /></div>
            <button
              type="button"
              className="cdash__ai-cta"
              onClick={() => setAiNotice(t('contractorDashboard.aiComingSoon', 'Coming soon — this AI agent is not live yet.'))}
            >
              {agent.cta}
            </button>
          </div>
        ))}
      </aside>
    </div>
  );
}
