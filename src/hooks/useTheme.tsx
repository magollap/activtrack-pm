import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getTheme, setTheme as saveTheme, type Theme } from '@/lib/prefs';

export type ThemePreference = Theme | 'system';

interface ThemeApi {
  /** The theme on screen right now. */
  theme: Theme;
  /** What the person chose: a fixed theme, or follow the device. */
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
  toggleTheme: () => void;
}

const META_COLORS: Record<Theme, string> = { light: '#ffffff', dark: '#070707' };
const media = () => window.matchMedia('(prefers-color-scheme: dark)');
const systemTheme = (): Theme => (media().matches ? 'dark' : 'light');

const ThemeContext = createContext<ThemeApi | null>(null);

/** Briefly animates colours so switching themes feels smooth rather than a hard flash. */
function withTransition(apply: () => void) {
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reduced) root.classList.add('theme-transition');
  apply();
  if (!reduced) window.setTimeout(() => root.classList.remove('theme-transition'), 300);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => getTheme() ?? 'system');
  const [system, setSystem] = useState<Theme>(systemTheme);
  const theme: Theme = preference === 'system' ? system : preference;

  useEffect(() => {
    const query = media();
    const onChange = () => setSystem(query.matches ? 'dark' : 'light');
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (root.classList.contains('dark') !== (theme === 'dark')) {
      withTransition(() => root.classList.toggle('dark', theme === 'dark'));
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
  }, [theme]);

  const setPreference = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
    saveTheme(next === 'system' ? null : next);
  }, []);

  const toggleTheme = useCallback(() => setPreference(theme === 'dark' ? 'light' : 'dark'), [setPreference, theme]);

  const api = useMemo(() => ({ theme, preference, setPreference, toggleTheme }), [theme, preference, setPreference, toggleTheme]);
  return <ThemeContext.Provider value={api}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeApi {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used inside ThemeProvider');
  return context;
}
