import { useMemo, useState } from 'react';
import Chart, { areaFill, tooltipCard } from '../components/Chart';
import Donut from '../components/Donut';
import { Card, Empty, Kpi, KpiGrid, Segmented, Select, Skeleton } from '../components/ui';
import {
  ALL_MONTHS, CAT_COLORS, CATEGORIES, FY_CUR_MONTHS, FY_PREV_MONTHS, FYS, PAID_CHANNELS, QUARTERS,
  isPrevFY, monthKey, monthName, platColor,
} from '../config';
import { useData } from '../data/DataContext';
import { useFilters } from '../data/FiltersContext';
import { useFilteredRows } from '../data/hooks';
import { monthRows, monthsAgg, monthsWithData, skuSource } from '../lib/selectors';
import { fmt, fmtShort, fmtUnits, num, sum } from '../lib/utils';

const METRICS = [
  { id: 'sales', label: 'Sales' },
  { id: 'roas', label: 'ROAS' },
  { id: 'qty', label: 'Qty sold' },
];
const VIEWS = [
  { id: 'current', label: 'Current' },
  { id: 'trends', label: 'Trends' },
  { id: 'yoy', label: 'YoY' },
];
const PERIOD_OPTS = [
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'fy', label: 'Financial year' },
];
const alpha = (hex) => hex + '66';
const crore = (v) => +(v / 1e7).toFixed(3);
const roasOf = (rows) => {
  const paid = rows.filter((r) => PAID_CHANNELS.includes(r.Platform));
  const sp = sum(paid, 'Spends');
  return sp > 0 ? sum(paid, 'Sales') / sp : 0;
};

function useDD() {
  const data = useData();
  const f = useFilters();
  const { rows, agg } = useFilteredRows();
  const months = useMemo(() => monthsWithData(data, ALL_MONTHS), [data]);
  return { data, f, rows, agg, months };
}

/** Points for monthly / quarterly / FY trend charts. */
function periodPoints(data, period) {
  const defs = period === 'monthly' ? ALL_MONTHS.map((m) => ({ l: m.label, months: [m] }))
    : period === 'quarterly' ? QUARTERS.map((q) => ({ l: q.label, months: q.months }))
    : FYS.map((x) => ({ l: x.label, months: x.months }));
  return defs.map(({ l, months }) => ({ l, ...monthsAgg(data, months) })).filter((p) => p.sales > 0);
}

/** (current FY month, same month last FY) pairs up to the latest month with data. */
function yoyPairs(data) {
  const withData = new Set(monthsWithData(data, FY_CUR_MONTHS).map((m) => m.key));
  return FY_CUR_MONTHS.map((cur, i) => ({ cur, prev: FY_PREV_MONTHS[i], name: monthName(cur.m) })).filter((p) => withData.has(p.cur.key));
}

function skuRowsFor(data, { y, m }) {
  return isPrevFY(monthKey(y, m)) ? data.fy25Sku.filter((r) => r.Month === m) : data.sku.filter((r) => r.Month === m && r._y === y);
}

const YOY_COLORS = ['#eab308', '#8b7cf6', '#22c55e', '#3b82f6'];

export default function DeepDive({ metric, onMetric }) {
  const [view, setView] = useState('current');
  return (
    <div className="stack">
      <div className="dd-head">
        <div>
          <h2 className="h2">Cross-channel analytics</h2>
          <p className="muted small">Sales, ROAS and volume: current, trends and year on year</p>
        </div>
      </div>
      <div className="underline-tabs" role="tablist" aria-label="Metric">
        {METRICS.map((m) => (
          <button key={m.id} role="tab" aria-selected={metric === m.id} className={metric === m.id ? 'on' : ''} onClick={() => onMetric(m.id)}>{m.label}</button>
        ))}
      </div>
      <Segmented size="sm" label="View" options={VIEWS} value={view} onChange={setView} />
      <div key={metric + view} className="fade-in">
        {metric === 'sales' && view === 'current' && <SalesCurrent />}
        {metric === 'sales' && view === 'trends' && <SalesTrends />}
        {metric === 'sales' && view === 'yoy' && <SalesYoY />}
        {metric === 'roas' && view === 'current' && <RoasCurrent />}
        {metric === 'roas' && view === 'trends' && <RoasTrends />}
        {metric === 'roas' && view === 'yoy' && <RoasYoY />}
        {metric === 'qty' && view === 'current' && <QtyCurrent />}
        {metric === 'qty' && view === 'trends' && <QtyTrends />}
        {metric === 'qty' && view === 'yoy' && <QtyYoY />}
      </div>
    </div>
  );
}

