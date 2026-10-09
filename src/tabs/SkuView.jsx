import { useMemo, useState } from 'react';
import Chart from '../components/Chart';
import { Card, CatBadge, Empty, Kpi, KpiGrid, PctBar, Segmented, Select, Skeleton } from '../components/ui';
import { CAT_COLORS, CATEGORIES, isPrevFY, platColor } from '../config';
import { useData } from '../data/DataContext';
import { useFilters } from '../data/FiltersContext';
import { skuSource } from '../lib/selectors';
import { addDays, fmt, num, parseInputDate, startOfDay } from '../lib/utils';

const catColor = (c) => CAT_COLORS[c] || '#6b7280';
const PERIOD_TAG = { t1: 'T-1', t2: 'T-2', '7d': '7-day', mtd: 'MTD', custom: 'Selected' };

/** Which Day1..Day31 cells fall inside the active period. */
function periodMatcher(period, latest, customStart, customEnd) {
  const t1 = startOfDay(latest);
  const t2 = addDays(t1, -1);
  const cutoff = addDays(t1, -7);
  const sd = customStart ? startOfDay(parseInputDate(customStart)) : new Date(0);
  const ed = customEnd ? startOfDay(parseInputDate(customEnd)) : new Date('2999-01-01');
  return (date) => {
    switch (period) {
      case 't1': return date.getTime() === t1.getTime();
      case 't2': return date.getTime() === t2.getTime();
      case '7d': return date > cutoff && date <= t1;
      case 'custom': return date >= sd && date <= ed;
      default: return true;
    }
  };
}

function monthMatches(r, month, prev) {
  if (month === 'All') return true;
  const [y, m] = month.split('-').map(Number);
  return r.Month === m && (prev || r._y === y);
}

