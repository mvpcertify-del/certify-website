import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import './FormElements.css';

// An option may be a plain string (the original behaviour) OR an object with a
// `.label` plus extra fields (e.g. the city autocomplete's { label, city,
// country, countryCode }). optLabel() reads either shape so nothing below has
// to care which it got.
const optLabel = (opt) => (typeof opt === 'string' ? opt : (opt?.label ?? ''));

export function Autocomplete({
  label,
  error,
  id,
  name,
  options = [],
  value = '',
  onChange,
  // Fires with the FULL selected option (string or object) so a caller can
  // read structured fields — used to fill city + country + dial code from one
  // pick. `onChange` still fires with the display string for backward compat.
  onSelect,
  placeholder = 'Select option...',
  required = false,
  freeSolo = false,
  fetchOptions
}) {
  const fieldName = name || id;
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value);
  const [internalOptions, setInternalOptions] = useState(options);
  const [isLoading, setIsLoading] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (!fetchOptions) {
      setInternalOptions(options);
    }
  }, [options, fetchOptions]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        if (!freeSolo) {
          const matchingOption = internalOptions.find(opt => optLabel(opt).toLowerCase() === inputValue.toLowerCase());
          if (matchingOption) {
            const lbl = optLabel(matchingOption);
            if (onChange) onChange({ target: { name: fieldName, value: lbl } });
            if (onSelect) onSelect(matchingOption);
            setInputValue(lbl);
          } else {
            setInputValue(value);
          }
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [inputValue, internalOptions, freeSolo, value, onChange, onSelect, fieldName]);

  const handleInputChange = async (e) => {
    const val = e.target.value;
    setInputValue(val);
    setIsOpen(true);
    
    if (freeSolo && onChange) {
      onChange({ target: { name: fieldName, value: val } });
    }

    if (fetchOptions) {
      if (val.trim().length >= 2) {
        setIsLoading(true);
        try {
          const results = await fetchOptions(val);
          setInternalOptions(results || []);
        } catch (err) {
          console.error('Fetch options error:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        setInternalOptions([]);
      }
    }
  };

  const handleOptionClick = (option) => {
    const lbl = optLabel(option);
    setInputValue(lbl);
    if (onChange) onChange({ target: { name: fieldName, value: lbl } });
    if (onSelect) onSelect(option);
    setIsOpen(false);
  };

  const displayOptions = fetchOptions
    ? internalOptions
    : internalOptions.filter(opt => optLabel(opt).toLowerCase().includes(inputValue.toLowerCase()));

  return (
    <div className="form-group" ref={containerRef}>
      {label && <label className="form-label" htmlFor={id}>{label}</label>}
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          className={`form-input ${error ? 'form-input--error' : ''}`}
          style={{ paddingRight: '40px', width: '100%', boxSizing: 'border-box' }}
          placeholder={placeholder}
          value={inputValue}
          onChange={handleInputChange}
          onClick={() => {
            setIsOpen(true);
            if (fetchOptions && internalOptions.length === 0 && inputValue.length >= 2) {
              handleInputChange({ target: { value: inputValue } });
            }
          }}
          required={required}
          autoComplete="off"
        />
        <div style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-tertiary)', pointerEvents: 'none', display: 'flex' }}>
          {isLoading ? <Loader2 size={16} className="form-btn__spinner" /> : <ChevronDown size={18} />}
        </div>
        
        {isOpen && (
          <div className="autocomplete-dropdown">
            {isLoading ? (
              <div className="autocomplete-no-opts">Loading...</div>
            ) : displayOptions.length > 0 ? (
              displayOptions.map((opt, idx) => (
                <div
                  key={idx}
                  className={`autocomplete-option ${optLabel(opt) === value ? 'autocomplete-option--selected' : ''}`}
                  onClick={() => handleOptionClick(opt)}
                >
                  {optLabel(opt)}
                </div>
              ))
            ) : (
              <div className="autocomplete-no-opts">{fetchOptions && inputValue.length < 2 ? 'Type to search...' : 'No options found'}</div>
            )}
          </div>
        )}
      </div>
      {error && <span className="form-error">{error}</span>}
    </div>
  );
}