// ─── SALES ──────────────────────────────────────────────────────────────────
function SalesCurrent() {
  const { data, f, rows, agg } = useDD();
  const totalSales = sum(rows, 'Sales');
  const totalUnits = sum(rows, 'Units');

  const prev = useMemo(() => {
    if (f.month === 'All') return null;
    let [y, m] = f.month.split('-').map(Number);
    m -= 1; if (m === 0) { m = 12; y -= 1; }
    const pr = monthRows(data, y, m);
    return pr.length ? { sales: sum(pr, 'Sales'), units: sum(pr, 'Units') } : null;
  }, [data, f.month]);
  const momSales = prev?.sales ? ((totalSales - prev.sales) / prev.sales) * 100 : null;
  const momUnits = prev?.units ? ((totalUnits - prev.units) / prev.units) * 100 : null;

  const [selY, selM] = f.month === 'All' ? [0, 0] : f.month.split('-').map(Number);
  const projected = f.isCurrentMonth && f.period === 'mtd'
    ? totalSales * (new Date(selY, selM, 0).getDate() / data.latest.getDate()) : null;

  const platEntries = Object.entries(agg).filter(([, v]) => v.sales > 0).sort((a, b) => b[1].sales - a[1].sales);
  const best = platEntries[0];

  const daily = useMemo(() => {
    const m = {};
    rows.forEach((r) => { m[r._day] = (m[r._day] || 0) + r.Sales; });
    const days = Object.keys(m).sort();
    return { labels: days.map((d) => d.slice(8) + '/' + d.slice(5, 7)), values: days.map((d) => m[d]) };
  }, [rows]);

  const dow = useMemo(() => {
    const t = Array(7).fill(0);
    rows.forEach((r) => { t[r._date.getDay()] += r.Sales; });
    const order = [1, 2, 3, 4, 5, 6, 0];
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return { labels: order.map((i) => names[i]), values: order.map((i) => t[i]) };
  }, [rows]);
  const dowTotal = sum(dow.values.map((v) => ({ v })), 'v');

  const weeks = useMemo(() => {
    const b = [['W1 (1–7)', 0], ['W2 (8–14)', 0], ['W3 (15–21)', 0], ['W4 (22–28)', 0], ['W5 (29+)', 0]];
    rows.forEach((r) => {
      const d = r._date.getDate();
      b[d <= 7 ? 0 : d <= 14 ? 1 : d <= 21 ? 2 : d <= 28 ? 3 : 4][1] += r.Sales;
    });
    return b.filter((w) => w[1] > 0);
  }, [rows]);

  if (!rows.length) return <Empty title="No data for these filters" />;
  return (
    <div className="stack">
      <KpiGrid cols={4}>
        <Kpi label="Total sales" value={totalSales} format={fmtShort} accent="#eab308" delta={momSales ?? undefined} sub={momSales === null ? 'No prior month' : 'vs prev month'} />
        <Kpi label="Best platform" value={best ? best[0] : '—'} accent="#8b7cf6" sub={best ? `${fmtShort(best[1].sales)} · ${((best[1].sales / totalSales) * 100).toFixed(0)}% share` : ''} />
        <Kpi label="Total units" value={totalUnits} format={fmtUnits} accent="#22c55e" delta={momUnits ?? undefined} sub="vs prev month" />
        <Kpi label="Projected month" value={projected ?? 0} format={(v) => (projected === null ? '—' : fmtShort(v))} accent="#3b82f6" sub={projected === null ? 'MTD view of the current month only' : 'at current run rate'} />
      </KpiGrid>
      <Card title="Daily sales trend (₹)">
        <Chart type="area" height={200} series={[{ name: 'Sales', data: daily.values }]}
          options={{ colors: ['#f97316'], fill: areaFill(0.3), xaxis: { categories: daily.labels, tickAmount: 6, labels: { rotate: -30 } }, yaxis: { labels: { formatter: fmtShort } }, tooltip: { y: { formatter: fmtShort } } }} />
      </Card>
      <div className="grid-3">
        <Card title="Sales by platform">
          <Donut height={220} labels={platEntries.map(([k]) => k)} values={platEntries.map(([, v]) => v.sales)} colors={platEntries.map(([k]) => platColor(k))} total={totalSales} valueFmt={fmtShort} legendValue={false} />
        </Card>
        <Card title="Sales by day of week">
          <Donut height={220} labels={dow.labels} values={dow.values} colors={['#eab308', '#f97316', '#22c55e', '#3b82f6', '#a78bfa', '#14b8a6', '#ec4899']} total={dowTotal} valueFmt={fmtShort} totalLabel="Week" legendValue={false} />
        </Card>
        <Card title="Sales by week of month">
          <Chart type="area" height={230} series={[{ name: 'Sales', data: weeks.map((w) => w[1]) }]}
            options={{ colors: ['#eab308'], fill: areaFill(0.25), markers: { size: 5 }, xaxis: { categories: weeks.map((w) => w[0]) }, yaxis: { labels: { formatter: fmtShort } }, tooltip: { y: { formatter: fmtShort } } }} />
        </Card>
      </div>
    </div>
  );
}

