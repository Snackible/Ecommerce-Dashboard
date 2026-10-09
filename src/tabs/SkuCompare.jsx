import { useEffect, useMemo, useState } from 'react';
import Chart from '../components/Chart';
import { Card, Segmented, Skeleton } from '../components/ui';
import { ALL_MONTHS, isPrevFY } from '../config';
import { useData } from '../data/DataContext';
import { addDays, dayKey, endOfDay, fmt, parseInputDate, startOfDay } from '../lib/utils';
import { monthsWithData } from '../lib/selectors';

const A = '#f97316';
const B = '#3b82f6';
const PERIODS = [
  { id: 'mtd', label: 'MTD' },
  { id: '7d', label: '7 days' },
  { id: 't1', label: 'T-1' },
  { id: 'custom', label: 'Custom' },
];
const PLATS = ['All', 'Blinkit', 'Zepto', 'Instamart', 'Big Basket'];
const short = (s) => s.split(' ').slice(0, 2).join(' ');

function slotData(slot, { skuDaily, fy25Sku }) {
  const { sku, platform, month, period, start, end } = slot;
  if (!sku || !month) return null;
  const [selY, selM] = month.split('-').map(Number);
  const byPlatform = {};
  let totalRev = 0, totalUnits = 0;

  if (isPrevFY(month)) {
    fy25Sku
      .filter((r) => r.SKU === sku && r.Month === selM && (platform === 'All' || r.Platform === platform))
      .forEach((r) => {
        const rev = r.MTDRevenue, units = r.MTDUnits;
        const p = (byPlatform[r.Platform] ||= { rev: 0, units: 0 });
        p.rev += rev; p.units += units; totalRev += rev; totalUnits += units;
      });
    return { sku, isPrev: true, totalRev, totalUnits, totalEst: totalRev, byPlatform, days: [] };
  }

  const mine = skuDaily.filter((r) => r.SKU === sku);
  const latest = mine.length ? startOfDay(new Date(Math.max(...mine.map((r) => r._t)))) : startOfDay(new Date());
  const monthStart = new Date(selY, selM - 1, 1);
  const monthEnd = endOfDay(new Date(selY, selM, 0));
  let from, to;
  if (period === 't1') { from = latest; to = endOfDay(latest); }
  else if (period === '7d') { from = addDays(latest, -6); to = endOfDay(latest); }
  else if (period === 'custom') {
    if (!start || !end) return null;
    from = startOfDay(parseInputDate(start)); to = endOfDay(parseInputDate(end));
  } else { from = monthStart; to = latest < monthEnd ? endOfDay(latest) : monthEnd; }

  const dayMap = {};
  mine.forEach((r) => {
    if (r._date < from || r._date > to) return;
    if (platform !== 'All' && r.Platform !== platform) return;
    const p = (byPlatform[r.Platform] ||= { rev: 0, units: 0 });
    p.rev += r.GMV; p.units += r.Units; totalRev += r.GMV; totalUnits += r.Units;
    const k = dayKey(r._date);
    dayMap[k] = (dayMap[k] || 0) + r.GMV;
  });
  const days = [];
  for (let c = new Date(from); c <= to; c = addDays(c, 1)) days.push(dayMap[dayKey(c)] || 0);
  return { sku, isPrev: false, totalRev, totalUnits, totalEst: days.length ? (totalRev / days.length) * 30 : 0, byPlatform, days };
}

function SkuPicker({ names, value, onChange, label }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  useEffect(() => setQ(value), [value]);
  const matches = names.filter((n) => n.toLowerCase().includes(q.toLowerCase())).slice(0, 80);
  return (
    <div className="combo">
      <input className="field full" placeholder="Search SKU" aria-label={`${label} SKU`} value={q}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => { setQ(e.target.value); onChange(''); setOpen(true); }} />
      {open && (
        <div className="combo-list" role="listbox">
          {matches.length ? matches.map((n) => (
            <div key={n} role="option" aria-selected={n === value} className="combo-item" onMouseDown={() => { onChange(n); setQ(n); setOpen(false); }}>{n}</div>
          )) : <div className="combo-item muted">{names.length ? 'No match' : 'Loading SKUs…'}</div>}
        </div>
      )}
    </div>
  );
}