export default function SkuView() {
  const data = useData();
  const { month, period, customStart, customEnd } = useFilters();
  const [cat, setCat] = useState('All');
  const [plat, setPlat] = useState('All');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);

  const prev = month !== 'All' && isPrevFY(month);
  const src = skuSource(data, month);
  const loading = (prev ? data.secondary.fy25Sku : data.secondary.sku) === 'loading';

  const list = useMemo(() => {
    const match = periodMatcher(period, data.latest, customStart, customEnd);
    const q = search.trim().toLowerCase();
    const agg = {};
    src.forEach((r) => {
      if (!monthMatches(r, month, prev)) return;
      if (plat !== 'All' && r.Platform !== plat) return;
      if (cat !== 'All' && String(r.Category) !== cat) return;
      if (q && !r.SKU.toLowerCase().includes(q)) return;
      const a = (agg[r.SKU] ||= { sku: r.SKU, category: String(r.Category), rev: 0, units: 0, est: 0, platforms: {} });
      let rev = 0;
      if (prev) {
        rev = num(r.MTDRevenue);
      } else {
        for (let d = 1; d <= 31; d++) {
          const v = num(r['Day' + d]);
          if (v > 0 && match(new Date(r._y, r.Month - 1, d))) rev += v;
        }
      }
      a.rev += rev;
      a.units += num(r.MTDUnits);
      a.est += num(r.EstRevenue);
      a.platforms[r.Platform] = (a.platforms[r.Platform] || 0) + rev;
    });
    return Object.values(agg).sort((a, b) => b.rev - a.rev);
  }, [src, month, prev, plat, cat, search, period, customStart, customEnd, data.latest]);

  const totalRev = list.reduce((s, r) => s + r.rev, 0);
  const totalUnits = list.reduce((s, r) => s + r.units, 0);
  const catRev = {};
  list.forEach((r) => { catRev[r.category] = (catRev[r.category] || 0) + r.rev; });
  const topCat = Object.keys(catRev).sort((a, b) => catRev[b] - catRev[a])[0] || '--';

  if (selected) {
    return <SkuDetail sku={selected} src={src} month={month} prev={prev} onBack={() => setSelected(null)} period={period} customStart={customStart} customEnd={customEnd} latest={data.latest} />;
  }

  return (
    <div className="stack">
      <div className="toolbar">
        <Segmented label="Category" value={cat} onChange={setCat}
          options={[{ id: 'All', label: 'All' }, ...CATEGORIES.map((c) => ({ id: c, label: c }))]} />
        <Select label="Platform" value={plat} onChange={setPlat}
          options={['All', 'Blinkit', 'Zepto', 'Instamart', 'Big Basket'].map((p) => ({ value: p, label: p === 'All' ? 'All platforms' : p }))} />
        <input className="search" type="search" placeholder="Search SKU" aria-label="Search SKU" value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <KpiGrid cols={3}>
        <Kpi label={`${PERIOD_TAG[period] || ''} revenue`} value={totalRev} format={fmt} accent="#f97316" sub={`${list.length} SKUs`} />
        <Kpi label="Total units (MTD)" value={totalUnits} format={(v) => fmt(v, false)} accent="#3b82f6"
          sub={`ASP ₹${totalUnits > 0 ? (totalRev / totalUnits).toFixed(0) : '--'}`} />
        <Kpi label="Top category" value={topCat} accent="#8b7cf6" sub="by revenue" />
      </KpiGrid>

      <div className="card table-card">
        <header className="card-head">
          <h3 className="card-title">SKU leaderboard</h3>
          <span className="card-caption">{list.length} SKUs</span>
        </header>
        <div className="table-scroll">
          {loading && !list.length ? <div style={{ padding: 20 }}><Skeleton lines={6} /></div> : !list.length ? (
            <Empty title="No SKUs match these filters" />
          ) : (
            <table className="table" style={{ minWidth: 900 }}>
              <thead><tr><th style={{ width: 44 }}>#</th><th>SKU</th><th>Category</th><th className="r">Revenue</th><th className="r">Units</th><th className="r">Est. revenue</th><th className="r">% of total</th><th>Platforms</th></tr></thead>
              <tbody>
                {list.map((r, i) => (
                  <tr key={r.sku} className="clickable" tabIndex={0} onClick={() => setSelected(r.sku)}
                    onKeyDown={(e) => (e.key === 'Enter' ? setSelected(r.sku) : null)}>
                    <td className="rank">{i + 1}</td>
                    <td className="strong">{r.sku}</td>
                    <td><CatBadge cat={r.category} color={catColor(r.category)} /></td>
                    <td className="r strong">{fmt(r.rev)}</td>
                    <td className="r">{fmt(r.units, false)}</td>
                    <td className="r muted">{fmt(r.est)}</td>
                    <td className="r"><PctBar pct={totalRev > 0 ? (r.rev / totalRev) * 100 : 0} color={catColor(r.category)} /></td>
                    <td>{Object.keys(r.platforms).map((p) => <span key={p} className="plat-tag" style={{ color: platColor(p) }}>{p}</span>)}</td>
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

function SkuDetail({ sku, src, month, prev, onBack, period, customStart, customEnd, latest }) {
  const { platData, category } = useMemo(() => {
    const match = periodMatcher(period, latest, customStart, customEnd);
    const out = {};
    let category = '';
    src.forEach((r) => {
      if (r.SKU !== sku || !monthMatches(r, month, prev)) return;
      category = String(r.Category);
      const a = (out[r.Platform] ||= { rev: 0, units: 0, days: Array(31).fill(0) });
      if (prev) {
        a.rev += num(r.MTDRevenue);
      } else {
        for (let d = 1; d <= 31; d++) {
          const v = num(r['Day' + d]);
          if (!v) continue;
          a.days[d - 1] += v;
          if (match(new Date(r._y, r.Month - 1, d))) a.rev += v;
        }
      }
      a.units += num(r.MTDUnits);
    });
    return { platData: out, category };
  }, [sku, src, month, prev, period, customStart, customEnd, latest]);

  const plats = Object.keys(platData);
  return (
    <div className="stack">
      <div className="detail-head">
        <button type="button" className="link-btn" onClick={onBack}>← Back to leaderboard</button>
        <h2>{sku}</h2>
        <CatBadge cat={category} color={catColor(category)} />
      </div>
      <div className="platform-grid compact">
        {plats.map((p) => {
          const d = platData[p];
          return (
            <article key={p} className="platform-card" style={{ '--p': platColor(p) }}>
              <header><h3>{p}</h3></header>
              <div className="big-num">{fmt(d.rev)}</div>
              <div className="muted mono">{fmt(d.units, false)} units · ASP ₹{d.units > 0 ? (d.rev / d.units).toFixed(0) : '--'}</div>
            </article>
          );
        })}
      </div>
      <div className="grid-2">
        <Card title="Revenue by platform (₹)">
          <Chart type="bar" height={260} series={[{ name: 'Revenue', data: plats.map((p) => platData[p].rev) }]}
            options={{
              colors: plats.map(platColor),
              plotOptions: { bar: { borderRadius: 6, columnWidth: '50%', distributed: true } },
              legend: { show: false },
              xaxis: { categories: plats },
              yaxis: { labels: { formatter: fmt } },
              tooltip: { y: { formatter: fmt } },
            }} />
        </Card>
        <Card title="Daily trend">
          {prev ? <Empty title="Daily data isn't available for FY25 months" /> : (
            <Chart type="line" height={260} series={plats.map((p) => ({ name: p, data: platData[p].days }))}
              options={{
                colors: plats.map(platColor),
                stroke: { width: 2 },
                legend: { position: 'top' },
                xaxis: { categories: Array.from({ length: 31 }, (_, i) => 'D' + (i + 1)), tickAmount: 10 },
                yaxis: { labels: { formatter: fmt } },
                tooltip: { y: { formatter: fmt } },
              }} />
          )}
        </Card>
      </div>
    </div>
  );
}
