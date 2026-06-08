import { createContext, useContext, useState, useEffect, useCallback } from 'react';

// ============================================
// Certify.cx — Theme (Dark / Light)
// ============================================
// The whole UI is driven by CSS variables defined in index.css. Switching
// themes is just flipping `document.documentElement[data-theme]` between
// "dark" (default) and "light"; the [data-theme="light"] block overrides the
// same variable names so every component re-themes automatically.

const STORAGE_KEY = 'certifycx-theme';
const THEMES = ['dark', 'light'];

const ThemeContext = createContext(null);

/** Read the persisted theme synchronously. Defaults to 'dark'. */
export function getStoredTheme() {
  try {
    const t = localStorage.getItem(STORAGE_KEY);
    if (THEMES.includes(t)) return t;
  } catch {
    /* localStorage may be unavailable (SSR / privacy mode) */
  }
  return 'dark';
}

/** Apply a theme to the document root. Safe to call before React mounts. */
export function applyTheme(theme) {
  const value = THEMES.includes(theme) ? theme : 'dark';
  document.documentElement.setAttribute('data-theme', value);
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(getStoredTheme);

  // Apply + persist whenever the theme changes.
  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore persistence failures */
    }
  }, [theme]);

  const setTheme = useCallback((next) => {
    setThemeState(THEMES.includes(next) ? next : 'dark');
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isLight: theme === 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}

export default ThemeContext;
