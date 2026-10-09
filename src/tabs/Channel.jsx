import { useMemo, useState } from 'react';
import Chart, { areaFill, tooltipCard } from '../components/Chart';
import Donut from '../components/Donut';
import { Card, CatBadge, Empty, Kpi, KpiGrid, PctBar, Select, Skeleton } from '../components/ui';
import { CAT_COLORS, CATEGORIES, platColor } from '../config';
import { useData } from '../data/DataContext';
import { useFilters } from '../data/FiltersContext';
import { useFilteredRows } from '../data/hooks';
import { skuSource } from '../lib/selectors';
import { fmt, num, shortDayLabel } from '../lib/utils';

const REV_LABEL = { t1: 'T-1 revenue', t2: 'T-2 revenue', '7d': '7-day revenue', mtd: 'MTD revenue', custom: 'Revenue' };
const catColor = (c) => CAT_COLORS[c] || '#6b7280';

export default function Channel({ platform }) {
  const data = useData();
  const { month, period, isCurrentMonth } = useFilters();
  const { rows: allRows } = useFilteredRows();
  const [catFilter, setCatFilter] = useState('All');

  const oms = useMemo(() => allRows.filter((r) => r.Platform === platform), [allRows, platform]);
  const skuRows = useMemo(() => {
    const src = skuSource(data, month);
    const selM = month === 'All' ? null : Number(month.split('-')[1]);
    return src.filter((r) => r.Platform === platform && (selM === null || r.Month === selM));
  }, [data, month, platform]);

  const color = platColor(platform);
  const sales = oms.reduce((s, r) => s + r.Sales, 0);
  const units = oms.reduce((s, r) => s + r.Units, 0);
  const spends = oms.reduce((s, r) => s + r.Spends, 0);
  const roas = spends > 0 ? sales / spends : 0;
  const asp = sales > 0 && units > 0 ? (sales / units).toFixed(0) : '--';
  const estRev = isCurrentMonth ? skuRows.reduce((s, r) => s + (num(r.EstRevenue) || num(r.GMV)), 0) : sales;

  const daily = useMemo(() => {
    const m = {};
    oms.forEach((r) => { m[r._day] = (m[r._day] || 0) + r.Sales; });
    const days = Object.keys(m).sort();
    return { days, values: days.map((d) => m[d]) };
  }, [oms]);
  const growth = daily.values.map((v, i) => (i === 0 ? null : daily.values[i - 1] > 0 ? ((v - daily.values[i - 1]) / daily.values[i - 1]) * 100 : 0));

  const catTotals = useMemo(() => {
    const m = {};
    skuRows.forEach((r) => { const c = String(r.Category || 'Others'); m[c] = (m[c] || 0) + num(r.MTDRevenue); });
    return m;
  }, [skuRows]);
  const catLabels = Object.keys(catTotals);
  const catValues = catLabels.map((k) => catTotals[k]);

  const loadingSku = data.secondary.sku === 'loading' || data.secondary.fy25Sku === 'loading';

  return (
    <div className="stack">
      <div className="detail-head">
        <h2 style={{ color }}>{platform}</h2>
        <span className={`chip ${roas >= 2 ? 'pos' : roas > 0 ? 'warn' : 'neu'}`}>{roas > 0 ? `ROAS ${roas.toFixed(2)}x` : 'ROAS --'}</span>
      </div>

      <KpiGrid cols={4}>
        <Kpi label={REV_LABEL[period] || 'Revenue'} value={sales} format={fmt} accent={color} sub={`ASP ₹${asp}`} />
        <Kpi label="ROAS" value={roas} format={(v) => (v > 0 ? v.toFixed(2) + 'x' : '--')} accent="#22c55e"
          sub={roas >= 2 ? '▲ Healthy' : roas > 0 ? '△ Monitor' : 'No spends tracked'} subTone={roas >= 2 ? 'pos' : 'neu'} />
        <Kpi label="Units sold" value={units} format={(v) => fmt(v, false)} accent="#3b82f6" sub={`${oms.length} days of data`} />
        <Kpi label="Est. revenue" value={estRev} format={fmt} accent="#8b7cf6"
          sub={isCurrentMonth ? 'Full-month projection' : 'Full-month actuals'} />
      </KpiGrid>

      <div className="grid-2-1">
        <Card title="Daily sales trend (₹)">
          {daily.days.length ? (
            <Chart type="area" height={280}
              series={[{ name: 'Sales', data: daily.values }]}
              options={{
                colors: [color],
                fill: areaFill(0.4),
                markers: { size: 4 },
                xaxis: { categories: daily.days.map(shortDayLabel), tickAmount: 10, labels: { rotate: -45, rotateAlways: true } },
                yaxis: { labels: { formatter: (v) => fmt(v) } },
                tooltip: {
                  custom: ({ series, seriesIndex, dataPointIndex }) => {
                    const g = growth[dataPointIndex];
                    return tooltipCard(shortDayLabel(daily.days[dataPointIndex]), [
                      [`Sales: ${fmt(series[seriesIndex][dataPointIndex])}`, color],
                      g === null ? null : [`${g >= 0 ? '↑' : '↓'} ${Math.abs(g).toFixed(1)}% DoD`, g >= 0 ? '#22c55e' : '#ef4444'],
                    ]);
                  },
                },
              }} />
          ) : <Empty title="No daily data" />}
        </Card>
        <Card title="Category mix">
          {loadingSku && !catLabels.length ? <Skeleton height={260} /> : catLabels.length ? (
            <Donut height={230} labels={catLabels} values={catValues} colors={catLabels.map(catColor)} valueFmt={fmt} />
          ) : <Empty title="No SKU data" hint="This platform has no SKU rows for the selected month." />}
        </Card>
      </div>

      <SkuTable rows={skuRows} catFilter={catFilter} setCatFilter={setCatFilter} loading={loadingSku} />
    </div>
  );
}