function Slot({ side, tone, slot, setSlot, names, months }) {
  const prev = slot.month && isPrevFY(slot.month);
  const patch = (p) => setSlot({ ...slot, ...p });
  return (
    <div className={`picker picker-${tone} slot`}>
      <div className="picker-title">Side {side.toUpperCase()}</div>
      <label className="lbl">SKU</label>
      <SkuPicker names={names} value={slot.sku} onChange={(v) => patch({ sku: v })} label={`Side ${side.toUpperCase()}`} />
      <label className="lbl">Month</label>
      <select className="field full" aria-label={`Side ${side.toUpperCase()} month`} value={slot.month} onChange={(e) => patch({ month: e.target.value })}>
        {months.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
      </select>
      <div className={prev ? 'dim' : ''}>
        <label className="lbl">Period</label>
        <Segmented size="sm" label="Period" options={PERIODS} value={slot.period} onChange={(p) => patch({ period: p })} />
        {slot.period === 'custom' && !prev && (
          <div className="grid-2 tight">
            <input type="date" className="field full" aria-label="Start date" value={slot.start} onChange={(e) => patch({ start: e.target.value })} />
            <input type="date" className="field full" aria-label="End date" value={slot.end} onChange={(e) => patch({ end: e.target.value })} />
          </div>
        )}
      </div>
      {prev && <p className="notice">FY25 month: full-month actuals only. Daily detail is unavailable.</p>}
      <label className="lbl">Platform</label>
      <select className="field full" aria-label={`Side ${side.toUpperCase()} platform`} value={slot.platform} onChange={(e) => patch({ platform: e.target.value })}>
        {PLATS.map((p) => <option key={p} value={p}>{p === 'All' ? 'All platforms' : p}</option>)}
      </select>
    </div>
  );
}

export default function SkuCompare() {
  const data = useData();
  const { sku, fy25Sku, skuDaily, secondary, ensureSkuDaily } = data;
  useEffect(() => { ensureSkuDaily(); }, [ensureSkuDaily]);

  const months = useMemo(
    () => monthsWithData(data, ALL_MONTHS).slice().reverse(),
    [data],
  );
  const names = useMemo(() => [...new Set([...sku, ...fy25Sku].map((r) => r.SKU))].filter(Boolean).sort(), [sku, fy25Sku]);
  const blank = { sku: '', platform: 'All', month: months[0]?.key || '', period: 'mtd', start: '', end: '' };
  const [a, setA] = useState(blank);
  const [b, setB] = useState(blank);
  const [res, setRes] = useState(null);
  const [error, setError] = useState('');

  const run = () => {
    const ra = slotData(a, data), rb = slotData(b, data);
    if (!ra || !rb) { setError('Choose a SKU and month for both sides (and dates if using a custom period).'); setRes(null); return; }
    setError('');
    setRes({ a: ra, b: rb });
  };

  const loadingDaily = secondary.skuDaily === 'loading';

  return (
    <div className="stack">
      <div className="grid-2">
        <Slot side="a" tone="a" slot={a} setSlot={setA} names={names} months={months} />
        <Slot side="b" tone="b" slot={b} setSlot={setB} names={names} months={months} />
      </div>
      <div className="center">
        <button type="button" className="btn-primary" onClick={run} disabled={loadingDaily}>{loadingDaily ? 'Loading daily data…' : 'Compare →'}</button>
      </div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {!res && !error && <div className="empty-box">Fill in both sides, then press <strong>Compare →</strong></div>}
      {res && <Results a={res.a} b={res.b} />}
    </div>
  );
}

function Results({ a, b }) {
  const la = short(a.sku), lb = short(b.sku);
  const metrics = [
    ['Revenue', fmt(a.totalRev), fmt(b.totalRev), [a.totalRev, b.totalRev]],
    ['Units', fmt(a.totalUnits, false), fmt(b.totalUnits, false), [a.totalUnits, b.totalUnits]],
    ['ASP', a.totalUnits > 0 ? '₹' + (a.totalRev / a.totalUnits).toFixed(0) : '--', b.totalUnits > 0 ? '₹' + (b.totalRev / b.totalUnits).toFixed(0) : '--', null],
    ['Platform forecast', fmt(a.totalEst), fmt(b.totalEst), [a.totalEst, b.totalEst]],
  ];
  const plats = [...new Set([...Object.keys(a.byPlatform), ...Object.keys(b.byPlatform)])].sort();
  const bar = (formatter) => ({
    colors: [A, B], plotOptions: { bar: { borderRadius: 4, columnWidth: '62%', grouped: true } }, legend: { position: 'top' },
    xaxis: { categories: plats }, yaxis: { labels: { formatter } }, tooltip: { y: { formatter } },
  });

  const series = [];
  if (!a.isPrev && a.days.length) series.push({ name: `A · ${la}`, data: a.days });
  if (!b.isPrev && b.days.length) series.push({ name: `B · ${lb}`, data: b.days });
  const maxLen = Math.max(...series.map((s) => s.data.length), 1);
  series.forEach((s) => { s.data = [...s.data, ...Array(maxLen - s.data.length).fill(null)]; });

  return (
    <>
      <div className="grid-4">
        {metrics.map(([label, va, vb, raw]) => {
          const d = raw && raw[1] > 0 ? ((raw[0] - raw[1]) / raw[1]) * 100 : null;
          return (
            <div key={label} className="stat">
              <div className="eyebrow">{label}</div>
              <div className="stat-row">
                <div><div className="tag" style={{ color: A }}>A · {la}</div><div className="stat-val" style={{ color: A }}>{va}</div></div>
                <div className="r"><div className="tag" style={{ color: B }}>B · {lb}</div><div className="stat-val" style={{ color: B }}>{vb}</div></div>
              </div>
              {d !== null && <div className={`delta-line ${d >= 0 ? 'pos' : 'neg'}`}>{d >= 0 ? '▲' : '▼'} {Math.abs(d).toFixed(1)}% A vs B</div>}
            </div>
          );
        })}
      </div>
      <div className="grid-2">
        <Card title="Revenue by platform (₹)">
          <Chart type="bar" height={260} series={[{ name: `${la} (A)`, data: plats.map((p) => a.byPlatform[p]?.rev || 0) }, { name: `${lb} (B)`, data: plats.map((p) => b.byPlatform[p]?.rev || 0) }]} options={bar(fmt)} />
        </Card>
        <Card title="Units by platform">
          <Chart type="bar" height={260} series={[{ name: `${la} (A)`, data: plats.map((p) => a.byPlatform[p]?.units || 0) }, { name: `${lb} (B)`, data: plats.map((p) => b.byPlatform[p]?.units || 0) }]} options={bar((v) => fmt(v, false))} />
        </Card>
      </div>
      <Card title="Daily revenue, aligned Day 1 → Day N" caption={(a.isPrev || b.isPrev) ? 'FY25 side unavailable: daily data only exists for the current FY.' : undefined}>
        {series.length ? (
          <Chart type="line" height={300} series={series}
            options={{
              colors: [A, B], markers: { size: 3 }, legend: { position: 'top' },
              xaxis: { categories: Array.from({ length: maxLen }, (_, i) => 'Day ' + (i + 1)) },
              yaxis: { labels: { formatter: (v) => (v !== null ? fmt(v) : '') } },
              tooltip: { y: { formatter: (v) => (v !== null ? fmt(v) : 'No data') } },
            }} />
        ) : <div className="empty-box">Daily data is unavailable: both sides are FY25 months.</div>}
      </Card>
    </>
  );
}
