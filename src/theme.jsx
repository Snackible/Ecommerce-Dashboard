import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const KEY = 'snk_theme';
const ThemeContext = createContext({ pref: 'system', theme: 'dark', setPref: () => {} });
export const useTheme = () => useContext(ThemeContext);

const systemTheme = () => (window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
const readPref = () => { try { return localStorage.getItem(KEY) || 'system'; } catch { return 'system'; } };

export function ThemeProvider({ children }) {
  const [pref, setPrefState] = useState(readPref);
  const [system, setSystem] = useState(systemTheme);
  const theme = pref === 'system' ? system : pref;

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const on = () => setSystem(mq.matches ? 'light' : 'dark');
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'light' ? '#f5f4f1' : '#0b0c10');
  }, [theme]);

  const setPref = useCallback((p) => {
    setPrefState(p);
    try { localStorage.setItem(KEY, p); } catch { /* storage unavailable */ }
  }, []);

  const value = useMemo(() => ({ pref, theme, setPref }), [pref, theme, setPref]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Colours the charts need as literal values (ApexCharts can't read CSS variables). */
export const CHART_COLORS = {
  dark: { axis: '#8a90a2', text: '#f0f0f0', surface: '#12141b', grid: 'rgba(255,255,255,0.06)', line: 'rgba(255,255,255,0.2)', tipBorder: 'rgba(255,255,255,0.1)', tipText: '#f1f5f9', tipMuted: '#9ca3b3' },
  light: { axis: '#6b7185', text: '#1a1d27', surface: '#ffffff', grid: 'rgba(20,24,40,0.08)', line: 'rgba(20,24,40,0.25)', tipBorder: 'rgba(20,24,40,0.12)', tipText: '#1a1d27', tipMuted: '#5b6275' },
};
