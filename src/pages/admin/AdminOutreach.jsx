import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle, ArrowRight, CalendarClock, Check, CheckCircle2, Download, Eye, FileUp, History, LayoutDashboard, Mail,
  Pause, RefreshCw, Rocket, Search, Send, Settings, Users, XCircle,
} from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import './AdminNotifications.css';
import './AdminOutreach.css';

// Super Admin: cold outreach to schools and universities. Three emails per institution (day 1, day 4, day 9), each
// sent in the recipient's own business hours. Everything goes through /api/notify-event (api/_outreachAdmin.js).
// Nothing on this page can send to a lead on a timer: only the hourly job does, and only after a test email and an
// explicit approval here. "Send now" is the Super Admin sending one email by hand.

const call = (action, body = {}) => apiPost('/api/notify-event', { action, ...body });
const when = (iso) => (iso ? new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '-');

const STATUS = {
  new: ['Not started', 'Added to the list, no email sent yet.'],
  in_sequence: ['In sequence', 'At least one email sent; the next one is scheduled.'],
  completed: ['Completed', 'All three emails sent.'],
  replied: ['Replied', 'Answered us. The sequence stopped.'],
  unsubscribed: ['Unsubscribed', 'Asked not to be emailed. Never emailed again.'],
  bounced: ['Bounced', 'The address does not work. Never emailed again.'],
  stopped: ['Stopped', 'Stopped by an admin.'],
  needs_timezone: ['Needs time zone', 'The country is unknown, so the right sending time cannot be worked out. Add a country or time zone.'],
};
const FUNNEL = ['new', 'in_sequence', 'completed', 'replied', 'unsubscribed', 'bounced', 'needs_timezone'];
const MODES = {
  off: ['Off', 'Nothing runs.'],
  dry: ['Dry run', 'Works out who would be emailed and when. Sends nothing.'],
  test: ['Test', 'Sends nothing on its own; only the test buttons send.'],
  live: ['Live', 'Sending the real sequence to leads.'],
};
const EVENT_LABEL = {
  sent: 'Email sent', failed: 'Send failed', reply: 'Replied', auto_reply: 'Auto-reply', bounce: 'Bounced', unsubscribed: 'Unsubscribed',
  test_sent: 'Test email sent', approved_live: 'Went live', paused: 'Paused', admin_stop: 'Stopped by admin', admin_replied: 'Marked replied',
  admin_unsubscribe: 'Marked do-not-email', admin_restart: 'Restarted', admin_delete: 'Deleted',
};
const STEP_NAME = ['Introduction', 'Follow-up', 'Final follow-up'];
const STEP_DAY = [1, 4, 9];
const TABS = [
  ['overview', 'Overview', LayoutDashboard],
  ['schedule', 'Schedule', CalendarClock],
  ['leads', 'Leads', Users],
  ['emails', 'Emails', Mail],
  ['settings', 'Settings', Settings],
  ['activity', 'Activity', History],
];

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

// ---- small building blocks ------------------------------------------------
function Section({ icon: Icon, title, desc, children }) {
  return (
    <section className="otr__panel">
      <header className="otr__panel-head">
        <h2 className="otr__panel-title">{Icon && <Icon size={18} />} {title}</h2>
        {desc && <p className="otr__desc">{desc}</p>}
      </header>
      {children}
    </section>
  );
}
function Field({ label, hint, children }) {
  return (
    <label className="otr__field">
      <span className="otr__field-label">{label}</span>
      {children}
      {hint && <span className="otr__hint">{hint}</span>}
    </label>
  );
}

