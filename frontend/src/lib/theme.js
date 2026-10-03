/**
 * Light / dark theme as a tiny external store. The theme lives on <html data-theme="...">, which
 * the CSS tokens in index.css read. An inline script in index.html applies the saved (or OS)
 * theme before the first paint, so the page never flashes the wrong palette; keep its storage
 * key equal to THEME_STORAGE_KEY.
 *
 * Until the user picks a theme, the app follows the operating system and keeps following it.
 */
export const THEME_STORAGE_KEY = 'skole-theme';
export const THEMES = Object.freeze(['light', 'dark']);

const listeners = new Set();
const systemDark = window.matchMedia('(prefers-color-scheme: dark)');

function savedTheme() {
  try {
    const value = localStorage.getItem(THEME_STORAGE_KEY);
    return THEMES.includes(value) ? value : null;
  } catch {
    return null; // storage blocked (private mode, disabled cookies): fall back to the OS
  }
}

function apply(theme) {
  document.documentElement.dataset.theme = theme;
  listeners.forEach((listener) => listener());
}

systemDark.addEventListener('change', (event) => {
  if (!savedTheme()) apply(event.matches ? 'dark' : 'light');
});

/** The theme currently on screen. */
export function getTheme() {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

/** Switches the theme and remembers the choice on this device. */
export function setTheme(theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // not persisted; the switch still applies to this visit
  }
  apply(theme);
}

/** useSyncExternalStore subscription. */
export function subscribeTheme(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