function SalesTrends() {
  const { data, months } = useDD();
  const [period, setPeriod] = useState('monthly');
  const [plat, setPlat] = useState('all');
  const pts = useMemo(() => periodPoints(data, period), [data, period]);
  const growth = pts.map((p, i) => (i === 0 ? null : pts[i - 1].sales > 0 ? ((p.sales - pts[i - 1].sales) / pts[i - 1].sales) * 100 : 0));
  const plats = plat === 'all' ? ['Blinkit', 'Zepto', 'Instamart', 'Big Basket', 'Amazon'] : [plat];
  const unit = period === 'monthly' ? 'MoM' : period === 'quarterly' ? 'QoQ' : 'YoY';

  return (
    <div className="stack">
      <Card title="Total sales trajectory" action={<Select small label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTS} />}>
        <Chart type="area" height={320} series={[{ name: 'Sales', data: pts.map((p) => crore(p.sales)) }]}
          options={{
            colors: ['#eab308'], fill: areaFill(0.35), markers: { size: 5 },
            xaxis: { categories: pts.map((p) => p.l), labels: { rotate: -30 } },
            yaxis: { labels: { formatter: (v) => v.toFixed(1) + 'Cr' } },
            tooltip: {
              custom: ({ series, seriesIndex, dataPointIndex }) => {
                const g = growth[dataPointIndex];
                return tooltipCard(pts[dataPointIndex]?.l || '', [[`Sales: ${fmtShort(series[seriesIndex][dataPointIndex] * 1e7)}`, '#eab308'], g === null ? null : [`${g >= 0 ? '↑' : '↓'} ${Math.abs(g).toFixed(1)}% ${unit}`, g >= 0 ? '#22c55e' : '#ef4444']]);
              },
            },
          }} />
      </Card>
      <Card title="Sales by platform: monthly trajectory"
        action={<Select small label="Platform" value={plat} onChange={setPlat} options={[{ value: 'all', label: 'All platforms' }, ...['Blinkit', 'Zepto', 'Instamart', 'Big Basket', 'Amazon'].map((p) => ({ value: p, label: p }))]} />}>
        <Chart type="line" height={320}
          series={plats.map((p) => ({ name: p, data: months.map(({ y, m }) => crore(sum(monthRows(data, y, m, p), 'Sales'))) }))}
          options={{
            colors: plats.map(platColor), stroke: { width: plats.length === 1 ? 3 : 2 }, markers: { size: 4 },
            legend: { show: plats.length > 1, position: 'top' },
            xaxis: { categories: months.map((m) => m.label), labels: { rotate: -30 } },
            yaxis: { labels: { formatter: (v) => v.toFixed(2) + 'Cr' } },
            tooltip: { y: { formatter: (v) => fmtShort(v * 1e7) } },
          }} />
      </Card>
    </div>
  );
}

function YoYBars({ title, series, colors, fmtAxis, fmtTip, labels, height = 260 }) {
  return (
    <Card title={title}>
      <Chart type="bar" height={height} series={series}
        options={{ colors, plotOptions: { bar: { borderRadius: 3, columnWidth: '72%', grouped: true } }, legend: { position: 'top' }, xaxis: { categories: labels }, yaxis: { labels: { formatter: fmtAxis } }, tooltip: { y: { formatter: fmtTip } } }} />
    </Card>
  );
}

function SalesYoY() {
  const { data } = useDD();
  const pairs = yoyPairs(data);
  const plats = ['Blinkit', 'Zepto', 'Instamart', 'Amazon'];
  const last = pairs[pairs.length - 1];
  if (!last) return <Empty title="No current-year data yet" />;
  const total = (month, p) => sum(monthRows(data, month.y, month.m, p), 'Sales');
  return (
    <div className="stack">
      <KpiGrid cols={4}>
        {plats.map((p, i) => {
          const a = total(last.cur, p), b = total(last.prev, p);
          return <Kpi key={p} label={`${p} YoY · ${last.name}`} value={b > 0 ? ((a - b) / b) * 100 : 0} format={(v) => v.toFixed(1) + '%'} accent={YOY_COLORS[i]} delta={b > 0 ? ((a - b) / b) * 100 : undefined} sub={`FY26 ${fmtShort(a)} · FY25 ${fmtShort(b)}`} />;
        })}
      </KpiGrid>
      <YoYBars title="FY25-26 vs FY26-27: same period" labels={pairs.map((p) => p.name)}
        series={[...plats.map((p) => ({ name: 'FY26 ' + p, data: pairs.map((x) => crore(total(x.cur, p))) })), ...plats.map((p) => ({ name: 'FY25 ' + p, data: pairs.map((x) => crore(total(x.prev, p))) }))]}
        colors={[...plats.map(platColor), ...plats.map((p) => alpha(platColor(p)))]}
        fmtAxis={(v) => v.toFixed(1) + 'Cr'} fmtTip={(v) => fmtShort(v * 1e7)} />
    </div>
  );
}

