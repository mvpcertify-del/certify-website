import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, BellRing, Check, Download, MailCheck, RefreshCw, Search, Send, Users, XCircle, Eye } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import './AdminNotifications.css';

// Super Admin: proof of what the notification engine sent and to whom, and the controls for each notification.
// Everything goes through /api/notify-event (api/_notifyAdmin.js), which checks the caller is a Super Admin.

const CHANNEL_LABELS = { in_app: 'In-app', email: 'Email', whatsapp: 'WhatsApp' };
const ROLE_LABELS = {
  client: 'Client', contractor: 'Contractor', auditor: 'Auditor', certification_body: 'Certification body',
  consultancy: 'Consultancy', referral: 'Affiliate', super_admin: 'Super admin', regional_admin: 'Country admin',
};

const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const bucketText = (rule, bucket) => {
  if (!rule) return bucket;
  const n = Number(bucket);
  if (rule.key === 'invoice_unpaid') return n === 0 ? 'Due date' : `${n} days overdue`;
  if (rule.key === 'client_onboarding_incomplete') return `${n} day after registering`;
  if (rule.key === 'documents_missing') return `Reminder ${n}`;
  return `${n} day${n === 1 ? '' : 's'} before`;
};
const csvCell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;

function ChannelChips({ channels }) {
  const entries = Object.entries(channels || {});
  if (!entries.length) return <span className="ntf__muted">-</span>;
  return (
    <span className="ntf__chips">
      {entries.map(([ch, result]) => {
        const ok = result === 'sent';
        const failed = String(result).startsWith('failed');
        return (
          <span key={ch} className={`ntf__chip ${ok ? 'ntf__chip--ok' : failed ? 'ntf__chip--bad' : 'ntf__chip--skip'}`} title={String(result)}>
            {ok ? <Check size={12} /> : failed ? <XCircle size={12} /> : null} {CHANNEL_LABELS[ch] || ch}
          </span>
        );
      })}
    </span>
  );
}

function RuleCard({ rule, check, onSave, busy }) {
  const [offsets, setOffsets] = useState((rule.offsets || []).join(', '));
  const [channels, setChannels] = useState(rule.channels || []);
  const dirty = offsets !== (rule.offsets || []).join(', ') || [...channels].sort().join() !== [...(rule.channels || [])].sort().join();

  const toggle = (ch) => setChannels((c) => (c.includes(ch) ? c.filter((x) => x !== ch) : [...c, ch]));
  const save = () => onSave(rule.key, {
    offsets: offsets.split(/[\s,]+/).filter(Boolean).map(Number),
    channels,
  });

  return (
    <article className={`ntf__rule ${rule.enabled ? '' : 'ntf__rule--off'}`}>
      <header className="ntf__rule-head">
        <div>
          <h3>{rule.title}</h3>
          <p>{rule.description}</p>
        </div>
        <label className="ntf__switch" title={rule.enabled ? 'Active: click to switch off' : 'Off: click to switch on'}>
          <input type="checkbox" checked={rule.enabled} disabled={busy} onChange={(e) => onSave(rule.key, { enabled: e.target.checked })} />
          <span className="ntf__switch-track" />
          <span className="ntf__switch-label">{rule.enabled ? 'Active' : 'Off'}</span>
        </label>
      </header>

      <dl className="ntf__rule-meta">
        <div><dt>Sent to</dt><dd>{ROLE_LABELS[rule.recipientRole] || rule.recipientRole || '-'}</dd></div>
        <div><dt>Sent (period)</dt><dd>{rule.stats.sent}{rule.stats.failed ? <span className="ntf__bad"> · {rule.stats.failed} failed</span> : null}</dd></div>
        <div><dt>Last sent</dt><dd>{when(rule.stats.last)}</dd></div>
        {check != null && <div><dt>Would send today</dt><dd>{check.candidates ?? 0} {check.error ? <span className="ntf__bad">(error)</span> : null}</dd></div>}
      </dl>

      <div className="ntf__rule-edit">
        <label>
          <span>Days</span>
          <input type="text" value={offsets} onChange={(e) => setOffsets(e.target.value)} disabled={busy} aria-label="Days" />
        </label>
        <fieldset>
          <legend>Channels</legend>
          {Object.keys(CHANNEL_LABELS).map((ch) => (
            <label key={ch} className={`ntf__check ${ch === 'whatsapp' ? 'ntf__check--soon' : ''}`} title={ch === 'whatsapp' ? 'Needs a WhatsApp Business provider to be connected' : undefined}>
              <input type="checkbox" checked={channels.includes(ch)} onChange={() => toggle(ch)} disabled={busy} />
              {CHANNEL_LABELS[ch]}{ch === 'whatsapp' ? ' (not connected)' : ''}
            </label>
          ))}
        </fieldset>
        <button type="button" className="ntf__btn ntf__btn--primary" disabled={!dirty || busy} onClick={save}>Save</button>
      </div>
    </article>
  );
}

