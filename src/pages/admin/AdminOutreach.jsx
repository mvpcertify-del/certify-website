import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, CalendarClock, Check, CheckCircle2, Download, Eye, FileUp, Mail, Pause, RefreshCw, Rocket, Search, Send, XCircle } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import './AdminNotifications.css';
import './AdminOutreach.css';

// Super Admin: cold outreach to schools and universities (3 emails: day 1, day 4, day 9, in the recipient's
// business hours). Everything goes through /api/notify-event (api/_outreachAdmin.js). Nothing on this page can
// send to a lead: only the hourly job does, and only after a test email and an explicit approval here.

const call = (action, body = {}) => apiPost('/api/notify-event', { action, ...body });
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');
const STATUS_LABEL = {
  new: 'Not started', in_sequence: 'In sequence', completed: 'Completed', replied: 'Replied', unsubscribed: 'Unsubscribed',
  bounced: 'Bounced', stopped: 'Stopped', needs_timezone: 'Needs time zone',
};
const MODE = { off: ['Off', 'Nothing runs'], dry: ['Dry run', 'Works out who would be emailed, sends nothing'], test: ['Test', 'Only the test button sends'], live: ['Live', 'Sending the real sequence'] };
const EVENT_LABEL = {
  sent: 'Email sent', failed: 'Send failed', reply: 'Replied', auto_reply: 'Auto-reply', bounce: 'Bounced', unsubscribed: 'Unsubscribed',
  test_sent: 'Test email sent', approved_live: 'Went live', paused: 'Paused', admin_stop: 'Stopped by admin', admin_replied: 'Marked replied',
  admin_unsubscribe: 'Marked unsubscribed', admin_restart: 'Restarted', admin_delete: 'Deleted',
};

// ---- CSV ------------------------------------------------------------------
function parseCsv(text) {
  const rows = []; let row = []; let cell = ''; let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text; // a byte order mark, which Excel adds to CSV files
  for (let i = 0; i < s.length; i += 1) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') { cell += '"'; i += 1; } else if (c === '"') quoted = false; else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') { row.push(cell); cell = ''; } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
const ALIASES = {
  email: ['email', 'e-mail', 'email address', 'contact email'],
  institution_name: ['institution_name', 'institution', 'school', 'university', 'organization', 'organisation', 'company', 'name of institution'],
  contact_name: ['contact_name', 'contact', 'recipient', 'recipient_name', 'full name', 'first name', 'name'],
  country: ['country'],
  timezone: ['timezone', 'time_zone', 'time zone'],
  institution_type: ['institution_type', 'type', 'category'],
};
function toLeads(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const col = {};
  for (const [field, names] of Object.entries(ALIASES)) col[field] = head.findIndex((h) => names.includes(h));
  return rows.slice(1).map((r) => Object.fromEntries(Object.keys(ALIASES).map((f) => [f, col[f] >= 0 ? (r[col[f]] || '').trim() : ''])));
}
const TEMPLATE_CSV = 'institution_name,contact_name,email,country,timezone,institution_type\nExample University,Dr. Amina Hassan,amina.hassan@example.edu.eg,Egypt,,University\nExample School,,admissions@example-school.ae,United Arab Emirates,,School\n';