// ─── ROAS ───────────────────────────────────────────────────────────────────
function RoasCurrent() {
  const { data, f, rows, agg } = useDD();
  const paid = PAID_CHANNELS.map((p) => [p, agg[p]]).filter(([, v]) => v && v.spends > 0).sort((a, b) => b[1].sales / b[1].spends - a[1].sales / a[1].spends);
  const paidSales = PAID_CHANNELS.reduce((s, p) => s + (agg[p]?.sales || 0), 0);
  const totalSp = PAID_CHANNELS.reduce((s, p) => s + (agg[p]?.spends || 0), 0);
  const blended = totalSp > 0 ? paidSales / totalSp : 0;
  const best = paid[0], worst = paid[paid.length - 1];
  const worstRoas = worst ? worst[1].sales / worst[1].spends : 0;

  const spendSeries = useMemo(() => {
    let src, title;
    if (f.month === 'All') {
      const cutoff = new Date(data.latest); cutoff.setDate(cutoff.getDate() - 30);
      src = [...data.oms, ...data.fy25].filter((r) => r._date >= cutoff && r._date <= data.latest);
      title = 'ROAS vs spend · last 30 days';
    } else {
      const [y, m] = f.month.split('-').map(Number);
      src = monthRows(data, y, m);
      title = f.isCurrentMonth ? 'ROAS vs spend · this month' : `ROAS vs spend · ${monthName(m)} ${y}`;
    }
    const d = {};
    src.forEach((r) => { const o = (d[r._day] ||= { sales: 0, spends: 0 }); o.sales += r.Sales; o.spends += r.Spends; });
    const days = Object.keys(d).sort();
    return { title, days, roas: days.map((k) => (d[k].spends > 0 ? +(d[k].sales / d[k].spends).toFixed(2) : 0)), spend: days.map((k) => +(d[k].spends / 1e5).toFixed(2)) };
  }, [data, f.month, f.isCurrentMonth]);

  if (!rows.length) return <Empty title="No data for these filters" />;
  return (
    <div className="stack">
      <KpiGrid cols={4}>
        <Kpi label="Blended ROAS" value={blended} format={(v) => v.toFixed(2) + 'x'} accent="#eab308" sub="Blinkit, Zepto, Instamart" />
        <Kpi label="Best ROAS" value={best ? best[0] : '—'} accent="#8b7cf6" sub={best ? (best[1].sales / best[1].spends).toFixed(2) + 'x' : ''} />
        <Kpi label="Total ad spend" value={totalSp} format={fmtShort} accent="#22c55e" sub="Tracked budget" />
        <Kpi label="Watch" value={worst && worstRoas < 5 ? worst[0] : '—'} accent="#3b82f6" sub={worst ? `${worstRoas.toFixed(2)}x vs 5x target` : 'below 5x target'} subTone={worst && worstRoas < 5 ? 'neg' : 'neu'} />
      </KpiGrid>
      <div className="grid-2">
        <Card title="ROAS by platform">
          <Chart type="bar" height={260} series={[{ name: 'ROAS', data: paid.map(([, v]) => +(v.sales / v.spends).toFixed(2)) }]}
            options={{ colors: paid.map(([k]) => platColor(k)), plotOptions: { bar: { borderRadius: 6, columnWidth: '48%', distributed: true } }, legend: { show: false }, xaxis: { categories: paid.map(([k]) => k) }, yaxis: { labels: { formatter: (v) => v.toFixed(1) + 'x' } }, tooltip: { y: { formatter: (v) => v.toFixed(2) + 'x' } } }} />
        </Card>
        <Card title={spendSeries.title}>
          <Chart type="line" height={260}
            series={[{ name: 'ROAS', type: 'line', data: spendSeries.roas }, { name: 'Spend (L)', type: 'bar', data: spendSeries.spend }]}
            options={{
              colors: ['#22c55e', '#8b7cf6'], stroke: { width: [2.5, 0] }, fill: { opacity: [1, 0.35] },
              plotOptions: { bar: { columnWidth: '70%', borderRadius: 2 } }, legend: { position: 'top' },
              xaxis: { categories: spendSeries.days.map((d) => d.slice(5)), tickAmount: 8, labels: { rotate: -45 } },
              yaxis: [{ labels: { formatter: (v) => v.toFixed(1) + 'x', style: { colors: '#22c55e' } } }, { opposite: true, labels: { formatter: (v) => v.toFixed(2) + 'L', style: { colors: '#8b7cf6' } } }],
            }} />
        </Card>
      </div>
    </div>
  );
}

