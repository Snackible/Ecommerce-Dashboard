import { useMemo } from 'react';
import { useData } from './DataContext';
import { useFilters } from './FiltersContext';
import { aggregateByPlatform, getFilteredData } from '../lib/selectors';

/** Rows + per-platform aggregate for the current filter bar selection. */
export function useFilteredRows() {
  const { oms, fy25 } = useData();
  const { month, period, platform, customStart, customEnd } = useFilters();
  return useMemo(() => {
    const rows = getFilteredData({ oms, fy25 }, { month, period, platform, customStart, customEnd });
    return { rows, agg: aggregateByPlatform(rows) };
  }, [oms, fy25, month, period, platform, customStart, customEnd]);
}
