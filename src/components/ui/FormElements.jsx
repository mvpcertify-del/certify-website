import { Loader2 } from 'lucide-react';
import './FormElements.css';
export { Autocomplete } from './Autocomplete';

export function Input({ label, error, id, rightElement, ...props }) {
  const isLtrType = props.type === 'email' || props.type === 'password' || props.type === 'url' || props.type === 'tel' || props.type === 'number';
  const inputStyle = {
    ...(rightElement ? { paddingRight: '40px' } : {}),
    ...(isLtrType ? { direction: 'ltr', textAlign: 'left', unicodeBidi: 'plaintext' } : {}),
  };
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          className={`form-input ${error ? 'form-input--error' : ''}`}
          style={inputStyle}
          id={id}
          {...props}
        />
        {rightElement && (
          <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', display: 'flex', alignItems: 'center', color: 'var(--color-text-tertiary)' }}>
            {rightElement}
          </div>
        )}
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export function Select({ label, error, id, children, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <select className={`form-select ${error ? 'form-select--error' : ''}`} id={id} {...props}>
        {children}
      </select>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export function Textarea({ label, error, id, ...props }) {
  return (
    <div className="form-group">
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <textarea className={`form-textarea ${error ? 'form-textarea--error' : ''}`} id={id} {...props} />
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}

export function Button({ children, variant = 'primary', size = 'md', loading = false, fullWidth = false, ...props }) {
  // `disabled` is applied AFTER {...props}, not before. Spreading a `disabled`
  // of undefined over an earlier one un-disabled the button, so `loading` never
  // actually blocked a second click and every form using this component could
  // be double-submitted while its first request was still in flight.
  return (
    <button
      className={`form-btn form-btn--${variant} form-btn--${size} ${fullWidth ? 'form-btn--full' : ''}`}
      {...props}
      disabled={loading || props.disabled || false}
    >
      {loading && <Loader2 size={16} className="form-btn__spinner" />}
      {children}
    </button>
  );
}
