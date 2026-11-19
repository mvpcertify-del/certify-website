import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Check, X, AlertCircle, ExternalLink } from 'lucide-react';
import { apiPost } from '../../lib/apiClient';
import { useAuth } from '../../contexts/AuthContext';
import { ROLES } from '../../utils/roles';
import './AdminNotifications.css';

// Super Admin > Sales > Micro Offer Requests.
// The requests that arrive from the public "What's your budget?" page (/micro/budget). Approve or decline each one:
// the company is told by email. The reply is promised within 3 hours, so pending requests are listed first.

const call = (action, body = {}) => apiPost('/api/notify-event', { action, ...body });
const when = (iso) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const STATUS = { pending: 'Waiting for a decision', approved: 'Approved', declined: 'Declined' };

export default function AdminMicroOffers() {
  const { user } = useAuth();
  const [rows, setRows] = useState([]);
  const [filter, setFilter] = useState('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [deciding, setDeciding] = useState(null); // { id, decision, note }

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try { setRows((await call('micro-offer-list')).requests || []); } catch (e) { setError(e.message || 'Could not load.'); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => rows.reduce((c, r) => ({ ...c, [r.status]: (c[r.status] || 0) + 1 }), {}), [rows]);
  const shown = useMemo(() => rows.filter((r) => filter === 'all' || r.status === filter), [rows, filter]);

  const decide = async () => {
    setBusy(deciding.id);
    setError('');
    setNotice('');
    try {
      const out = await call('micro-offer-decide', deciding);
      setNotice(out.emailed ? `Saved, and the company was told by email.` : 'Saved, but the email could not be sent. Please contact the company yourself.');
      setDeciding(null);
      await load();
    } catch (e) {
      setError(e.message || 'That did not work.');
    } finally {
      setBusy('');
    }
  };

  if (user?.role !== ROLES.SUPER_ADMIN) return <div className="page-container"><p>You do not have access to this page.</p></div>;

  return (
    <div className="page-container ntf">
      <div className="page-header">
        <div>
          <h1 className="page-title">Micro Offer Requests</h1>
          <p className="page-subtitle">Requests from the &quot;What&apos;s your budget?&quot; page: ISO 9001 for companies with 1 to 9 employees and 1 location, $500 to $1,500. Reply within 3 hours. Approve or decline, and the company is told by email.</p>
        </div>
        <div className="ntf__actions">
          <a className="ntf__btn" href="/micro/budget" target="_blank" rel="noopener noreferrer"><ExternalLink size={15} /> Open the offer page</a>
          <button type="button" className="ntf__btn" onClick={load} disabled={loading}><RefreshCw size={15} /> Refresh</button>
        </div>
      </div>

      {error && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> {error}</div>}
      {notice && !error && <div className="ntf__alert ntf__alert--ok"><Check size={16} /> {notice}</div>}

      <div className="ntf__filters">
        <select className="ntf__select" value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Status">
          <option value="pending">Waiting for a decision ({counts.pending || 0})</option>
          <option value="approved">Approved ({counts.approved || 0})</option>
          <option value="declined">Declined ({counts.declined || 0})</option>
          <option value="all">All ({rows.length})</option>
        </select>
      </div>

      {loading && rows.length === 0 ? <p className="ntf__muted">Loading...</p> : shown.length === 0 ? (
        <p className="ntf__empty">{filter === 'pending' ? 'No request is waiting. New ones appear here, and you get an email and a notification.' : 'Nothing here.'}</p>
      ) : (
        <div className="ntf__table-wrap">
          <table className="ntf__table">
            <thead><tr><th>Company</th><th>Contact</th><th>Details</th><th>Budget</th><th>Received</th><th>Status</th><th /></tr></thead>
            <tbody>
              {shown.map((r) => (
                <Fragment key={r.id}>
                  <tr>
                    <td><strong>{r.company_name}</strong><br />{r.website ? <a href={r.website} target="_blank" rel="noopener noreferrer" className="ntf__muted">{r.website}</a> : <span className="ntf__muted">no website</span>}</td>
                    <td>{r.contact_name}<br /><span className="ntf__muted">{r.job_title}</span><br /><a href={`mailto:${r.email}`}>{r.email}</a><br /><span className="ntf__muted">{r.phone}</span></td>
                    <td>{r.employees} employee{r.employees === 1 ? '' : 's'}, 1 location<br /><span className="ntf__muted">{r.main_activity}</span>{r.message && <><br /><span className="ntf__muted">&quot;{r.message}&quot;</span></>}</td>
                    <td><strong>${r.budget_usd.toLocaleString('en-US')}</strong><br /><span className="ntf__muted">{r.standard}</span></td>
                    <td>{when(r.created_at)}</td>
                    <td>{STATUS[r.status]}{r.decided_at && <><br /><span className="ntf__muted">{when(r.decided_at)}</span></>}{r.decision_note && <><br /><span className="ntf__muted">{r.decision_note}</span></>}</td>
                    <td>
                      {r.status === 'pending' && (
                        <div className="ntf__actions">
                          <button type="button" className="ntf__btn ntf__btn--primary" disabled={!!busy} onClick={() => setDeciding({ id: r.id, decision: 'approved', note: '' })}><Check size={14} /> Approve</button>
                          <button type="button" className="ntf__btn" disabled={!!busy} onClick={() => setDeciding({ id: r.id, decision: 'declined', note: '' })}><X size={14} /> Decline</button>
                        </div>
                      )}
                    </td>
                  </tr>
                  {deciding?.id === r.id && (
                    <tr>
                      <td colSpan={7}>
                        <div className="ntf__panel">
                          <strong>{deciding.decision === 'approved' ? `Approve ${r.company_name} at $${r.budget_usd}?` : `Decline ${r.company_name}?`}</strong>
                          <p className="ntf__muted">{r.contact_name} will be told by email at {r.email}. You can add a short note, which is included in that email.</p>
                          <textarea className="ntf__input" rows={3} maxLength={600} placeholder="Optional note to the company" value={deciding.note} onChange={(e) => setDeciding({ ...deciding, note: e.target.value })} style={{ width: '100%' }} />
                          <div className="ntf__actions">
                            <button type="button" className="ntf__btn ntf__btn--primary" disabled={!!busy} onClick={decide}>{busy ? 'Sending...' : (deciding.decision === 'approved' ? 'Approve and send the email' : 'Decline and send the email')}</button>
                            <button type="button" className="ntf__btn" disabled={!!busy} onClick={() => setDeciding(null)}>Cancel</button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
