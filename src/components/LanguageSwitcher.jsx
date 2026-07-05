import { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, ChevronDown, Check } from 'lucide-react';
import './LanguageSwitcher.css';

const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ru', label: 'Русский', flag: '🇷🇺' },
  { code: 'pt', label: 'Português', flag: '🇧🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'hi', label: 'हिन्दी', flag: '🇮🇳' },
];

export default function LanguageSwitcher({ variant = 'default' }) {
  const { i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const currentLang = LANGUAGES.find(l => l.code === i18n.language) || LANGUAGES[0];

  useEffect(() => {
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const switchLanguage = (code) => {
    i18n.changeLanguage(code);
    localStorage.setItem('certifycx-lang', code);
    // Mark this as an explicit manual choice so the IP/region auto-detector
    // stops overriding it on subsequent loads.
    localStorage.setItem('certifycx-lang-manual', '1');
    document.documentElement.dir = code === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = code;
    setOpen(false);
  };

  const variantClass = variant === 'landing'
    ? 'lang-switcher--landing'
    : variant === 'sidebar'
      ? 'lang-switcher--sidebar'
      : '';

  return (
    <div className={`lang-switcher ${variantClass}`} ref={ref}>
      <button
        className="lang-switcher__trigger"
        onClick={() => setOpen(!open)}
        aria-label="Select language"
      >
        <Globe size={16} />
        <span className="lang-switcher__flag">{currentLang.flag}</span>
        <span className="lang-switcher__label">{currentLang.label}</span>
        <ChevronDown size={14} className={`lang-switcher__chevron ${open ? 'lang-switcher__chevron--open' : ''}`} />
      </button>
      {open && (
        <div className="lang-switcher__menu">
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              className={`lang-switcher__item ${lang.code === i18n.language ? 'lang-switcher__item--active' : ''}`}
              onClick={() => switchLanguage(lang.code)}
            >
              <span>{lang.flag}</span>
              <span>{lang.label}</span>
              {lang.code === i18n.language && (
                <Check size={14} className="lang-switcher__check" />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
