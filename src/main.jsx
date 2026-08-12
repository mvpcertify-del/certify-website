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

// Opens the TLS connection to Supabase while the app's own JavaScript is still
// being parsed. Every authenticated page starts with a session check and a
// profile read against this origin, and without the hint those requests pay for
// DNS + TCP + TLS before the first byte moves. Cheap, and it removes a couple of
// hundred milliseconds from the wait after the shell appears.
;(() => {
  const url = import.meta.env.VITE_SUPABASE_URL
  if (!url) return
  try {
    const link = document.createElement('link')
    link.rel = 'preconnect'
    link.href = new URL(url).origin
    link.crossOrigin = 'anonymous'
    document.head.appendChild(link)
  } catch { /* malformed URL — the app will fail louder elsewhere */ }
})()

let mounted = false
function mount() {
  if (mounted) return // the timeout and i18nReady race; only the first wins
  mounted = true
  // Hand the screen over from the static splash in index.html.
  document.getElementById('app-splash')?.remove()
  createRoot(document.getElementById('root')).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}

// Wait for the detected language bundle to load before first paint so the UI
// renders directly in the right language (no English flash). If it somehow
// fails, mount anyway with the bundled English fallback.
//
// The wait is capped. A visitor in an Arabic- or Hindi-speaking region needs a
// separate ~90 kB locale chunk, fetched only AFTER the main bundle has run —
// one more serial round trip with nothing on screen behind it. Past the cap we
// mount in the bundled English and let the real language swap in when it
// arrives (i18next is configured with useSuspense:false, so that re-render is
// already handled). Better a moment of English than a longer blank page.
const FIRST_PAINT_LANGUAGE_WAIT_MS = 1200
setTimeout(mount, FIRST_PAINT_LANGUAGE_WAIT_MS)
i18nReady.then(mount).catch(mount)
