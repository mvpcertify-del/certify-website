import { useCallback, useState } from 'react';
import { apiPost } from '../../lib/apiClient';

// Helpers shared by the QMS pages (no components here).

export const call = (action, body = {}) => apiPost('/api/notify-event', { action, ...body });

export const fmtDate = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
export const fmtTime = (d) => (d ? new Date(d).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');
export const today = () => new Date().toISOString().slice(0, 10);

// The clauses of ISO 9001 (the same list as api/_qmsMaster.js, for the pickers).
export const CLAUSES = [
  ['4.1', 'Context of the organization'], ['4.2', 'Interested parties'], ['4.3', 'Scope of the QMS'], ['4.4', 'QMS and its processes'],
  ['5.1', 'Leadership and commitment'], ['5.2', 'Quality policy'], ['5.3', 'Roles and responsibilities'],
  ['6.1', 'Risks and opportunities'], ['6.2', 'Quality objectives'], ['6.3', 'Planning of changes'],
  ['7.1', 'Resources'], ['7.2', 'Competence'], ['7.3', 'Awareness'], ['7.4', 'Communication'], ['7.5', 'Documented information'],
  ['8.1', 'Operational planning and control'], ['8.2', 'Requirements for products and services'], ['8.3', 'Design and development'],
  ['8.4', 'External providers'], ['8.5', 'Production and service provision'], ['8.6', 'Release'], ['8.7', 'Nonconforming outputs'],
  ['9.1', 'Monitoring and measurement'], ['9.2', 'Internal audit'], ['9.3', 'Management review'],
  ['10.1', 'Improvement: general'], ['10.2', 'Nonconformity and corrective action'], ['10.3', 'Continual improvement'],
];

const NAME = { in_review: 'In review', in_progress: 'In progress', root_cause: 'Root cause', minor_nc: 'Minor NC', major_nc: 'Major NC', none: 'Not started', partial: 'In progress', ready: 'Ready' };
export const label = (v) => NAME[v] || String(v || '').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

// run(fn, okMessage) wraps a request: busy flag, error and notice. A { ok:false, errors } answer becomes the error text.
export function useRunner() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [errors, setErrors] = useState({});
  const run = useCallback(async (fn, okMsg) => {
    setBusy(true); setError(''); setNotice(''); setErrors({});
    try {
      const out = await fn();
      if (out && out.ok === false) {
        setErrors(out.errors || {});
        if (out.errors?._ || out.errors?.status) setError(out.errors._ || out.errors.status);
        return null;
      }
      if (okMsg) setNotice(typeof okMsg === 'function' ? okMsg(out) : okMsg);
      return out || {};
    } catch (e) { setError(e.message || 'That did not work.'); return null; } finally { setBusy(false); }
  }, []);
  return { busy, error, notice, errors, run, setError, setNotice, setErrors };
}
