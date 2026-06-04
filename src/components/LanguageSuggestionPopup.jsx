import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Globe, X } from 'lucide-react';
import { detectLanguageFromRegion, applyDocumentDirection } from '../utils/regionLanguage.js';
import './LanguageSuggestionPopup.css';

export default function LanguageSuggestionPopup() {
  const { t, i18n } = useTranslation();
  const [show, setShow] = useState(false);
  const [suggestedLang, setSuggestedLang] = useState(null);

  useEffect(() => {
    // Don't show if user already chose a language
    const dismissed = localStorage.getItem('certifycx-lang-popup-dismissed');
    const currentLang = i18n.language;

    if (dismissed || currentLang !== 'en') {
      return;
    }

    let cancelled = false;
    let timer;
    detectLanguageFromRegion().then((detected) => {
      if (cancelled) return;
      if (!detected || detected === 'en' || detected === currentLang) return;
      setSuggestedLang(detected);
      timer = setTimeout(() => setShow(true), 1500);
    });
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [i18n.language]);

  const handleSwitch = () => {
    i18n.changeLanguage(suggestedLang);
    localStorage.setItem('certifycx-lang', suggestedLang);
    localStorage.setItem('certifycx-lang-popup-dismissed', 'true');
    applyDocumentDirection(suggestedLang);
    setShow(false);
  };

  const handleDismiss = () => {
    localStorage.setItem('certifycx-lang-popup-dismissed', 'true');
    setShow(false);
  };

  if (!show || !suggestedLang) return null;

  const LANG_NAME_KEY = { ar: 'arabic', es: 'spanish', ru: 'russian', fr: 'french', pt: 'portuguese', de: 'german', zh: 'chinese', hi: 'hindi' };
  const LANG_MESSAGE_KEY = { ar: 'messageAr', es: 'messageEs', ru: 'messageRu', fr: 'messageFr', pt: 'messagePt', de: 'messageDe', zh: 'messageZh', hi: 'messageHi' };
  const langName = t(`languageSuggestion.${LANG_NAME_KEY[suggestedLang] || 'arabic'}`);
  const message = t(`languageSuggestion.${LANG_MESSAGE_KEY[suggestedLang] || 'messageAr'}`);

  return (
    <div className="lang-popup-overlay">
      <div className="lang-popup">
        <button className="lang-popup__close" onClick={handleDismiss} aria-label="Close">
          <X size={18} />
        </button>
        <div className="lang-popup__icon">
          <Globe size={28} />
        </div>
        <h3 className="lang-popup__title">{t('languageSuggestion.title')}</h3>
        <p className="lang-popup__message">{message}</p>
        <div className="lang-popup__actions">
          <button className="lang-popup__btn lang-popup__btn--primary" onClick={handleSwitch}>
            {t('languageSuggestion.switchTo', { language: langName })}
          </button>
          <button className="lang-popup__btn lang-popup__btn--secondary" onClick={handleDismiss}>
            {t('languageSuggestion.keepEnglish')}
          </button>
        </div>
      </div>
    </div>
  );
}