export default function AdminNotifications() {
  const { user } = useAuth();
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [check, setCheck] = useState(null);
  const [ruleFilter, setRuleFilter] = useState('all');
  const [query, setQuery] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setData(await apiPost('/api/notify-event', { action: 'notify-admin-overview', days }));
    } catch (e) {
      setError(e.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, [days]);

  useEffect(() => { load(); }, [load]);

  const saveRule = async (key, changes) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await apiPost('/api/notify-event', { action: 'notify-admin-update-rule', key, ...changes });
      setNotice('Saved. It applies from the next daily run.');
      await load();
    } catch (e) {
      setError(e.message || 'Could not save.');
    } finally {
      setBusy(false);
    }
  };

  const runCheck = async () => {
    setBusy(true);
    setError('');
    try {
      const out = await apiPost('/api/notify-event', { action: 'notify-admin-check' });
      setCheck(out.rules || {});
      setNotice('Check done. Nothing was sent: the numbers show who would be notified if it ran now.');
    } catch (e) {
      setError(e.message || 'Check failed.');
    } finally {
      setBusy(false);
    }
  };

  const rulesByKey = useMemo(() => Object.fromEntries((data?.rules || []).map((r) => [r.key, r])), [data]);
  const rows = useMemo(() => (data?.log || []).filter((r) => {
    if (ruleFilter !== 'all' && r.ruleKey !== ruleFilter) return false;
    const q = query.trim().toLowerCase();
    return !q || `${r.recipient.name || ''} ${r.recipient.email || ''}`.toLowerCase().includes(q);
  }), [data, ruleFilter, query]);

  const exportCsv = () => {
    const head = ['When', 'Recipient', 'Email', 'Role', 'Notification', 'Timing', 'Status', 'In-app', 'Email', 'In-app read'];
    const lines = rows.map((r) => [
      r.when, r.recipient.name, r.recipient.email, r.recipient.role, rulesByKey[r.ruleKey]?.title || r.ruleKey,
      bucketText(rulesByKey[r.ruleKey], r.bucket), r.status, r.channels.in_app || '', r.channels.email || '',
      r.inAppRead == null ? '' : (r.inAppRead ? 'read' : 'unread'),
    ].map(csvCell).join(','));
    const blob = new Blob([[head.map(csvCell).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `certify-notifications-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (user?.role !== ROLES.SUPER_ADMIN) {
    return <div className="page-container"><p>You do not have access to this page.</p></div>;
  }

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications &amp; Automation</h1>
          <p className="page-subtitle">Every reminder the platform sends automatically, who received it, and the controls for each one.</p>
        </div>
        <div className="ntf__actions">
          <select className="ntf__select" value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Period">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
          <button type="button" className="ntf__btn" onClick={runCheck} disabled={busy || loading}><Send size={15} /> Who would be notified today</button>
          <button type="button" className="ntf__btn" onClick={exportCsv} disabled={!rows.length}><Download size={15} /> Export CSV</button>
        </div>
      </div>

      {error && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> {error}</div>}
      {notice && !error && <div className="ntf__alert ntf__alert--ok"><Check size={16} /> {notice}</div>}

      {loading && !data && <p className="ntf__muted">Loading...</p>}

      {data && data.migrated === false && (
        <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> The notification tables are not set up yet. Run supabase/phase47_notification_engine.sql in Supabase.</div>
      )}

      {data?.migrated && (
        <>
          <section className="ntf__cards" aria-label="Totals">
            <div className="ntf__card"><MailCheck size={20} /><strong>{data.totals.sent}</strong><span>Notifications sent</span></div>
            <div className="ntf__card"><Users size={20} /><strong>{data.totals.people}</strong><span>People notified</span></div>
            <div className="ntf__card"><Eye size={20} /><strong>{data.totals.inAppRead}</strong><span>Read in-app ({data.totals.inAppUnread} unread)</span></div>
            <div className={`ntf__card ${data.totals.failed ? 'ntf__card--bad' : ''}`}><XCircle size={20} /><strong>{data.totals.failed}</strong><span>Failed</span></div>
          </section>

          <h2 className="ntf__h2"><BellRing size={18} /> Notifications</h2>
          <div className="ntf__rules">
            {data.rules.map((rule) => (
              <RuleCard key={`${rule.key}-${rule.enabled}-${(rule.offsets || []).join()}-${(rule.channels || []).join()}`} rule={rule} check={check ? (check[rule.key] || { candidates: 0 }) : null} onSave={saveRule} busy={busy} />
            ))}
          </div>

          <h2 className="ntf__h2">Delivery log <span className="ntf__muted">({rows.length}{data.log.length >= 300 ? '+' : ''} shown)</span></h2>
          <div className="ntf__filters">
            <select className="ntf__select" value={ruleFilter} onChange={(e) => setRuleFilter(e.target.value)} aria-label="Notification">
              <option value="all">All notifications</option>
              {data.rules.map((r) => <option key={r.key} value={r.key}>{r.title}</option>)}
            </select>
            <label className="ntf__search"><Search size={15} /><input type="search" placeholder="Search name or email" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          </div>

          {rows.length === 0 ? (
            <p className="ntf__empty">Nothing has been sent in this period yet. The daily run is at 09:00 UTC, and each message appears here as soon as it is sent.</p>
          ) : (
            <div className="ntf__table-wrap">
              <table className="ntf__table">
                <thead>
                  <tr><th>When</th><th>Recipient</th><th>Role</th><th>Notification</th><th>Timing</th><th>Delivered by</th><th>Read</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id}>
                      <td>{when(r.when)}</td>
                      <td><strong>{r.recipient.name || '-'}</strong><br /><span className="ntf__muted">{r.recipient.email || '-'}</span></td>
                      <td>{ROLE_LABELS[r.recipient.role] || r.recipient.role || '-'}</td>
                      <td>{rulesByKey[r.ruleKey]?.title || r.ruleKey}</td>
                      <td>{bucketText(rulesByKey[r.ruleKey], r.bucket)}</td>
                      <td><ChannelChips channels={r.channels} /></td>
                      <td>{r.inAppRead == null ? <span className="ntf__muted">-</span> : (r.inAppRead ? 'Read' : 'Unread')}</td>
                      <td><span className={`ntf__status ntf__status--${r.status}`}>{r.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