export default function AdminOutreach() {
  const { user } = useAuth();
  const [tab, setTab] = useState(() => { try { return localStorage.getItem('otr_tab') || 'overview'; } catch { return 'overview'; } });
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
  const [previewLeadId, setPreviewLeadId] = useState('');
  const [csv, setCsv] = useState(null);
  const fileRef = useRef(null);

  const goTab = (t) => { setTab(t); try { localStorage.setItem('otr_tab', t); } catch { /* storage blocked */ } };
  const edit = (patch) => { setForm((f) => ({ ...f, ...patch })); setFormDirty(true); };

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

  const firstLeadId = data?.leads?.[0]?.id;
  useEffect(() => {
    if (!data?.migrated || tab !== 'emails') return;
    call('outreach-preview-email', { step: previewStep, lead_id: previewLeadId || firstLeadId || undefined }).then(setPreview).catch(() => setPreview(null));
  }, [previewStep, previewLeadId, tab, data?.migrated, data?.settings?.calendly_url, firstLeadId]);

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
    await call('outreach-send-test', { to: form.test_recipient, lead_id: previewLeadId || data?.leads?.[0]?.id });
  }, `Test email sent to ${form.test_recipient}. Check that inbox, and the spam folder.`);
  const sendAllTests = () => act('tests', async () => {
    if (formDirty) await call('outreach-update-settings', form);
    for (const step of [1, 2, 3]) await call('outreach-send-test', { to: form.test_recipient, step, lead_id: previewLeadId || data?.leads?.[0]?.id });
  }, `All 3 test emails sent to ${form.test_recipient}. Check that inbox, and the spam folder.`);
  const approve = () => {
    if (!window.confirm("Approve going live? From the next hourly run the system will email real schools and universities, within the daily limit.")) return;
    act('live', () => call('outreach-approve-live'), "Live. The first emails go out at the next hourly run, inside each recipient's business hours.");
  };
  const pause = () => act('pause', () => call('outreach-pause'), 'Paused: back to dry run. Nothing will be sent.');
  const sendNow = (row) => {
    const outside = row.businessNow ? '' : '\n\nNote: it is outside their business hours right now.';
    if (!window.confirm(`Send email ${row.step} of 3 to ${row.institution} now?${outside}`)) return;
    act(`now-${row.id}`, () => call('outreach-send-now', { id: row.id }), `Email ${row.step} sent to ${row.institution}.`);
  };
  const leadAction = (id, what, label) => {
    if (what === 'delete' && !window.confirm('Delete this lead? Its address stays on the do-not-email list if it was added there.')) return;
    act(`lead-${id}`, () => call('outreach-lead-action', { id, what }), label);
  };
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
  const downloadTemplate = () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([TEMPLATE_CSV], { type: 'text/csv' }));
    a.download = 'outreach-leads-template.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const s = data?.settings;
  const totalLeads = useMemo(() => (data?.migrated ? Object.values(data.counts).reduce((a, b) => a + b, 0) : 0), [data]);
  const checklist = useMemo(() => (data?.migrated ? [
    { ok: data.mailbox.configured, todo: 'Connect the mailbox', text: data.mailbox.configured ? `Mailbox connected (${data.mailbox.user})` : 'Mailbox not connected yet', fix: 'Add the mailbox password in Vercel (OUTREACH_SMTP_PASS).' },
    { ok: Boolean(s.calendly_url), todo: 'Add your Calendly link', text: s.calendly_url ? 'Calendly link set' : 'Calendly link not set', fix: 'Add it in Settings.', go: 'settings' },
    { ok: totalLeads > 0, todo: 'Add your leads', text: totalLeads > 0 ? `${totalLeads} leads added` : 'No leads added yet', fix: 'Upload your list in Leads.', go: 'leads' },
    { ok: Boolean(s.test_sent_at), todo: 'Send the test emails', text: s.test_sent_at ? `Test emails sent ${when(s.test_sent_at)}` : 'No test email sent yet', fix: 'Send the tests in Emails.', go: 'emails' },
    { ok: Boolean(s.live_approved_at), todo: 'Approve and go live', text: s.live_approved_at ? `Approved to go live ${when(s.live_approved_at)}` : 'Not approved to go live', fix: 'Press "Approve and go live" in Settings.', go: 'settings' },
  ] : []), [data, s, totalLeads]);

  if (user?.role !== ROLES.SUPER_ADMIN) return <div className="page-container"><p>You do not have access to this page.</p></div>;

  const live = s?.mode === 'live';
  const next = checklist.find((c) => !c.ok);
  const allowApprove = data?.migrated && checklist.slice(0, 4).every((c) => c.ok);

  return (
    <div className="page-container ntf otr">
      <div className="page-header">
        <div>
          <h1 className="page-title">Outreach</h1>
          <p className="page-subtitle">Introduce Certify.cx to schools and universities with a short email sequence. Each email goes at the right time in the recipient&apos;s own country, and the sequence stops as soon as someone replies or unsubscribes.</p>
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
          <section className={`otr__status otr__status--${s.mode}`} aria-label="Status">
            <div>
              <span className="otr__mode">{MODES[s.mode][0]}</span>
              <span className="otr__mode-text">{MODES[s.mode][1]}</span>
            </div>
            <div className="otr__status-nums">
              <span><strong>{data.sentTotal}</strong> sent in total</span>
              <span><strong>{data.sent24h}</strong> in the last 24 hours</span>
              <span>daily limit <strong>{data.effectiveDailyCap}</strong>{data.effectiveDailyCap < s.daily_cap ? ' (warming up)' : ''}</span>
              <span><strong>{data.suppressed}</strong> on the do-not-email list</span>
            </div>
          </section>

          <nav className="otr__tabbar" role="tablist" aria-label="Outreach sections">
            {TABS.map(([key, label, tabIcon]) => {
              const Icon = tabIcon;
              return (
                <button key={key} type="button" role="tab" aria-selected={tab === key} className={`otr__tabbtn ${tab === key ? 'otr__tabbtn--on' : ''}`} onClick={() => goTab(key)}>
                  <Icon size={16} /> {label}
                  {key === 'schedule' && data.schedule.length > 0 && <span className="otr__count">{data.schedule.length}</span>}
                  {key === 'leads' && totalLeads > 0 && <span className="otr__count">{totalLeads}</span>}
                </button>
              );
            })}
          </nav>

          {/* ------------------------------------------------------------ OVERVIEW */}
          {tab === 'overview' && (
            <>
              {live ? (
                <div className="otr__next otr__next--ok">
                  <CheckCircle2 size={22} />
                  <div><strong>Outreach is running.</strong><p>The system checks every hour and sends what is due. Open Schedule to see who is next, or pause it from Settings.</p></div>
                  <button type="button" className="ntf__btn" onClick={() => goTab('schedule')}>See the schedule <ArrowRight size={15} /></button>
                </div>
              ) : next && (
                <div className="otr__next">
                  <Rocket size={22} />
                  <div><strong>Next step: {next.todo}</strong><p>{next.fix} Complete all five steps below to go live.</p></div>
                  {next.go && <button type="button" className="ntf__btn ntf__btn--primary" onClick={() => goTab(next.go)}>Go there <ArrowRight size={15} /></button>}
                </div>
              )}

              <Section icon={CheckCircle2} title="Before going live" desc="Five things must be in place. Nothing is sent to a school or university until all five are done.">
                <ul className="otr__check">
                  {checklist.map((c) => (
                    <li key={c.text} className={c.ok ? 'otr__check--ok' : 'otr__check--no'}>
                      {c.ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}
                      <span>{c.text}{!c.ok && <span className="otr__muted"> - {c.fix}</span>}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section icon={Mail} title="How it works" desc="Every institution receives up to three emails, spaced out. The first email counts as day 1.">
                <div className="otr__steps">
                  {STEP_NAME.map((n, i) => (
                    <div key={n} className="otr__step">
                      <span className="otr__step-day">Day {STEP_DAY[i]}</span>
                      <strong>{n}</strong>
                      <span className="otr__muted">{['Introduces Certify.cx and ISO 21001 / ISO 9001.', 'A gentle reminder with the booking link.', 'A last short note and a request to point us to the right colleague.'][i]}</span>
                    </div>
                  ))}
                </div>
                <ul className="otr__rules">
                  <li>Sent only on the recipient&apos;s working days and between 09:30 and 15:30 their local time. Egypt and the Gulf rest on Friday and Saturday, the UAE on Saturday and Sunday.</li>
                  <li>It stops for a lead as soon as they reply, unsubscribe or the address bounces.</li>
                  <li>A new mailbox starts slowly (10 a day, then 20, then your limit) so it is not marked as spam.</li>
                </ul>
              </Section>

              <Section icon={Users} title="Progress" desc="Where your leads are right now. Click a box to see those leads.">
                <div className="otr__funnel">
                  {FUNNEL.map((k) => (
                    <button key={k} type="button" className="otr__stat" onClick={() => { setStatusFilter(k); goTab('leads'); }}>
                      <strong>{data.counts[k] || 0}</strong>
                      <span className="otr__stat-label">{STATUS[k][0]}</span>
                      <span className="otr__muted">{STATUS[k][1]}</span>
                    </button>
                  ))}
                </div>
              </Section>

              <Section icon={Send} title="Emails sent" desc="Every institution that has received an email, and which of the three emails it has had, with the date and time.">
                {data.sentLog.length === 0 ? <p className="ntf__empty">Nothing has been sent to any institution yet.</p> : (
                  <div className="ntf__table-wrap">
                    <table className="ntf__table">
                      <thead><tr><th>Institution</th><th>Email 1</th><th>Email 2</th><th>Email 3</th><th>Emails sent</th><th>Status</th></tr></thead>
                      <tbody>
                        {data.sentLog.map((l) => (
                          <tr key={l.id}>
                            <td><strong>{l.institution_name}</strong><br /><span className="ntf__muted">{l.email}</span></td>
                            {[1, 2, 3].map((n) => <td key={n}>{l.sent[n] ? <span className="otr__badge otr__badge--completed">{when(l.sent[n])}</span> : <span className="ntf__muted">-</span>}</td>)}
                            <td><strong>{Object.keys(l.sent).length}</strong> of 3</td>
                            <td><span className={`otr__badge otr__badge--${l.status}`}>{STATUS[l.status]?.[0] || l.status}</span></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Section>

              <Section icon={CalendarClock} title="Coming up next" desc="The next emails due, shown in the recipient's own time.">
                {data.schedule.length === 0 ? <p className="ntf__empty">Nothing scheduled yet. Add leads to see the plan.</p> : (
                  <div className="ntf__table-wrap">
                    <table className="ntf__table">
                      <thead><tr><th>Institution</th><th>Email</th><th>Their time</th></tr></thead>
                      <tbody>
                        {data.schedule.slice(0, 5).map((r) => (
                          <tr key={r.id}><td><strong>{r.institution}</strong><br /><span className="ntf__muted">{r.country || ''}</span></td><td>{STEP_NAME[r.step - 1]} (day {STEP_DAY[r.step - 1]})</td><td>{r.local}</td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {data.schedule.length > 5 && <button type="button" className="ntf__btn" onClick={() => goTab('schedule')}>See the full schedule <ArrowRight size={15} /></button>}
              </Section>
            </>
          )}

          {/* ------------------------------------------------------------ SCHEDULE */}
          {tab === 'schedule' && (
            <Section icon={CalendarClock} title="Schedule" desc="Who receives which email, and when. Times are shown in the recipient's own time and in yours. Follow-ups keep their day-4 and day-9 times; new leads are spread out so no day goes over the limit (an estimate: the real run also depends on the hourly limit). You can also send one yourself right now.">
              {!data.canSendNow && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> &quot;Send now&quot; is off: {data.sendNowBlockers.join('; ')}.</div>}
              {data.schedule.length === 0 ? <p className="ntf__empty">Nothing is scheduled. Add leads in the Leads tab.</p> : (
                <div className="ntf__table-wrap">
                  <table className="ntf__table">
                    <thead><tr><th>Institution</th><th>Country</th><th>Email</th><th>Their time</th><th>Your time</th><th>State</th><th /></tr></thead>
                    <tbody>
                      {data.schedule.map((r) => (
                        <tr key={r.id}>
                          <td><strong>{r.institution}</strong><br /><span className="ntf__muted">{r.email}</span></td>
                          <td>{r.country || '-'}<br /><span className="ntf__muted">{r.timezone}</span></td>
                          <td>{STEP_NAME[r.step - 1]}<br /><span className="ntf__muted">email {r.step} of 3, day {STEP_DAY[r.step - 1]}</span></td>
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
            </Section>
          )}

          {/* ------------------------------------------------------------ LEADS */}
          {tab === 'leads' && (
            <>
              <Section icon={FileUp} title="Add leads" desc="Upload a CSV file with one row per institution. The country decides the time zone and the weekend, so each email goes at a sensible hour. Duplicates, invalid addresses and anyone on the do-not-email list are skipped and counted.">
                <p className="otr__muted">Columns: institution_name, contact_name (optional), email, country (or a time zone) and institution_type (optional). Up to 2000 rows at a time.</p>
                <div className="otr__row">
                  <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={pickFile} />
                  <button type="button" className="ntf__btn" onClick={downloadTemplate}><Download size={15} /> Download CSV template</button>
                  {csv && <button type="button" className="ntf__btn ntf__btn--primary" onClick={importCsv} disabled={!!busy || !csv.rows.length}>Import {csv.rows.length} rows</button>}
                </div>
                {csv && <p className="otr__muted">{csv.name}: {csv.rows.length} rows found{csv.rows.length ? '. Press Import to add them.' : '. Check that the first row holds the column names.'}</p>}
              </Section>

              <Section icon={Users} title="Your leads" desc="Every institution on the list and where it is in the sequence. Use the buttons to stop one, mark it as replied (for example after a Calendly booking), or put it on the do-not-email list.">
                <div className="ntf__filters">
                  <select className="ntf__select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Status">
                    <option value="all">All statuses</option>
                    {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v[0]}</option>)}
                  </select>
                  <label className="ntf__search"><Search size={15} /><input type="search" placeholder="Search institution or email" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
                </div>
                {data.leads.length === 0 ? <p className="ntf__empty">No leads match. Upload a CSV above.</p> : (
                  <div className="ntf__table-wrap">
                    <table className="ntf__table">
                      <thead><tr><th>Institution</th><th>Contact</th><th>Country</th><th>Status</th><th>Emails sent</th><th>Next email</th><th /></tr></thead>
                      <tbody>
                        {data.leads.map((l) => (
                          <tr key={l.id}>
                            <td><strong>{l.institution_name}</strong><br /><span className="ntf__muted">{l.email}</span></td>
                            <td>{l.contact_name || '-'}</td>
                            <td>{l.country || '-'}<br /><span className="ntf__muted">{l.timezone || ''}</span></td>
                            <td><span className={`otr__badge otr__badge--${l.status}`} title={STATUS[l.status]?.[1]}>{STATUS[l.status]?.[0] || l.status}</span></td>
                            <td>{[1, 2, 3].filter((n) => l.sent?.[n]).length === 0 ? <span className="ntf__muted">None yet</span> : [1, 2, 3].filter((n) => l.sent?.[n]).map((n) => <div key={n}><span className="otr__badge otr__badge--completed">Email {n}</span> <span className="ntf__muted">{when(l.sent[n])}</span></div>)}</td>
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
              </Section>
            </>
          )}

          {/* ------------------------------------------------------------ EMAILS */}
          {tab === 'emails' && (
            <>
              <Section icon={Eye} title="The three emails" desc="Exactly what a school or university will receive. The preview uses the institution you pick below; each real email uses that institution's own name. Every email carries your Calendly link, and emails 2 and 3 carry an unsubscribe link.">
                <div className="otr__tabs" role="tablist">
                  {[1, 2, 3].map((n) => <button key={n} type="button" role="tab" aria-selected={previewStep === n} className={`otr__tab ${previewStep === n ? 'otr__tab--on' : ''}`} onClick={() => setPreviewStep(n)}>Day {STEP_DAY[n - 1]}: {STEP_NAME[n - 1]}</button>)}
                </div>
                <label className="otr__field">
                  <span className="otr__field-label">Preview as</span>
                  <select value={previewLeadId || data.leads[0]?.id || ''} onChange={(e) => setPreviewLeadId(e.target.value)} disabled={data.leads.length === 0}>
                    {data.leads.length === 0 && <option value="">Sample university (add leads to preview real names)</option>}
                    {data.leads.map((l) => <option key={l.id} value={l.id}>{l.institution_name}</option>)}
                  </select>
                </label>
                {preview && (
                  <>
                    <p className="otr__subject"><strong>Subject:</strong> {preview.subject}</p>
                    <iframe title="Email preview" className="otr__frame" sandbox="" srcDoc={preview.html} />
                  </>
                )}
              </Section>

              <Section icon={Send} title="Send a test" desc="Before going live, send the three emails to your own inbox to check how they look and that they do not land in spam. Test emails go only to the address below, never to a lead. This is required before you can go live.">
                <div className="otr__form">
                  <Field label="Send the test to" hint="Your own email address."><input type="email" placeholder="you@certify.cx" value={form.test_recipient} onChange={(e) => edit({ test_recipient: e.target.value })} /></Field>
                  <Field label="Calendly link" hint="Shown in every email. Set it in Settings."><input type="text" value={form.calendly_url || 'Not set'} disabled /></Field>
                </div>
                <div className="otr__row">
                  <button type="button" className="ntf__btn" onClick={sendTest} disabled={!!busy || !form.test_recipient || !form.calendly_url || !data.mailbox.configured}><Send size={15} /> Send email 1 only</button>
                  <button type="button" className="ntf__btn ntf__btn--primary" onClick={sendAllTests} disabled={!!busy || !form.test_recipient || !form.calendly_url || !data.mailbox.configured}><Send size={15} /> Send all 3 tests</button>
                  {s.test_sent_at && <span className="otr__muted">Last test: {when(s.test_sent_at)}</span>}
                </div>
                {(!data.mailbox.configured || !form.calendly_url) && <p className="otr__muted">Needs: {[!data.mailbox.configured && 'the mailbox connected', !form.calendly_url && 'a Calendly link'].filter(Boolean).join(' and ')}.</p>}
              </Section>
            </>
          )}

          {/* ------------------------------------------------------------ SETTINGS */}
          {tab === 'settings' && (
            <>
              <Section icon={Rocket} title="Go live" desc="Starts the real sequence. The system then checks every hour and sends what is due, inside each recipient's business hours. You can pause at any time. Nothing sends until the checks below are green.">
                <ul className="otr__check">
                  {checklist.map((c) => <li key={c.text} className={c.ok ? 'otr__check--ok' : 'otr__check--no'}>{c.ok ? <CheckCircle2 size={17} /> : <XCircle size={17} />}<span>{c.text}</span></li>)}
                </ul>
                <div className="otr__row">
                  {live
                    ? <button type="button" className="ntf__btn" onClick={pause} disabled={!!busy}><Pause size={15} /> Pause sending</button>
                    : <button type="button" className="ntf__btn ntf__btn--primary" onClick={approve} disabled={!!busy || !allowApprove}><Rocket size={15} /> Approve and go live</button>}
                  {!live && !allowApprove && <span className="otr__muted">Finish the first four checks to enable this button.</span>}
                </div>
              </Section>

              <Section icon={Settings} title="Sending settings" desc="How the emails are sent. Changes apply from the next hourly run.">
                <div className="otr__form">
                  <Field label="Calendly link" hint="The booking page linked in every email."><input type="url" placeholder="https://calendly.com/..." value={form.calendly_url} onChange={(e) => edit({ calendly_url: e.target.value })} /></Field>
                  <Field label="Most emails a day" hint="The most that go out in 24 hours. A new mailbox starts lower on its own (10 a day, then 20) and grows to this."><input type="number" min="1" max="500" value={form.daily_cap} onChange={(e) => edit({ daily_cap: Number(e.target.value) })} /></Field>
                  <Field label="Most emails an hour" hint="Spreads sending through the day so it looks natural."><input type="number" min="1" max="60" value={form.hourly_cap} onChange={(e) => edit({ hourly_cap: Number(e.target.value) })} /></Field>
                  {!live && (
                    <Field label="Mode" hint="Off: nothing runs. Dry run: works out who would be emailed, sends nothing. Test: only the test buttons send.">
                      <select value={form.mode} onChange={(e) => edit({ mode: e.target.value })}>
                        <option value="off">Off</option><option value="dry">Dry run</option><option value="test">Test</option>
                      </select>
                    </Field>
                  )}
                </div>
                <div className="otr__row">
                  <button type="button" className="ntf__btn ntf__btn--primary" onClick={saveSettings} disabled={!!busy || !formDirty}>Save settings</button>
                  {formDirty && <span className="otr__muted">You have unsaved changes.</span>}
                </div>
              </Section>

              <Section icon={Mail} title="Mailbox" desc="The address the emails are sent from. Replies arrive in this mailbox, and the system reads it every hour to stop the sequence for anyone who answers.">
                <dl className="otr__kv">
                  <div><dt>Sends from</dt><dd>{data.mailbox.user || 'Not set'}</dd></div>
                  <div><dt>Mail server</dt><dd>{data.mailbox.host || 'Not set'}</dd></div>
                  <div><dt>Connection</dt><dd className={data.mailbox.configured ? 'otr__check--ok' : 'otr__check--no'}>{data.mailbox.configured ? 'Connected' : 'Not connected: add OUTREACH_SMTP_PASS in Vercel'}</dd></div>
                  <div><dt>Replies last read</dt><dd>{when(s.last_reply_check_at)}</dd></div>
                </dl>
              </Section>
            </>
          )}

          {/* ------------------------------------------------------------ ACTIVITY */}
          {tab === 'activity' && (
            <Section icon={History} title="Activity" desc="A record of everything the system and the admins have done: emails sent, replies, bounces, unsubscribes, tests and changes. The latest 60 entries.">
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
            </Section>
          )}
        </>
      )}
    </div>
  );
}
