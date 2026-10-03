import { useSyncExternalStore } from 'react';
import { getTheme, setTheme, subscribeTheme } from '../lib/theme';

/** `{ theme, setTheme, toggleTheme }` for the light / dark switch. */
export function useTheme() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme);
  return {
    theme,
    setTheme,
    toggleTheme: () => setTheme(theme === 'dark' ? 'light' : 'dark'),
  };
}