function RoasTrends() {
  const { data, months } = useDD();
  const [period, setPeriod] = useState('monthly');
  const [plat, setPlat] = useState('Blinkit');
  const pts = useMemo(() => periodPoints(data, period), [data, period]);
  const platPts = useMemo(() => months.map(({ y, m, label }) => {
    let rows = monthRows(data, y, m, plat);
    if (plat === 'Instamart' && y === 2025 && m === 5) rows = rows.filter((r) => r.Spends > 0); // partial-fill month
    const sp = sum(rows, 'Spends');
    return { l: label, roas: sp > 0 ? +(sum(rows, 'Sales') / sp).toFixed(2) : 0 };
  }).filter((p) => p.roas > 0), [data, months, plat]);
  const roasOpts = (color, cats) => ({
    colors: [color], fill: areaFill(0.35), markers: { size: 4 },
    xaxis: { categories: cats, labels: { rotate: -30 } },
    yaxis: { labels: { formatter: (v) => v.toFixed(1) + 'x' } },
    tooltip: { y: { formatter: (v) => v.toFixed(2) + 'x' } },
  });
  return (
    <div className="stack">
      <Card title="Blended ROAS trajectory" action={<Select small label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTS} />}>
        <Chart type="area" height={240} series={[{ name: 'Blended ROAS', data: pts.map((p) => +p.roas.toFixed(2)) }]} options={roasOpts('#22c55e', pts.map((p) => p.l))} />
      </Card>
      <Card title="ROAS by platform trend" action={<Select small label="Platform" value={plat} onChange={setPlat} options={PAID_CHANNELS.map((p) => ({ value: p, label: p }))} />}>
        <Chart type="area" height={240} series={[{ name: plat + ' ROAS', data: platPts.map((p) => p.roas) }]} options={roasOpts(platColor(plat), platPts.map((p) => p.l))} />
      </Card>
    </div>
  );
}

function RoasYoY() {
  const { data } = useDD();
  const pairs = yoyPairs(data);
  const last = pairs[pairs.length - 1];
  if (!last) return <Empty title="No current-year data yet" />;
  const roas = (month, p) => roasOf(monthRows(data, month.y, month.m, p));
  return (
    <div className="stack">
      <KpiGrid cols={3}>
        {PAID_CHANNELS.map((p, i) => {
          const a = roas(last.cur, p), b = roas(last.prev, p);
          return <Kpi key={p} label={`${p} ROAS · ${last.name}`} value={a} format={(v) => v.toFixed(2) + 'x'} accent={YOY_COLORS[i]} delta={b > 0 ? ((a - b) / b) * 100 : undefined} sub={`FY25: ${b.toFixed(2)}x`} />;
        })}
      </KpiGrid>
      <YoYBars title="ROAS comparison: FY25 vs FY26 same period" labels={pairs.map((p) => p.name)}
        series={[...PAID_CHANNELS.map((p) => ({ name: 'FY26 ' + p, data: pairs.map((x) => +roas(x.cur, p).toFixed(2)) })), ...PAID_CHANNELS.map((p) => ({ name: 'FY25 ' + p, data: pairs.map((x) => +roas(x.prev, p).toFixed(2)) }))]}
        colors={[...PAID_CHANNELS.map(platColor), ...PAID_CHANNELS.map((p) => alpha(platColor(p)))]}
        fmtAxis={(v) => v.toFixed(1) + 'x'} fmtTip={(v) => v.toFixed(2) + 'x'} />
    </div>
  );
}

