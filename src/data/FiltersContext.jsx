import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useData } from './DataContext';
import { monthKey } from '../config';

const FiltersContext = createContext(null);
export const useFilters = () => useContext(FiltersContext);

export function FiltersProvider({ children }) {
  const { latest } = useData();
  const currentKey = monthKey(latest.getFullYear(), latest.getMonth() + 1);

  const [month, setMonthState] = useState(currentKey);
  const touched = useRef(false);
  // Data arrives after first render; follow the latest data month until the user picks one.
  useEffect(() => { if (!touched.current) setMonthState(currentKey); }, [currentKey]);
  const [period, setPeriod] = useState('mtd');
  const [platform, setPlatform] = useState('All');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const setMonth = useCallback((m) => {
    touched.current = true;
    setMonthState(m);
    // Day-level periods only make sense for the month that holds the latest data.
    if (m !== currentKey) setPeriod((p) => (p === 't1' || p === 't2' ? 'mtd' : p));
  }, [currentKey]);

  const value = useMemo(() => ({
    month, period, platform, customStart, customEnd, currentKey,
    setMonth, setPeriod, setPlatform, setCustomStart, setCustomEnd,
    isCurrentMonth: month === currentKey,
  }), [month, period, platform, customStart, customEnd, currentKey, setMonth]);

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}
