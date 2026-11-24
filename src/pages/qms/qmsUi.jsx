import { AlertCircle, Check, X } from 'lucide-react';
import { CLAUSES, label } from './qmsLib';
import '../admin/AdminNotifications.css';
import './Qms.css';

// Shared pieces of the QMS pages (Super Admin).

const TONE = {
  ready: 'ok', approved: 'ok', closed: 'ok', completed: 'ok', held: 'ok', done: 'ok', verified: 'ok', conformity: 'ok', low: 'ok', mitigating: 'info',
  partial: 'warn', in_review: 'warn', open: 'warn', planned: 'info', in_progress: 'warn', medium: 'warn', observation: 'info', opportunity: 'info', minor: 'warn', minor_nc: 'warn',
  none: 'bad', major: 'bad', major_nc: 'bad', high: 'bad', obsolete: 'muted', superseded: 'muted', draft: 'muted', accepted: 'muted',
};
export function Chip({ value, text }) {
  return <span className={`q-chip q-chip--${TONE[value] || 'muted'}`}>{text || label(value)}</span>;
}

export function Field({ label: l, error, hint, children, wide }) {
  return (
    <label className={`q-field${wide ? ' q-field--wide' : ''}`}>
      <span className="q-field__label">{l}</span>
      {children}
      {hint && !error && <span className="q-field__hint">{hint}</span>}
      {error && <span className="q-field__err">{error}</span>}
    </label>
  );
}

export function Select({ value, onChange, options, empty }) {
  return (
    <select className="ntf__select q-input" value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
      {empty !== undefined && <option value="">{empty}</option>}
      {options.map((o) => (Array.isArray(o) ? <option key={o[0]} value={o[0]}>{o[1]}</option> : <option key={o} value={o}>{label(o)}</option>))}
    </select>
  );
}

export function ClauseSelect({ value, onChange, empty = 'No clause' }) {
  return <Select value={value} onChange={onChange} empty={empty} options={CLAUSES.map(([n, t]) => [n, `${n} ${t}`])} />;
}

export function ClauseMulti({ value = [], onChange }) {
  const set = new Set(value);
  return (
    <div className="q-clauses">
      {CLAUSES.map(([n, t]) => (
        <button type="button" key={n} title={t} className={`q-clause${set.has(n) ? ' q-clause--on' : ''}`}
          onClick={() => { const s = new Set(value); if (s.has(n)) s.delete(n); else s.add(n); onChange([...s].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))); }}>{n}</button>
      ))}
    </div>
  );
}

export function Panel({ title, onClose, children, wide }) {
  return (
    <div className="q-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`q-panel${wide ? ' q-panel--wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="q-panel__head"><h2>{title}</h2><button type="button" className="q-x" onClick={onClose} aria-label="Close"><X size={18} /></button></div>
        <div className="q-panel__body">{children}</div>
      </div>
    </div>
  );
}

export function Alerts({ error, notice }) {
  return (
    <>
      {error && <div className="ntf__alert ntf__alert--bad"><AlertCircle size={16} /> {error}</div>}
      {notice && !error && <div className="ntf__alert ntf__alert--ok"><Check size={16} /> {notice}</div>}
    </>
  );
}