export default function AdminOutreach() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [form, setForm] = useState({ calendly_url: '', test_recipient: '', daily_cap: 40, hourly_cap: 6, mode: 'dry' });
  const [formDirty, setFormDirty] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [previewStep, setPreviewStep] = useState(1);
  const [preview, setPreview] = useState(null);
  const [csv, setCsv] = useState(null); // { name, rows }
  const fileRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const d = await call('outreach-overview', { status: statusFilter === 'all' ? undefined : statusFilter, q: query || undefined });
      setData(d);
      if (d.settings && !formDirty) {
        setForm({ calendly_url: d.settings.calendly_url || '', test_recipient: d.settings.test_recipient || '', daily_cap: d.settings.daily_cap, hourly_cap: d.settings.hourly_cap, mode: d.settings.mode === 'live' ? 'dry' : d.settings.mode });
      }
    } catch (e) {
      setError(e.message || 'Could not load.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, query, formDirty]);

  useEffect(() => { const t = setTimeout(load, query ? 350 : 0); return () => clearTimeout(t); }, [load, query]);

  useEffect(() => {
    if (!data?.migrated) return;
    call('outreach-preview-email', { step: previewStep }).then(setPreview).catch(() => setPreview(null));
  }, [previewStep, data?.migrated, data?.settings?.calendly_url]);

  const act = async (key, fn, okText) => {
    setBusy(key); setError(''); setNotice('');
    try {
      await fn();
      if (okText) setNotice(okText);
      setFormDirty(false);
      await load();
    } catch (e) {
      setError(e.message || 'That did not work.');
    } finally {
      setBusy('');
    }
  };

  const saveSettings = () => act('save', () => call('outreach-update-settings', form), 'Settings saved.');
  const sendTest = () => act('test', async () => {
    if (formDirty) await call('outreach-update-settings', form);
    await call('outreach-send-test', { to: form.test_recipient });
  }, `Test email sent to ${form.test_recipient}. Check that inbox (and the spam folder).`);
  const approve = () => {
    if (!window.confirm('Approve going live? From the next hourly run the system will email real schools and universities, within the daily limit.')) return;
    act('live', () => call('outreach-approve-live'), 'Live. The first emails go out at the next hourly run, inside each recipient\'s business hours.');
  };
  const sendAllTests = () => act('tests', async () => {
    if (formDirty) await call('outreach-update-settings', form);
    for (const step of [1, 2, 3]) await call('outreach-send-test', { to: form.test_recipient, step });
  }, `All 3 test emails sent to ${form.test_recipient}. Check that inbox (and the spam folder).`);
  const sendNow = (row) => {
    const outside = row.businessNow ? '' : `

Note: it is outside their business hours right now.`;
    if (!window.confirm(`Send email ${row.step} of 3 to ${row.institution} now?${outside}`)) return;
    act(`now-${row.id}`, () => call('outreach-send-now', { id: row.id }), `Email ${row.step} sent to ${row.institution}.`);
  };
  const pause = () => act('pause', () => call('outreach-pause'), 'Paused: back to dry run. Nothing will be sent.');

  const pickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setCsv({ name: f.name, rows: toLeads(String(reader.result || '')) });
    reader.readAsText(f);
  };
  const importCsv = () => act('import', async () => {
    const r = await call('outreach-import', { rows: csv.rows });
    setCsv(null);
    if (fileRef.current) fileRef.current.value = '';
    setNotice(`Imported ${r.added}. Skipped: ${r.duplicates} already in the list, ${r.suppressed} on the do-not-email list, ${r.invalid} invalid${r.needsTimezone ? `; ${r.needsTimezone} need a time zone` : ''}.${r.problems?.length ? ` ${r.problems.slice(0, 3).join(' ')}` : ''}`);
  });
  const leadAction = (id, what, label) => {
    if (what === 'delete' && !window.confirm('Delete this lead? Its address stays on the do-not-email list if it was added there.')) return;
    act(`lead-${id}`, () => call('outreach-lead-action', { id, what }), label);
  };
  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
    a.download = 'outreach-leads-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = data?.settings;
  const checklist = useMemo(() => (data?.migrated ? [
    { ok: data.mailbox.configured, text: data.mailbox.configured ? `Mailbox connected (${data.mailbox.user})` : 'Mailbox not connected: add the OUTREACH_SMTP_* variables in Vercel' },
    { ok: Boolean(s.calendly_url), text: s.calendly_url ? 'Calendly link set' : 'Calendly link not set' },
    { ok: Boolean(s.test_sent_at), text: s.test_sent_at ? `Test email sent ${when(s.test_sent_at)}` : 'No test email sent yet' },
    { ok: Boolean(s.live_approved_at), text: s.live_approved_at ? `Approved live ${when(s.live_approved_at)}` : 'Not approved to go live' },
  ] : []), [data, s]);

  if (user?.role !== ROLES.SUPER_ADMIN) return <div className="page-container"><p>You do not have access to this page.</p></div>;

  const live = s?.mode === 'live';

  return (
    <div className="page-container ntf otr">
      <div className="page-header">
        <div>
          <h1 className="page-title">Outreach</h1>
          <p className="page-subtitle">Cold emails to schools and universities: introduction on day 1, follow-up on day 4, final follow-up on day 9, always in the recipient&apos;s business hours.</p>
        </div>
        <div className="ntf__actions">
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      {error && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> {error}</div>}
      {notice && !error && <div className="ntf__alert ntf__alert--ok"><Check size={16} /> {notice}</div>}
      {loading && !data && <p className="ntf__muted">Loading...</p>}
      {data && data.migrated === false && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> The outreach tables are not set up yet. Run supabase/phase48_outreach.sql in Supabase.</div>}

      {data?.migrated && (
        <>
          <section className={`otr__status otr__status--${s.mode}`}>
            <div>
              <span className="otr__mode">{MODE[s.mode][0]}</span>
              <span className="otr__mode-text">{MODE[s.mode][1]}</span>
            </div>
            <div className="otr__status-nums">
              <span><strong>{data.sent24h}</strong> sent in 24 h</span>
              <span>limit <strong>{data.effectiveDailyCap}</strong> a day{data.effectiveDailyCap < s.daily_cap ? ' (warming up)' : ''}</span>
              <span><strong>{data.suppressed}</strong> on the do-not-email list</span>
            </div>
          </section>

          <section className="otr__panel">
            <h2 className="ntf__h2"><Rocket size={18} /> Go live</h2>
            <ul className="otr__check">
              {checklist.map((c) => <li key={c.text} className={c.ok ? 'otr__check--ok' : 'otr__check--no'}>{c.ok ? <CheckCircle2 size={16} /> : <XCircle size={16} />} {c.text}</li>)}
            </ul>
            <div className="otr__row">
              {live
                ? <button type="button" className="ntf__btn" onClick={pause} disabled={!!busy}><Pause size={15} /> Pause sending</button>
                : <button type="button" className="ntf__btn ntf__btn--primary" onClick={approve} disabled={!!busy || data.blockers.some((b) => !/approved/.test(b)) || !s.test_sent_at}><Rocket size={15} /> Approve and go live</button>}
              <span className="ntf__muted">Midhat tests first, then approves. Until then the hourly job sends nothing.</span>
            </div>
          </section>

          <section className="otr__panel">
            <h2 className="ntf__h2"><CalendarClock size={18} /> Schedule</h2>
            <p className="ntf__muted">Who gets which email and when, shown in the recipient&apos;s own time. Follow-ups keep their day-4 and day-9 times; new leads are spread out so no day goes over the limit (an estimate: the real run also depends on the hourly limit). You can also send one yourself right now.</p>
            {!data.canSendNow && <p className="ntf__muted">&quot;Send now&quot; is off: {data.sendNowBlockers.join('; ')}.</p>}
            {data.schedule.length === 0 ? <p className="ntf__empty">Nothing is scheduled. Add leads below.</p> : (
              <div className="ntf__table-wrap">
                <table className="ntf__table">
                  <thead><tr><th>Institution</th><th>Country</th><th>Email</th><th>Their time</th><th>Your time</th><th>State</th><th /></tr></thead>
                  <tbody>
                    {data.schedule.map((r) => (
                      <tr key={r.id}>
                        <td><strong>{r.institution}</strong><br /><span className="ntf__muted">{r.email}</span></td>
                        <td>{r.country || '-'}<br /><span className="ntf__muted">{r.timezone}</span></td>
                        <td>{['Introduction', 'Follow-up', 'Final follow-up'][r.step - 1]}<br /><span className="ntf__muted">email {r.step} of 3, day {[1, 4, 9][r.step - 1]}</span></td>
                        <td>{r.local}</td>
                        <td>{when(r.plannedAt)}</td>
                        <td><span className={`otr__badge ${r.state === 'due' ? 'otr__badge--needs_timezone' : ''}`}>{{ due: 'Due now', waiting: 'Waiting', planned: 'Planned' }[r.state]}</span></td>
                        <td><button type="button" className="ntf__btn" disabled={!!busy || !data.canSendNow} onClick={() => sendNow(r)}><Send size={14} /> Send now</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="otr__panel">
            <h2 className="ntf__h2"><Mail size={18} /> Settings</h2>
            <div className="otr__form">
              <label>Calendly link
                <input type="url" placeholder="https://calendly.com/..." value={form.calendly_url} onChange={(e) => { setForm({ ...form, calendly_url: e.target.value }); setFormDirty(true); }} />
              </label>
              <label>Send the test to
                <input type="email" placeholder="midhat@certify.cx" value={form.test_recipient} onChange={(e) => { setForm({ ...form, test_recipient: e.target.value }); setFormDirty(true); }} />
              </label>
              <label>Emails a day (max)
                <input type="number" min="1" max="500" value={form.daily_cap} onChange={(e) => { setForm({ ...form, daily_cap: Number(e.target.value) }); setFormDirty(true); }} />
              </label>
              <label>Emails an hour (max)
                <input type="number" min="1" max="60" value={form.hourly_cap} onChange={(e) => { setForm({ ...form, hourly_cap: Number(e.target.value) }); setFormDirty(true); }} />
              </label>
              {!live && (
                <label>Mode
                  <select value={form.mode} onChange={(e) => { setForm({ ...form, mode: e.target.value }); setFormDirty(true); }}>
                    <option value="off">Off</option><option value="dry">Dry run</option><option value="test">Test</option>
                  </select>
                </label>
              )}
            </div>
            <div className="otr__row">
              <button type="button" className="ntf__btn ntf__btn--primary" onClick={saveSettings} disabled={!!busy || !formDirty}>Save</button>
              <button type="button" className="ntf__btn" onClick={sendTest} disabled={!!busy || !form.test_recipient || !form.calendly_url || !data.mailbox.configured}><Send size={15} /> Send test email</button>
              <button type="button" className="ntf__btn" onClick={sendAllTests} disabled={!!busy || !form.test_recipient || !form.calendly_url || !data.mailbox.configured}><Send size={15} /> Send all 3 tests</button>
              <span className="ntf__muted">New mailboxes warm up: 10 a day the first week, 20 the second, then your limit.</span>
            </div>
          </section>

          <section className="otr__panel">
            <h2 className="ntf__h2"><Eye size={18} /> The three emails</h2>
            <div className="otr__tabs" role="tablist">
              {[1, 2, 3].map((n) => <button key={n} type="button" role="tab" aria-selected={previewStep === n} className={`otr__tab ${previewStep === n ? 'otr__tab--on' : ''}`} onClick={() => setPreviewStep(n)}>{['Day 1: introduction', 'Day 4: follow-up', 'Day 9: final follow-up'][n - 1]}</button>)}
            </div>
            {preview && (
              <>
                <p className="otr__subject"><strong>Subject:</strong> {preview.subject}</p>
                <iframe title="Email preview" className="otr__frame" sandbox="" srcDoc={preview.html} />
              </>
            )}
          </section>

          <section className="otr__panel">
            <h2 className="ntf__h2"><FileUp size={18} /> Add leads</h2>
            <p className="ntf__muted">A CSV with the columns institution_name, contact_name (optional), email, country (or a time zone) and institution_type (optional). The country decides the time zone and the weekend.</p>
            <div className="otr__row">
              <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={pickFile} />
              <button type="button" className="ntf__btn" onClick={downloadTemplate}><Download size={15} /> CSV template</button>
              {csv && <button type="button" className="ntf__btn ntf__btn--primary" onClick={importCsv} disabled={!!busy || !csv.rows.length}>Import {csv.rows.length} rows</button>}
            </div>
            {csv && <p className="ntf__muted">{csv.name}: {csv.rows.length} rows found{csv.rows.length ? '' : '. Check the first row holds the column names.'}</p>}
          </section>

          <section className="ntf__cards" aria-label="Leads by status">
            {['new', 'in_sequence', 'completed', 'replied', 'unsubscribed', 'bounced', 'needs_timezone'].map((k) => (
              <button key={k} type="button" className={`ntf__card otr__stat ${statusFilter === k ? 'otr__stat--on' : ''}`} onClick={() => setStatusFilter(statusFilter === k ? 'all' : k)}>
                <strong>{data.counts[k] || 0}</strong><span>{STATUS_LABEL[k]}</span>
              </button>
            ))}
          </section>

          <h2 className="ntf__h2">Leads <span className="ntf__muted">({data.leads.length} shown)</span></h2>
          <div className="ntf__filters">
            <select className="ntf__select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
              <option value="all">All statuses</option>
              {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
            <label className="ntf__search"><Search size={15} /><input type="search" placeholder="Search institution or email" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
          </div>
          {data.leads.length === 0 ? <p className="ntf__empty">No leads yet. Add a CSV above.</p> : (
            <div className="ntf__table-wrap">
              <table className="ntf__table">
                <thead><tr><th>Institution</th><th>Contact</th><th>Country</th><th>Status</th><th>Emails sent</th><th>Next email</th><th /></tr></thead>
                <tbody>
                  {data.leads.map((l) => (
                    <tr key={l.id}>
                      <td><strong>{l.institution_name}</strong><br /><span className="ntf__muted">{l.email}</span></td>
                      <td>{l.contact_name || '-'}</td>
                      <td>{l.country || '-'}<br /><span className="ntf__muted">{l.timezone || ''}</span></td>
                      <td><span className={`otr__badge otr__badge--${l.status}`}>{STATUS_LABEL[l.status] || l.status}</span></td>
                      <td>{l.step} of 3</td>
                      <td>{l.status === 'in_sequence' ? when(l.next_send_at) : '-'}</td>
                      <td className="otr__actions">
                        {['new', 'in_sequence'].includes(l.status) && <button type="button" className="ntf__btn" disabled={!!busy} onClick={() => leadAction(l.id, 'stop', 'Stopped.')}>Stop</button>}
                        {['new', 'in_sequence', 'completed'].includes(l.status) && <button type="button" className="ntf__btn" disabled={!!busy} onClick={() => leadAction(l.id, 'replied', 'Marked as replied.')}>Replied</button>}
                        {l.status === 'stopped' && l.step === 0 && <button type="button" className="ntf__btn" disabled={!!busy} onClick={() => leadAction(l.id, 'restart', 'Restarted.')}>Restart</button>}
                        {!['unsubscribed', 'bounced'].includes(l.status) && <button type="button" className="ntf__btn" disabled={!!busy} onClick={() => leadAction(l.id, 'unsubscribe', 'Added to the do-not-email list.')}>Do not email</button>}
                        <button type="button" className="ntf__btn" disabled={!!busy} onClick={() => leadAction(l.id, 'delete', 'Deleted.')}>Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <h2 className="ntf__h2">Activity</h2>
          {data.events.length === 0 ? <p className="ntf__empty">Nothing has happened yet.</p> : (
            <div className="ntf__table-wrap">
              <table className="ntf__table">
                <thead><tr><th>When</th><th>What</th><th>Institution</th><th>Detail</th></tr></thead>
                <tbody>
                  {data.events.map((e) => (
                    <tr key={e.id}>
                      <td>{when(e.at)}</td>
                      <td><span className={`ntf__status ntf__status--${e.type === 'failed' || e.type === 'bounce' ? 'failed' : e.type === 'sent' || e.type === 'reply' ? 'sent' : 'pending'}`}>{EVENT_LABEL[e.type] || e.type}{e.step && ['sent', 'failed'].includes(e.type) ? ` (email ${e.step})` : ''}</span></td>
                      <td>{e.institution || '-'}<br /><span className="ntf__muted">{e.email || ''}</span></td>
                      <td className="ntf__muted">{e.detail?.error || e.detail?.subject || ''}</td>
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