function SkuTable({ rows, catFilter, setCatFilter, loading }) {
  const summary = catFilter === '__summary__';
  const filtered = catFilter === 'All' || summary ? rows : rows.filter((r) => String(r.Category) === catFilter);
  const sorted = [...filtered].sort((a, b) => num(b.MTDRevenue) - num(a.MTDRevenue));
  const totalRev = sorted.reduce((s, r) => s + num(r.MTDRevenue), 0);

  const cats = useMemo(() => {
    if (!summary) return [];
    const m = {};
    rows.forEach((r) => {
      const c = String(r.Category || 'Others');
      const a = (m[c] ||= { rev: 0, units: 0, est: 0 });
      a.rev += num(r.MTDRevenue); a.units += num(r.MTDUnits); a.est += num(r.EstRevenue);
    });
    return Object.entries(m).sort((a, b) => b[1].rev - a[1].rev);
  }, [rows, summary]);
  const catRevTotal = cats.reduce((s, [, c]) => s + c.rev, 0);

  const title = summary ? 'Category totals' : catFilter === 'All' ? 'Top SKUs by revenue' : `${catFilter}: SKUs`;

  return (
    <div className="card table-card">
      <header className="card-head">
        <h3 className="card-title">{title}</h3>
        <Select small label="Filter by category" value={catFilter} onChange={setCatFilter}
          options={[{ value: 'All', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c })), { value: '__summary__', label: 'Category totals' }]} />
      </header>
      <div className="table-scroll">
        {loading && !rows.length ? <div style={{ padding: 20 }}><Skeleton lines={5} /></div> : summary ? (
          <table className="table">
            <thead><tr><th>Category</th><th className="r">Est. revenue</th><th className="r">Revenue</th><th className="r">Units</th><th className="r">% of total</th></tr></thead>
            <tbody>
              {cats.map(([c, d]) => (
                <tr key={c}>
                  <td><CatBadge cat={c} color={catColor(c)} /></td>
                  <td className="r muted">{fmt(d.est)}</td>
                  <td className="r strong">{fmt(d.rev)}</td>
                  <td className="r">{fmt(d.units, false)}</td>
                  <td className="r"><PctBar pct={catRevTotal > 0 ? (d.rev / catRevTotal) * 100 : 0} color={catColor(c)} /></td>
                </tr>
              ))}
              {cats.length > 0 && (
                <tr className="total-row">
                  <td>Total</td>
                  <td className="r">{fmt(cats.reduce((s, [, c]) => s + c.est, 0))}</td>
                  <td className="r strong">{fmt(catRevTotal)}</td>
                  <td className="r">{fmt(cats.reduce((s, [, c]) => s + c.units, 0), false)}</td>
                  <td className="r muted">100%</td>
                </tr>
              )}
            </tbody>
          </table>
        ) : (
          <table className="table">
            <thead><tr><th>SKU</th><th>Category</th><th className="r">Est. revenue</th><th className="r">Revenue</th><th className="r">Units</th><th className="r">% of total</th></tr></thead>
            <tbody>
              {sorted.map((r, i) => {
                const rev = num(r.MTDRevenue);
                return (
                  <tr key={r.SKU + i}>
                    <td><span className="rank">{i + 1}</span><span className="strong">{r.SKU}</span></td>
                    <td><CatBadge cat={r.Category} color={catColor(r.Category)} /></td>
                    <td className="r">{fmt(num(r.EstRevenue))}</td>
                    <td className="r strong">{fmt(rev)}</td>
                    <td className="r">{fmt(num(r.MTDUnits), false)}</td>
                    <td className="r"><PctBar pct={totalRev > 0 ? (rev / totalRev) * 100 : 0} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
        {!loading && !(summary ? cats.length : sorted.length) && <Empty title="No SKU data" hint="Nothing for this platform and month." />}
      </div>
    </div>
  );
}
