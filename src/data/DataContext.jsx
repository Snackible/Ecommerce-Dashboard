import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { clearCache, getSkuNotice, loaders } from './api';
import { latestDate } from '../lib/selectors';

const DataContext = createContext(null);
export const useData = () => useContext(DataContext);

const EMPTY = [];

export function DataProvider({ children }) {
  const [state, setState] = useState({
    oms: EMPTY, fy25: EMPTY, sku: EMPTY, fy25Sku: EMPTY, skuDaily: EMPTY,
  });
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadedAt, setLoadedAt] = useState(null);
  const [secondary, setSecondary] = useState({ fy25: 'idle', sku: 'idle', fy25Sku: 'idle', skuDaily: 'idle' });
  const [skuNotice, setSkuNotice] = useState(null);
  const inflight = useRef({});

  const setSec = (k, v) => setSecondary((s) => ({ ...s, [k]: v }));

  const loadSecondary = useCallback(async (key, opts, latest) => {
    if (inflight.current[key] && !opts.force) return inflight.current[key];
    setSec(key, 'loading');
    const p = loaders[key](opts, latest)
      .then((rows) => {
        setState((s) => ({ ...s, [key]: rows }));
        setSec(key, 'ready');
        if (key === 'sku' || key === 'skuDaily') setSkuNotice(getSkuNotice());
      })
      .catch((e) => {
        console.error(`${key} load failed`, e);
        setSec(key, 'error');
      });
    inflight.current[key] = p;
    return p;
  }, []);

  const loadAll = useCallback(async (force = false) => {
    const opts = { force };
    inflight.current = {};
    try {
      const oms = await loaders.oms(opts);
      if (!oms.length) throw new Error('The sales sheet returned no rows.');
      setState((s) => ({ ...s, oms }));
      setStatus('ready');
      setLoadedAt(new Date());
      const latest = latestDate(oms);
      loadSecondary('fy25', opts);
      loadSecondary('fy25Sku', opts);
      loadSecondary('sku', opts, latest);
    } catch (e) {
      console.error(e);
      setError(e.message || 'Could not load data.');
      setStatus('error');
    }
  }, [loadSecondary]);

  useEffect(() => { loadAll(false); }, [loadAll]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    clearCache();
    setState({ oms: EMPTY, fy25: EMPTY, sku: EMPTY, fy25Sku: EMPTY, skuDaily: EMPTY });
    try { await loadAll(true); } finally { setRefreshing(false); }
  }, [loadAll]);

  const ensureSkuDaily = useCallback(() => {
    if (secondary.skuDaily === 'idle') loadSecondary('skuDaily', {});
  }, [secondary.skuDaily, loadSecondary]);

  const value = useMemo(() => ({
    ...state, status, error, refreshing, loadedAt, secondary, refresh, ensureSkuDaily, skuNotice,
    latest: latestDate(state.oms),
  }), [state, status, error, refreshing, loadedAt, secondary, refresh, ensureSkuDaily, skuNotice]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}
