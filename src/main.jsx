import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { i18nReady } from './i18n/i18n.js'
import App from './App.jsx'
import { applyDocumentDirection, detectLanguageFromRegionSync } from './utils/regionLanguage.js'

// ---------------------------------------------------------------------------
// Stale-chunk recovery.
// After a new deploy, the hashed chunk filenames change. A browser that still
// has the OLD index.html cached will try to fetch chunk files that no longer
// exist on the server, and Vite fires a `vite:preloadError` event (the user
// otherwise sees "Failed to fetch dynamically imported module"). We recover by
// forcing ONE hard reload, which pulls the fresh index.html + new chunk names.
// A sessionStorage one-shot guard prevents an infinite reload loop if a chunk
// is genuinely broken (not just stale).
const RELOAD_GUARD_KEY = 'certifycx-chunk-reloaded';
window.addEventListener('vite:preloadError', (event) => {
  if (sessionStorage.getItem(RELOAD_GUARD_KEY)) return; // already tried once
  event.preventDefault();
  sessionStorage.setItem(RELOAD_GUARD_KEY, '1');
  window.location.reload();
});
// Once the app has loaded successfully, clear the guard so a future stale
// deploy can recover again.
window.addEventListener('load', () => {
  sessionStorage.removeItem(RELOAD_GUARD_KEY);
});

// Set <html dir/lang> before React mounts, so the first paint matches the
// user's region. Stored choice wins; otherwise fall back to a synchronous
// region guess (timezone / browser locale / cached IP country).
const storedLang = localStorage.getItem('certifycx-lang');
applyDocumentDirection(storedLang || detectLanguageFromRegionSync() || 'en');

// Set <html data-theme> before first paint so the saved theme is restored
// without a flash of the wrong theme. Defaults to dark.
const storedTheme = localStorage.getItem('certifycx-theme');
document.documentElement.setAttribute(
  'data-theme',
  storedTheme === 'light' ? 'light' : 'dark'
);

function mount() {
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Wait for the detected language bundle to load before first paint so the UI
// renders directly in the right language (no English flash). If it somehow
// fails, mount anyway with the bundled English fallback.
i18nReady.then(mount).catch(mount)
