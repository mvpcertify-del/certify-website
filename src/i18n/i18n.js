import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import ar from './locales/ar.json';
import es from './locales/es.json';
import ru from './locales/ru.json';
import fr from './locales/fr.json';
import pt from './locales/pt.json';
import de from './locales/de.json';
import zh from './locales/zh.json';
import hi from './locales/hi.json';
import {
  detectLanguageFromRegionSync,
  detectLanguageFromRegion,
  applyDocumentDirection,
  SUPPORTED_LANGUAGES,
} from '../utils/regionLanguage.js';

const STORAGE_KEY = 'certifycx-lang';

// Custom detector that resolves the default language from the visitor's region
// (Lebanon → ar, Mexico → es, India → en, …). Only kicks in when the user has
// not already made a manual choice. Uses synchronous signals (cache, timezone,
// browser locale) so the first render is in the right language; an async IP
// lookup runs afterward to correct the choice when those signals are missing.
const regionDetector = {
  name: 'region',
  lookup() {
    return detectLanguageFromRegionSync();
  },
  cacheUserLanguage() {
    /* persistence is handled by the localStorage detector */
  },
};

const detector = new LanguageDetector();
detector.addDetector(regionDetector);

i18n
  .use(detector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ar: { translation: ar },
      es: { translation: es },
      ru: { translation: ru },
      fr: { translation: fr },
      pt: { translation: pt },
      de: { translation: de },
      zh: { translation: zh },
      hi: { translation: hi },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'ar', 'es', 'ru', 'fr', 'pt', 'de', 'zh', 'hi'],
    nonExplicitSupportedLngs: true,
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'region', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: STORAGE_KEY,
    },
  });

applyDocumentDirection(i18n.language);

i18n.on('languageChanged', applyDocumentDirection);

// Async refinement: if the user has not made a manual choice, upgrade to the
// IP-derived language once it lands. Skipped when localStorage already holds a
// value, which means the user picked it themselves (or we set it on a prior
// visit and they kept it).
if (typeof window !== 'undefined' && !localStorage.getItem(STORAGE_KEY)) {
  detectLanguageFromRegion().then((lang) => {
    if (!lang || !SUPPORTED_LANGUAGES.has(lang)) return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (i18n.language === lang) return;
    i18n.changeLanguage(lang);
  });
}

export default i18n;
