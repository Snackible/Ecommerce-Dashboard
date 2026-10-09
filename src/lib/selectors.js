import { PAID_CHANNELS, ZEPTO_SPEND_CORRECTION, isPrevFY, monthKey } from '../config';
import { num, parseInputDate, startOfDay, endOfDay, addDays } from './utils';

const latestCache = new WeakMap();
export function latestDate(rows) {
  if (!rows.length) return startOfDay(new Date());
  if (latestCache.has(rows)) return latestCache.get(rows);
  let max = 0;
  for (const r of rows) if (r._t > max) max = r._t;
  const d = new Date(max);
  latestCache.set(rows, d);
  return d;
}

/** Rows for the main filter bar (month / period / platform). */
export function getFilteredData({ oms, fy25 }, f) {
  const dataset = f.month !== 'All' && isPrevFY(f.month) ? fy25 : oms;
  const latest = latestDate(dataset);
  const t2 = addDays(latest, -1);
  const [selY, selM] = f.month !== 'All' ? f.month.split('-').map(Number) : [null, null];
  const cutoff = addDays(latest, -7);
  const sd = f.customStart ? parseInputDate(f.customStart) : new Date(0);
  const ed = endOfDay(f.customEnd ? parseInputDate(f.customEnd) : new Date('2999-01-01'));
  const correction = ZEPTO_SPEND_CORRECTION[f.month];

  return dataset
    .filter((r) => {
      const platMatch = f.platform === 'All' || r.Platform === f.platform;
      // Custom range deliberately overrides the month dropdown.
      if (f.period === 'custom') return platMatch && r._date >= sd && r._date <= ed;
      const monthMatch = f.month === 'All' || (r.Month === selM && r._y === selY);
      if (!monthMatch || !platMatch) return false;
      switch (f.period) {
        case 't1': return r._t === latest.getTime();
        case 't2': return r._t === t2.getTime();
        case '7d': return r._date > cutoff && r._date <= latest;
        default: return true;
      }
    })
    .map((r) => {
      if (correction && r.Platform === 'Zepto') {
        const Spends = r.Spends * correction;
        return { ...r, Spends, ROAS: Spends > 0 ? r.Sales / Spends : 0 };
      }
      return r;
    });
}

export function aggregateByPlatform(rows) {
  const agg = {};
  rows.forEach((r) => {
    const p = r.Platform;
    if (!p) return;
    const a = (agg[p] ||= { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 });
    a.sales += r.Sales;
    a.spends += r.Spends;
    a.units += r.Units;
    if (r.ROAS > 0) { a.roasSum += r.ROAS; a.roasCount++; }
  });
  Object.values(agg).forEach((a) => {
    a.roas = a.spends > 0 ? a.sales / a.spends : a.roasCount > 0 ? a.roasSum / a.roasCount : 0;
  });
  return agg;
}

export function blendedPaidRoas(agg) {
  const sales = PAID_CHANNELS.reduce((s, p) => s + (agg[p]?.sales || 0), 0);
  const spends = PAID_CHANNELS.reduce((s, p) => s + (agg[p]?.spends || 0), 0);
  return { sales, spends, roas: spends > 0 ? sales / spends : 0 };
}

export function dailyMap(rows, field) {
  const m = {};
  rows.forEach((r) => { m[r._day] = (m[r._day] || 0) + r[field]; });
  return m;
}

/** Rows for a calendar month, picking the right FY dataset. */
export function monthRows({ oms, fy25 }, y, m, platform) {
  const src = isPrevFY(monthKey(y, m)) ? fy25 : oms;
  return src.filter((r) => r._y === y && r._m === m && (!platform || r.Platform === platform));
}

/** Totals over a list of {y, m} months. ROAS counts paid channels only. */
export function monthsAgg(data, months, platform) {
  const rows = months.flatMap(({ y, m }) => monthRows(data, y, m, platform));
  const paid = rows.filter((r) => PAID_CHANNELS.includes(r.Platform));
  const sales = rows.reduce((s, r) => s + r.Sales, 0);
  const units = rows.reduce((s, r) => s + r.Units, 0);
  const spends = paid.reduce((s, r) => s + r.Spends, 0);
  const paidSales = paid.reduce((s, r) => s + r.Sales, 0);
  return { rows, sales, units, spends, roas: spends > 0 ? paidSales / spends : 0 };
}

/** Months from Apr 2025 up to the latest month that has data. */
export function monthsWithData(data, allMonths) {
  const latest = latestDate(data.oms);
  const cap = latest.getFullYear() * 12 + latest.getMonth();
  return allMonths.filter(({ y, m }) => y * 12 + (m - 1) <= cap);
}

export function skuSource({ sku, fy25Sku }, month) {
  return month !== 'All' && isPrevFY(month) ? fy25Sku : sku;
}
export const skuUnits = (r) => num(r.MTDUnits) || num(r.Quantity);
export const skuRevenue = (r) => num(r.MTDRevenue) || num(r.GMV);