// ─── QTY ────────────────────────────────────────────────────────────────────
function QtyCurrent() {
  const { data, f, rows, agg } = useDD();
  const [selCat, setSelCat] = useState('All');
  const [skuPlat, setSkuPlat] = useState('All');
  const totalUnits = sum(rows, 'Units');
  const totalSales = sum(rows, 'Sales');
  const plats = Object.entries(agg).filter(([, v]) => v.units > 0).sort((a, b) => b[1].units - a[1].units);
  const best = plats[0];
  const lowest = [...plats].sort((a, b) => a[1].sales / a[1].units - b[1].sales / b[1].units)[0];

  const prev = f.month !== 'All' && isPrevFY(f.month);
  const skuLoading = (prev ? data.secondary.fy25Sku : data.secondary.sku) === 'loading';
  const skuRows = useMemo(() => {
    const src = skuSource(data, f.month);
    const selM = f.month === 'All' ? null : Number(f.month.split('-')[1]);
    return src.filter((r) => selM === null || r.Month === selM);
  }, [data, f.month]);

  const donut = useMemo(() => {
    if (selCat === 'All') {
      const m = Object.fromEntries(CATEGORIES.map((c) => [c, { units: 0, sales: 0 }]));
      skuRows.forEach((r) => {
        const raw = String(r.Category || '').trim();
        const c = CATEGORIES.includes(raw) ? raw : 'Others';
        m[c].units += num(r.MTDUnits); m[c].sales += num(r.MTDRevenue);
      });
      const act = CATEGORIES.filter((c) => m[c].units > 0);
      return { labels: act, values: act.map((c) => m[c].units), sales: act.map((c) => m[c].sales), colors: act.map((c) => CAT_COLORS[c]), center: 'All categories' };
    }
    const m = {};
    skuRows.filter((r) => String(r.Category || '').trim() === selCat).forEach((r) => {
      const o = (m[r.SKU] ||= { units: 0, sales: 0 });
      o.units += num(r.MTDUnits); o.sales += num(r.MTDRevenue);
    });
    const sorted = Object.entries(m).filter(([, v]) => v.units > 0).sort((a, b) => b[1].units - a[1].units);
    const top = sorted.slice(0, 8);
    const rest = sorted.slice(8);
    if (rest.length) top.push(['Others', { units: sum(rest.map(([, v]) => v), 'units'), sales: sum(rest.map(([, v]) => v), 'sales') }]);
    return { labels: top.map(([k]) => k), values: top.map(([, v]) => v.units), sales: top.map(([, v]) => v.sales), colors: ['#eab308', '#f97316', '#22c55e', '#3b82f6', '#a78bfa', '#14b8a6', '#ec4899', '#6b7280', '#ef4444'], center: selCat };
  }, [skuRows, selCat]);
  const donutTotal = donut.values.reduce((a, b) => a + b, 0);

  const topSkus = useMemo(() => {
    const m = {};
    skuRows.filter((r) => skuPlat === 'All' || r.Platform === skuPlat).forEach((r) => {
      const o = (m[r.SKU] ||= { sku: r.SKU, cat: r.Category, units: 0, gmv: 0 });
      o.units += num(r.MTDUnits); o.gmv += num(r.MTDRevenue);
    });
    const all = Object.values(m).sort((a, b) => b.units - a.units);
    return { top: all.slice(0, 8), total: all.reduce((s, r) => s + r.units, 0) };
  }, [skuRows, skuPlat]);

  if (!rows.length) return <Empty title="No data for these filters" />;
  return (
    <div className="stack">
      <KpiGrid cols={4}>
        <Kpi label="Total units" value={totalUnits} format={fmtUnits} accent="#eab308" sub={f.period.toUpperCase()} />
        <Kpi label="Blended ASP" value={totalUnits > 0 ? totalSales / totalUnits : 0} format={(v) => '₹' + v.toFixed(0)} accent="#8b7cf6" sub="all platforms" />
        <Kpi label="Top channel" value={best ? best[0] : '—'} accent="#22c55e" sub={best ? fmtUnits(best[1].units) + ' units' : ''} />
        <Kpi label="Lowest ASP" value={lowest ? lowest[0] : '—'} accent="#3b82f6" sub={lowest ? '₹' + (lowest[1].sales / lowest[1].units).toFixed(0) + ' · watch mix shift' : ''} />
      </KpiGrid>
      <div className="grid-2">
        <Card title="Units by platform">
          <Donut height={260} labels={plats.map(([k]) => k)} values={plats.map(([, v]) => v.units)} colors={plats.map(([k]) => platColor(k))} total={totalUnits} valueFmt={fmtUnits} layout="side" />
        </Card>
        <Card title="ASP by platform">
          <Chart type="bar" height={300} series={[{ name: 'ASP', data: plats.map(([, v]) => Math.round(v.sales / v.units)) }]}
            options={{ colors: plats.map(([k]) => platColor(k)), plotOptions: { bar: { borderRadius: 6, columnWidth: '50%', distributed: true } }, legend: { show: false }, xaxis: { categories: plats.map(([k]) => k) }, yaxis: { labels: { formatter: (v) => '₹' + v } }, tooltip: { y: { formatter: (v) => '₹' + v } } }} />
        </Card>
      </div>
      <Card title="Category and SKU mix, by units"
        action={<Select small label="Category" value={selCat} onChange={setSelCat} options={[{ value: 'All', label: 'All categories' }, ...CATEGORIES.map((c) => ({ value: c, label: c }))]} />}>
        {skuLoading && !skuRows.length ? <Skeleton height={320} /> : !donut.values.length ? <Empty title="No SKU data for this month" /> : (
          <Donut height={300} labels={donut.labels} values={donut.values} colors={donut.colors.slice(0, donut.labels.length)} total={donutTotal} valueFmt={fmtUnits} totalLabel={donut.center} layout="side" options={{ tooltip: { custom: ({ seriesIndex }) => tooltipCard(donut.labels[seriesIndex], [[`${fmtUnits(donut.values[seriesIndex])} units`, '#eab308'], [`Sales: ${fmtShort(donut.sales[seriesIndex])}`], [`${donutTotal > 0 ? ((donut.values[seriesIndex] / donutTotal) * 100).toFixed(1) : '0.0'}% of ${donut.center}`]]) } }} />
        )}
      </Card>
      <div className="card table-card">
        <header className="card-head">
          <h3 className="card-title">Top SKUs by units</h3>
          <Select small label="Platform" value={skuPlat} onChange={setSkuPlat} options={['All', 'Blinkit', 'Zepto', 'Instamart'].map((p) => ({ value: p, label: p === 'All' ? 'All platforms' : p }))} />
        </header>
        <div className="table-scroll">
          {skuLoading && !topSkus.top.length ? <div style={{ padding: 20 }}><Skeleton lines={5} /></div> : !topSkus.top.length ? <Empty title="No SKU data" /> : (
            <table className="table">
              <thead><tr><th>#</th><th>SKU</th><th>Category</th><th className="r">Units</th><th className="r">% of total</th><th className="r">ASP</th></tr></thead>
              <tbody>
                {topSkus.top.map((r, i) => (
                  <tr key={r.sku}>
                    <td className="rank">{i + 1}</td>
                    <td className="strong">{r.sku}</td>
                    <td className="muted">{r.cat || '—'}</td>
                    <td className="r">{fmtUnits(r.units)}</td>
                    <td className="r muted">{topSkus.total > 0 ? ((r.units / topSkus.total) * 100).toFixed(1) : '0.0'}%</td>
                    <td className="r muted">₹{r.units > 0 ? Math.round(r.gmv / r.units) : 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

function QtyTrends() {
  const { data, months } = useDD();
  const [period, setPeriod] = useState('monthly');
  const [aspPlat, setAspPlat] = useState('Blinkit');
  const pts = useMemo(() => periodPoints(data, period), [data, period]);
  const asp = useMemo(() => months.map(({ y, m, label }) => {
    const rows = monthRows(data, y, m, aspPlat);
    const u = sum(rows, 'Units');
    return { l: label, v: u > 0 ? Math.round(sum(rows, 'Sales') / u) : 0 };
  }).filter((p) => p.v > 0), [data, months, aspPlat]);
  const loading = data.secondary.sku === 'loading' || data.secondary.fy25Sku === 'loading';

  const catSeries = useMemo(() => CATEGORIES.map((cat) => ({
    name: cat,
    data: months.map((mo) => skuRowsFor(data, mo).filter((r) => String(r.Category) === cat).reduce((a, r) => a + num(r.MTDUnits), 0)),
  })), [data, months]);

  const shareMonths = months.filter((_, i) => i % 3 === 0);
  const SHARE_PLATS = ['Blinkit', 'Instamart', 'Zepto', 'First Club'];
  const shareSeries = useMemo(() => SHARE_PLATS.map((p) => ({
    name: p,
    data: shareMonths.map((mo) => {
      const rows = skuRowsFor(data, mo);
      const total = rows.reduce((a, r) => a + num(r.MTDUnits), 0);
      const pu = rows.filter((r) => r.Platform === p).reduce((a, r) => a + num(r.MTDUnits), 0);
      return total > 0 ? Math.round((pu / total) * 100) : 0;
    }),
  })), [data, shareMonths]);

  return (
    <div className="stack">
      <div className="grid-2">
        <Card title="Units trajectory" action={<Select small label="Period" value={period} onChange={setPeriod} options={PERIOD_OPTS} />}>
          <Chart type="area" height={240} series={[{ name: 'Units', data: pts.map((p) => +(p.units / 1e5).toFixed(2)) }]}
            options={{ colors: ['#3b82f6'], fill: areaFill(0.35), markers: { size: 4 }, xaxis: { categories: pts.map((p) => p.l), labels: { rotate: -30 } }, yaxis: { labels: { formatter: (v) => v.toFixed(1) + 'L' } }, tooltip: { y: { formatter: (v) => fmtUnits(v * 1e5) + ' units' } } }} />
        </Card>
        <Card title="ASP trend" action={<Select small label="Platform" value={aspPlat} onChange={setAspPlat} options={['Blinkit', 'Zepto', 'Instamart', 'Big Basket', 'Amazon'].map((p) => ({ value: p, label: p }))} />}>
          <Chart type="line" height={240} series={[{ name: aspPlat + ' ASP', data: asp.map((p) => p.v) }]}
            options={{ colors: [platColor(aspPlat)], markers: { size: 4 }, xaxis: { categories: asp.map((p) => p.l), labels: { rotate: -30 } }, yaxis: { labels: { formatter: (v) => '₹' + v } }, tooltip: { y: { formatter: (v) => '₹' + v } } }} />
        </Card>
      </div>
      <Card title="Category units trajectory, monthly">
        {loading ? <Skeleton height={220} /> : (
          <Chart type="line" height={240} series={catSeries}
            options={{ colors: CATEGORIES.map((c) => CAT_COLORS[c]), markers: { size: 3 }, legend: { position: 'top' }, xaxis: { categories: months.map((m) => m.label), labels: { rotate: -30 } }, yaxis: { min: 0, labels: { formatter: (v) => (v === 0 ? '0' : fmtUnits(v)) } }, tooltip: { y: { formatter: (v) => fmtUnits(v) + ' units' } } }} />
        )}
      </Card>
      <Card title="Platform share shift: % of total units, quarterly checkpoints">
        {loading ? <Skeleton height={220} /> : (
          <Chart type="bar" height={260} series={shareSeries}
            options={{
              chart: { stacked: true, stackType: '100%' }, colors: ['#eab308', '#3b82f6', '#8b7cf6', '#14b8a6'],
              plotOptions: { bar: { columnWidth: '58%' } },
              dataLabels: { enabled: true, formatter: (v) => (v > 8 ? Math.round(v) + '%' : ''), style: { fontSize: '10px', colors: ['#0b0c10'] } },
              legend: { position: 'top' }, xaxis: { categories: shareMonths.map((m) => m.label) },
              yaxis: { labels: { formatter: (v) => v + '%' } }, tooltip: { y: { formatter: (v) => Math.round(v) + '%' } },
            }} />
        )}
      </Card>
    </div>
  );
}

function QtyYoY() {
  const { data } = useDD();
  const pairs = yoyPairs(data);
  const last = pairs[pairs.length - 1];
  const loading = data.secondary.sku === 'loading' || data.secondary.fy25Sku === 'loading';
  if (!last) return <Empty title="No current-year data yet" />;
  const units = (month, p) => sum(monthRows(data, month.y, month.m, p), 'Units');
  const plats4 = ['Blinkit', 'Zepto', 'Instamart', 'Amazon'];
  const mixPlats = ['Blinkit', 'Instamart', 'Zepto', 'First Club'];
  const mixColors = ['#eab308', '#3b82f6', '#8b7cf6', '#14b8a6'];
  const catUnits = (month, cat) => skuRowsFor(data, month).filter((r) => String(r.Category) === cat).reduce((a, r) => a + num(r.MTDUnits), 0);
  const mix = (month, p) => {
    const rows = skuRowsFor(data, month);
    const total = rows.reduce((a, r) => a + num(r.MTDUnits), 0);
    return total > 0 ? Math.round((rows.filter((r) => r.Platform === p).reduce((a, r) => a + num(r.MTDUnits), 0) / total) * 100) : 0;
  };
  const labels = pairs.map((p) => p.name);
  return (
    <div className="stack">
      <KpiGrid cols={3}>
        {PAID_CHANNELS.map((p, i) => {
          const a = units(last.cur, p), b = units(last.prev, p);
          const d = b > 0 ? ((a - b) / b) * 100 : 0;
          return <Kpi key={p} label={`${p} units YoY · ${last.name}`} value={d} format={(v) => v.toFixed(1) + '%'} accent={YOY_COLORS[i]} delta={b > 0 ? d : undefined} sub={`FY26 ${fmtUnits(a)} · FY25 ${fmtUnits(b)}`} />;
        })}
      </KpiGrid>
      <YoYBars title="Units comparison: FY25 vs FY26 same period" labels={labels}
        series={[...plats4.map((p) => ({ name: 'FY26 ' + p, data: pairs.map((x) => units(x.cur, p)) })), ...plats4.map((p) => ({ name: 'FY25 ' + p, data: pairs.map((x) => units(x.prev, p)) }))]}
        colors={[...plats4.map(platColor), ...plats4.map((p) => alpha(platColor(p)))]} fmtAxis={fmtUnits} fmtTip={(v) => fmtUnits(v) + ' units'} />
      {loading ? <Skeleton height={240} /> : (
        <>
          <YoYBars title="Category YoY: units, FY25 vs FY26 same period" labels={labels} height={240}
            series={[...CATEGORIES.map((c) => ({ name: 'FY26 ' + c, data: pairs.map((x) => catUnits(x.cur, c)) })), ...CATEGORIES.map((c) => ({ name: 'FY25 ' + c, data: pairs.map((x) => catUnits(x.prev, c)) }))]}
            colors={[...CATEGORIES.map((c) => CAT_COLORS[c]), ...CATEGORIES.map((c) => alpha(CAT_COLORS[c]))]} fmtAxis={fmtUnits} fmtTip={(v) => fmtUnits(v) + ' units'} />
          <YoYBars title="Platform mix shift: % of total units, FY25 vs FY26" labels={labels} height={240}
            series={[...mixPlats.map((p) => ({ name: 'FY26 ' + p, data: pairs.map((x) => mix(x.cur, p)) })), ...mixPlats.map((p) => ({ name: 'FY25 ' + p, data: pairs.map((x) => mix(x.prev, p)) }))]}
            colors={[...mixColors, ...mixColors.map(alpha)]} fmtAxis={(v) => v + '%'} fmtTip={(v) => v + '% of units'} />
        </>
      )}
    </div>
  );
}
