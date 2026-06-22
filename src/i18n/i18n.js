import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
// Only English is bundled up-front — it's the fallback and the most common
// first-paint language. The other 8 locales (~560 kB of JSON combined) are
// fetched on demand via the lazy backend below, so they never bloat the
// initial download.
import en from './locales/en.json';
import {
  detectLanguageFromRegionSync,
  detectLanguageFromRegion,
  applyDocumentDirection,
  SUPPORTED_LANGUAGES,
} from '../utils/regionLanguage.js';

const STORAGE_KEY = 'certifycx-lang';

// Marketing deep-link override. A campaign link like
// `certify.cx/iso/iso-9001?lang=ar` must open directly in that language,
// regardless of the visitor's region or any previously cached choice. We
// persist the param into localStorage *before* i18next reads its detectors
// (localStorage is first in the detection order) and before main.jsx applies
// the pre-mount <html dir/lang>, so the very first paint is already correct.
// Writing to localStorage also makes the choice stick across the session.
if (typeof window !== 'undefined') {
  try {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    if (urlLang && SUPPORTED_LANGUAGES.has(urlLang)) {
      localStorage.setItem(STORAGE_KEY, urlLang);
    }
  } catch {
    /* URL/localStorage unavailable; fall back to region detection */
  }
}

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

// Lazy locale loaders. Vite turns each dynamic import into its own chunk that
// is only fetched when that language is actually selected.
const localeLoaders = {
  ar: () => import('./locales/ar.json'),
  es: () => import('./locales/es.json'),
  ru: () => import('./locales/ru.json'),
  fr: () => import('./locales/fr.json'),
  pt: () => import('./locales/pt.json'),
  de: () => import('./locales/de.json'),
  zh: () => import('./locales/zh.json'),
  hi: () => import('./locales/hi.json'),
};

// Minimal i18next backend that resolves a language's translations from the
// lazy loaders above. i18next calls read() automatically on init for the
// detected language and again on every changeLanguage().
const lazyBackend = {
  type: 'backend',
  init() {},
  read(language, _namespace, callback) {
    const loader = localeLoaders[language];
    if (!loader) {
      // en is already bundled; anything else unknown falls back to {}.
      callback(null, {});
      return;
    }
    loader()
      .then((mod) => callback(null, mod.default))
      .catch((err) => callback(err, null));
  },
};

// Resolves once the detected first-paint language is loaded — main.jsx awaits
// this before mounting React so there's no flash of fallback English.
export const i18nReady = i18n
  .use(lazyBackend)
  .use(detector)
  .use(initReactI18next)
  .init({
    // en bundled for instant fallback; everything else comes from the backend.
    resources: {
      en: { translation: en },
    },
    partialBundledLanguages: true,
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
    react: {
      // Don't suspend on language load — fall back to bundled en until the
      // target language arrives, then re-render. Avoids needing a Suspense
      // boundary around every t() call site.
      useSuspense: false,
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
