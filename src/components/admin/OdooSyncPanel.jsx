import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertCircle, CheckCircle2, Plug, RefreshCw, RotateCcw, XCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { apiPost } from '../../lib/apiClient';
import './OdooSyncPanel.css';

// Accounting sync status (Super Admin, inside Billing).
//
// Certify.cx keeps issuing its own invoices; this tab shows the mirrored
// accounting record in Odoo for each verified card payment: whether it synced,
// the Odoo invoice number, the payment state, and why anything is stuck.
//
// Reads come straight from Postgres (RLS: Super Admin / Finance only). Actions
// (test connection, sync now, retry) go through /api/notify-event, which checks
// the caller is a Super Admin. No Odoo credential ever reaches this component.

const STATUS_TONE = {
  done: 'ok',
  dry_run: 'info',
  running: 'info',
  pending: 'info',
  failed: 'warn',
  needs_review: 'bad',
  dead: 'bad',
  skipped: 'muted',
};
const RETRYABLE = new Set(['failed', 'needs_review', 'dead']);

const short = (id) => (id ? `…${String(id).slice(-8)}` : '—');
const when = (iso) => (iso ? new Date(iso).toLocaleString() : '—');

export default function OdooSyncPanel() {
  const { t } = useTranslation();
  const [jobs, setJobs] = useState([]);
  const [records, setRecords] = useState({});
  const [config, setConfig] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [testResult, setTestResult] = useState(null);
  const [openPlan, setOpenPlan] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { data: jobRows, error: jobErr } = await supabase
        .from('odoo_sync_jobs')
        .select('id, whop_payment_id, status, step, attempts, next_retry_at, last_error, error_kind, plan, created_at, completed_at')
        .order('created_at', { ascending: false })
        .limit(100);
      if (jobErr) throw jobErr;
      setJobs(jobRows || []);

      const ids = (jobRows || []).map((j) => j.whop_payment_id);
      if (ids.length) {
        const { data: recs, error: recErr } = await supabase
          .from('odoo_records')
          .select('entity_type, certify_id, odoo_number, odoo_state, payment_state')
          .in('certify_id', ids)
          .in('entity_type', ['invoice', 'payment']);
        if (recErr) throw recErr;
        const map = {};
        for (const r of recs || []) map[`${r.entity_type}:${r.certify_id}`] = r;
        setRecords(map);
      } else {
        setRecords({});
      }
    } catch (e) {
      // The tables only exist once phase46 is applied; say so plainly.
      setError(/odoo_sync_jobs|schema cache|does not exist/i.test(e?.message || '')
        ? t('odooSync.notMigrated', 'The accounting tables are not set up in this database yet (migration phase46).')
        : (e?.message || t('odooSync.loadFailed', 'Could not load the sync status.')));
    } finally {
      setLoading(false);
    }
  }, [t]);

  const loadConfig = useCallback(async () => {
    try {
      setConfig(await apiPost('/api/notify-event', { action: 'odoo-config-status' }));
    } catch {
      setConfig(null);
    }
  }, []);

  useEffect(() => { load(); loadConfig(); }, [load, loadConfig]);

  const run = async (name, fn) => {
    setBusy(name);
    setError('');
    setNotice('');
    try {
      await fn();
    } catch (e) {
      setError(e?.message || t('odooSync.actionFailed', 'The action failed.'));
    } finally {
      setBusy('');
    }
  };

  const testConnection = () => run('test', async () => {
    setTestResult(await apiPost('/api/notify-event', { action: 'odoo-test-connection' }));
  });

  const syncNow = () => run('sync', async () => {
    const out = await apiPost('/api/notify-event', { action: 'odoo-sync-now' });
    setNotice(out.skipped
      ? t('odooSync.syncSkipped', 'Nothing was run: {{reason}}.', { reason: out.skipped.replace(/_/g, ' ') })
      : t('odooSync.syncRan', '{{n}} job(s) processed.', { n: out.processed }));
    await load();
  });

  const retry = (jobId) => run(`retry:${jobId}`, async () => {
    await apiPost('/api/notify-event', { action: 'odoo-retry', jobId });
    setNotice(t('odooSync.retryQueued', 'Job put back in the queue.'));
    await load();
  });

  const requeue = () => run('requeue', async () => {
    const out = await apiPost('/api/notify-event', { action: 'odoo-requeue-dry-runs' });
    setNotice(t('odooSync.requeued', '{{n}} dry-run job(s) queued for the live sync.', { n: out.requeued }));
    await load();
  });

  const counts = useMemo(() => {
    const c = { done: 0, open: 0, review: 0, dry: 0 };
    for (const j of jobs) {
      if (j.status === 'done') c.done += 1;
      else if (j.status === 'dry_run') c.dry += 1;
      else if (j.status === 'needs_review' || j.status === 'dead') c.review += 1;
      else if (j.status !== 'skipped') c.open += 1;
    }
    return c;
  }, [jobs]);

  const stateLine = () => {
    if (!config) return t('odooSync.stateUnknown', 'Status unavailable');
    if (config.blocked && !config.dryRun) return `${t('odooSync.stateBlocked', 'Blocked')}: ${config.blocked}`;
    if (!config.enabled || !config.dbEnabled) return t('odooSync.stateOff', 'Off');
    if (config.dryRun) return t('odooSync.stateDryRun', 'Dry run: nothing is sent to Odoo');
    if (!config.configured) return t('odooSync.stateNotConfigured', 'Not configured');
    return t('odooSync.stateOn', 'On (live)');
  };

  return (
    <div className="odoo">
      <div className="odoo__head">
        <div>
          <h3 className="odoo__title">{t('odooSync.title', 'Odoo accounting sync')}</h3>
          <p className="odoo__sub">
            {t('odooSync.subtitle', 'Verified card payments for certification orders are mirrored into Odoo as a customer, an invoice and a payment. Certify.cx continues to issue the customer-facing invoice.')}
          </p>
        </div>
        <div className="odoo__actions">
          <button type="button" className="odoo__btn" onClick={load} disabled={loading}>
            <RefreshCw size={15} /> {t('common.refresh', 'Refresh')}
          </button>
          <button type="button" className="odoo__btn" onClick={testConnection} disabled={busy === 'test'}>
            <Plug size={15} /> {t('odooSync.testConnection', 'Test connection')}
          </button>
          {config && !config.dryRun && counts.dry > 0 && (
            <button type="button" className="odoo__btn" onClick={requeue} disabled={busy === 'requeue'}>
              <RotateCcw size={15} /> {t('odooSync.requeue', 'Queue dry runs for live sync')}
            </button>
          )}
          <button type="button" className="odoo__btn odoo__btn--primary" onClick={syncNow} disabled={busy === 'sync'}>
            <RefreshCw size={15} /> {t('odooSync.syncNow', 'Sync now')}
          </button>
        </div>
      </div>

      <dl className="odoo__state">
        <div><dt>{t('odooSync.integration', 'Integration')}</dt><dd>{stateLine()}</dd></div>
        <div><dt>{t('odooSync.environment', 'Environment')}</dt><dd>{config?.env || '—'}</dd></div>
        <div><dt>{t('odooSync.host', 'Odoo host')}</dt><dd>{config?.host || '—'}</dd></div>
        <div><dt>{t('odooSync.synced', 'Synced')}</dt><dd>{counts.done}</dd></div>
        <div><dt>{t('odooSync.dryRuns', 'Dry runs')}</dt><dd>{counts.dry}</dd></div>
        <div><dt>{t('odooSync.inProgress', 'In progress')}</dt><dd>{counts.open}</dd></div>
        <div><dt>{t('odooSync.needsAttention', 'Needs attention')}</dt><dd>{counts.review}</dd></div>
      </dl>

      {config?.missing?.length > 0 && (
        <p className="odoo__hint">{t('odooSync.missing', 'Missing settings')}: {config.missing.join(', ')}</p>
      )}

      {error && (
        <div className="odoo__alert odoo__alert--error"><AlertCircle size={16} /> {error}</div>
      )}
      {notice && (
        <div className="odoo__alert odoo__alert--ok"><CheckCircle2 size={16} /> {notice}</div>
      )}

      {testResult && (
        <ul className="odoo__checks" aria-label={t('odooSync.testConnection', 'Test connection')}>
          {testResult.checks.map((c) => (
            <li key={c.name} className={c.ok ? 'odoo__check odoo__check--ok' : 'odoo__check odoo__check--bad'}>
              {c.ok ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
              <span>{c.name}{c.detail ? ` — ${c.detail}` : ''}</span>
            </li>
          ))}
        </ul>
      )}

      {loading ? (
        <p className="odoo__empty">{t('common.loading', 'Loading…')}</p>
      ) : jobs.length === 0 ? (
        <p className="odoo__empty">
          {t('odooSync.empty', 'Nothing queued yet. Jobs appear here once the integration is switched on and a card payment succeeds.')}
        </p>
      ) : (
        <div className="odoo__table-wrap">
          <table className="odoo__table">
            <thead>
              <tr>
                <th>{t('odooSync.colCreated', 'Queued')}</th>
                <th>{t('odooSync.colPayment', 'Whop payment')}</th>
                <th>{t('odooSync.colStatus', 'Status')}</th>
                <th>{t('odooSync.colInvoice', 'Odoo invoice')}</th>
                <th>{t('odooSync.colPaymentState', 'Odoo payment')}</th>
                <th>{t('odooSync.colAttempts', 'Attempts')}</th>
                <th>{t('odooSync.colError', 'Detail')}</th>
                <th aria-label={t('common.actions', 'Actions')} />
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => {
                const inv = records[`invoice:${j.whop_payment_id}`];
                const pay = records[`payment:${j.whop_payment_id}`];
                return (
                  <Fragment key={j.id}>
                  <tr>
                    <td>{when(j.created_at)}</td>
                    <td className="odoo__mono" title={j.whop_payment_id}>{short(j.whop_payment_id)}</td>
                    <td>
                      <span className={`odoo__chip odoo__chip--${STATUS_TONE[j.status] || 'muted'}`}>
                        {j.status.replace('_', ' ')}
                      </span>
                      {j.status !== 'done' && j.status !== 'skipped' && j.status !== 'dry_run' && (
                        <span className="odoo__step">{j.step}</span>
                      )}
                    </td>
                    <td className="odoo__mono">{inv?.odoo_number || '—'}</td>
                    <td>{(pay || inv)?.payment_state ? String((pay || inv).payment_state).replace('_', ' ') : '—'}</td>
                    <td>{j.attempts}</td>
                    <td className="odoo__detail" title={j.last_error || ''}>
                      {j.last_error || (j.next_retry_at ? `${t('odooSync.nextTry', 'Next try')}: ${when(j.next_retry_at)}` : '—')}
                    </td>
                    <td>
                      {j.plan && (
                        <button
                          type="button"
                          className="odoo__btn odoo__btn--small"
                          onClick={() => setOpenPlan(openPlan === j.id ? null : j.id)}
                          aria-expanded={openPlan === j.id}
                        >
                          {t('odooSync.viewPlan', 'View plan')}
                        </button>
                      )}
                      {RETRYABLE.has(j.status) && (
                        <button
                          type="button"
                          className="odoo__btn odoo__btn--small"
                          onClick={() => retry(j.id)}
                          disabled={busy === `retry:${j.id}`}
                        >
                          <RotateCcw size={13} /> {t('odooSync.retry', 'Retry')}
                        </button>
                      )}
                    </td>
                  </tr>
                  {openPlan === j.id && j.plan && (
                    <tr className="odoo__plan-row">
                      <td colSpan={8}>
                        <p className="odoo__hint">
                          {t('odooSync.planNote', 'Dry run: these are the operations that would be sent to Odoo. Nothing was sent.')}
                          {j.plan.unset_settings?.length > 0 && ` ${t('odooSync.unset', 'Still to configure')}: ${j.plan.unset_settings.join(', ')}.`}
                        </p>
                        <pre className="odoo__plan">{JSON.stringify(j.plan.operations, null, 2)}</pre>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
