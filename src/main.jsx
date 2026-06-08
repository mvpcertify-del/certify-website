import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import './i18n/i18n.js'
import App from './App.jsx'
import { applyDocumentDirection, detectLanguageFromRegionSync } from './utils/regionLanguage.js'

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

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
