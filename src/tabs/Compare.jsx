import { useMemo, useState } from 'react';
import Chart, { areaFill } from '../components/Chart';
import { Card, Empty, Segmented } from '../components/ui';
import { PLATFORM_CONFIG, monthName, pad } from '../config';
import { useData } from '../data/DataContext';
import { addDays, dateLabel, dayKey, endOfDay, fmt, parseInputDate, shortDayLabel, startOfDay } from '../lib/utils';

const MODES = [
  { id: 'day', label: 'Day vs day' },
  { id: 'week', label: 'Week vs week' },
  { id: 'month', label: 'Month vs month' },
  { id: 'mom', label: 'MoM' },
  { id: 'wow', label: 'WoW' },
  { id: 'custom', label: 'Custom range' },
];
const CUSTOM_MODES = [
  { id: 'daterange', label: 'Date range' },
  { id: 'daycount', label: 'Start + no. of days' },
  { id: 'singledaily', label: 'Single range + daily' },
];
const CHANNELS = ['Blinkit', 'Zepto', 'Instamart', 'Big Basket', 'Amazon', 'First Club', 'Shopify'];
const A = '#f97316';
const B = '#3b82f6';

function aggregate(rows) {
  const total = { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 };
  const byPlatform = {};
  const byDate = {};
  rows.forEach((r) => {
    total.sales += r.Sales; total.spends += r.Spends; total.units += r.Units;
    if (r.ROAS > 0) { total.roasSum += r.ROAS; total.roasCount++; }
    const p = (byPlatform[r.Platform] ||= { sales: 0, spends: 0, units: 0, roas: 0, roasCount: 0 });
    p.sales += r.Sales; p.spends += r.Spends; p.units += r.Units;
    if (r.ROAS > 0) { p.roas += r.ROAS; p.roasCount++; }
    byDate[r._day] = (byDate[r._day] || 0) + r.Sales;
  });
  Object.values(byPlatform).forEach((p) => { p.roas = p.spends > 0 ? p.sales / p.spends : p.roasCount > 0 ? p.roas / p.roasCount : 0; });
  total.roas = total.spends > 0 ? total.sales / total.spends : total.roasCount > 0 ? total.roasSum / total.roasCount : 0;
  return { total, byPlatform, byDate };
}
const delta = (a, b) => (b ? ((a - b) / b) * 100 : null);

export default function Compare() {
  const { oms, fy25 } = useData();
  const all = useMemo(() => [...fy25, ...oms], [oms, fy25]);
  const monthOptions = useMemo(() => {
    const set = new Set(all.map((r) => `${r._y}-${pad(r._m)}`));
    return [...set].sort().map((k) => { const [y, m] = k.split('-'); return { value: k, label: `${monthName(+m)} ${y}` }; });
  }, [all]);

  const [mode, setMode] = useState('day');
  const [sub, setSub] = useState('daterange');
  const [channels, setChannels] = useState(new Set());
  const [f, setF] = useState({});
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));
  const val = (k) => f[k] || '';

  const toggleChannel = (p) => setChannels((prev) => {
    if (p === '__ALL__') return new Set();
    const n = new Set(prev);
    n.has(p) ? n.delete(p) : n.add(p);
    return n;
  });

  const rowsBetween = (start, end) => all.filter((r) => r._date >= start && r._date <= end && (channels.size === 0 || channels.has(r.Platform)));
  const range = (startStr, days) => { const s = startOfDay(parseInputDate(startStr)); return { start: s, end: endOfDay(addDays(s, days - 1)) }; };

  function run() {
    setError('');
    const fail = (msg) => { setError(msg); setResult(null); };
    const pair = (la, lb, ra, rb, extra = {}) =>
      setResult({ kind: 'pair', la, lb, a: aggregate(rowsBetween(ra.start, ra.end)), b: aggregate(rowsBetween(rb.start, rb.end)), ...extra });

    if (mode === 'mom') {
      if (!val('momStart') || !val('momEnd')) return fail('Select both a start and an end month.');
      if (val('momStart') > val('momEnd')) return fail('Start month must come before the end month.');
      let [y, m] = val('momStart').split('-').map(Number);
      const [ey, em] = val('momEnd').split('-').map(Number);
      const periods = [];
      while (y < ey || (y === ey && m <= em)) {
        periods.push({ label: `${monthName(m)} ${y}`, agg: aggregate(rowsBetween(new Date(y, m - 1, 1), endOfDay(new Date(y, m, 0)))) });
        m++; if (m > 12) { m = 1; y++; }
      }
      return setResult({ kind: 'multi', periods, tag: 'MoM' });
    }
    if (mode === 'wow') {
      if (!val('wowStart') || !val('wowEnd')) return fail('Select both a start and an end date.');
      const s = startOfDay(parseInputDate(val('wowStart')));
      const e = endOfDay(parseInputDate(val('wowEnd')));
      if (s > e) return fail('Start date must come before the end date.');
      const periods = [];
      const d2 = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
      for (let c = new Date(s), i = 1; c <= e; c = addDays(c, 7), i++) {
        const we = endOfDay(addDays(c, 6));
        const end = we > e ? e : we;
        periods.push({ label: `W${i} (${d2(c)}→${d2(end)})`, agg: aggregate(rowsBetween(c, end)) });
      }
      return setResult({ kind: 'multi', periods, tag: 'WoW' });
    }
    if (mode === 'custom' && sub === 'singledaily') {
      if (!val('sdS') || !val('sdE')) return fail('Fill in both dates.');
      const s = startOfDay(parseInputDate(val('sdS')));
      const e = endOfDay(parseInputDate(val('sdE')));
      if (s > e) return fail('Start date must come before the end date.');
      const byDay = {};
      rowsBetween(s, e).forEach((r) => {
        const d = (byDay[r._day] ||= { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 });
        d.sales += r.Sales; d.spends += r.Spends; d.units += r.Units;
        if (r.ROAS > 0) { d.roasSum += r.ROAS; d.roasCount++; }
      });
      const days = [];
      for (let c = new Date(s); c <= e; c = addDays(c, 1)) {
        const key = dayKey(c);
        const d = byDay[key] || { sales: 0, spends: 0, units: 0, roasSum: 0, roasCount: 0 };
        days.push({ key, ...d, roas: d.spends > 0 ? d.sales / d.spends : d.roasCount > 0 ? d.roasSum / d.roasCount : 0 });
      }
      return setResult({ kind: 'daily', days });
    }
    if (mode === 'day') {
      if (!val('dayA') || !val('dayB')) return fail('Pick both dates.');
      return pair(val('dayA'), val('dayB'), range(val('dayA'), 1), range(val('dayB'), 1));
    }
    if (mode === 'week') {
      if (!val('weekA') || !val('weekB')) return fail('Pick both week start dates.');
      const ra = range(val('weekA'), 7), rb = range(val('weekB'), 7);
      return pair(`${val('weekA')} (7d)`, `${val('weekB')} (7d)`, ra, rb, { weekA: ra.start, weekB: rb.start });
    }
    if (mode === 'month') {
      if (!val('monthA') || !val('monthB')) return fail('Select both months.');
      const mr = (k) => { const [y, m] = k.split('-').map(Number); return { start: new Date(y, m - 1, 1), end: endOfDay(new Date(y, m, 0)), label: `${monthName(m)} ${y}` }; };
      const ra = mr(val('monthA')), rb = mr(val('monthB'));
      return pair(ra.label, rb.label, ra, rb);
    }
    // custom: daterange / daycount
    if (sub === 'daterange') {
      if (!val('cAS') || !val('cAE') || !val('cBS') || !val('cBE')) return fail('Fill in all four dates.');
      const mk = (s, e) => ({ start: startOfDay(parseInputDate(s)), end: endOfDay(parseInputDate(e)) });
      return pair(`${val('cAS')} → ${val('cAE')}`, `${val('cBS')} → ${val('cBE')}`, mk(val('cAS'), val('cAE')), mk(val('cBS'), val('cBE')));
    }
    const da = parseInt(val('dcAD'), 10), db = parseInt(val('dcBD'), 10);
    if (!val('dcAS') || !val('dcBS') || !da || !db) return fail('Fill in both start dates and day counts.');
    return pair(`${val('dcAS')} (${da}d)`, `${val('dcBS')} (${db}d)`, range(val('dcAS'), da), range(val('dcBS'), db));
  }

  const hint = channels.size === 0 ? 'Showing all platforms'
    : channels.size <= 3 ? [...channels].join(' + ') : `${channels.size} channels selected`;

  const pickers = {
    day: [['Period A', <input key="a" type="date" className="field" aria-label="Date A" value={val('dayA')} onChange={set('dayA')} />],
          ['Period B', <input key="b" type="date" className="field" aria-label="Date B" value={val('dayB')} onChange={set('dayB')} />]],
    week: [['Week A: start date', <><input type="date" className="field" aria-label="Week A start" value={val('weekA')} onChange={set('weekA')} /><span className="muted small">→ +6 days</span></>],
           ['Week B: start date', <><input type="date" className="field" aria-label="Week B start" value={val('weekB')} onChange={set('weekB')} /><span className="muted small">→ +6 days</span></>]],
    month: [['Month A', <MonthSelect opts={monthOptions} value={val('monthA')} onChange={set('monthA')} label="Month A" />],
            ['Month B', <MonthSelect opts={monthOptions} value={val('monthB')} onChange={set('monthB')} label="Month B" />]],
    mom: [['Start month', <MonthSelect opts={monthOptions} value={val('momStart')} onChange={set('momStart')} label="Start month" />],
          ['End month', <MonthSelect opts={monthOptions} value={val('momEnd')} onChange={set('momEnd')} label="End month" />]],
    wow: [['Start date', <><input type="date" className="field" aria-label="Start date" value={val('wowStart')} onChange={set('wowStart')} /><span className="muted small">Week 1 begins here</span></>],
          ['End date', <><input type="date" className="field" aria-label="End date" value={val('wowEnd')} onChange={set('wowEnd')} /><span className="muted small">Auto-splits into 7-day weeks</span></>]],
  };

  return (
    <div className="stack">
      <div className="toolbar between">
        <Segmented label="Compare mode" options={MODES} value={mode} onChange={(m) => { setMode(m); setResult(null); setError(''); }} />
        <button type="button" className="btn-primary" onClick={run}>Compare →</button>
      </div>

      <div className="channel-bar">
        <span className="eyebrow">Channels</span>
        <div className="chip-row" role="group" aria-label="Channels">
          <button type="button" className={`pill ${channels.size === 0 ? 'on' : ''}`} aria-pressed={channels.size === 0} onClick={() => toggleChannel('__ALL__')}>All</button>
          {CHANNELS.map((p) => (
            <button key={p} type="button" className={`pill ${channels.has(p) ? 'on' : ''}`} aria-pressed={channels.has(p)} onClick={() => toggleChannel(p)}>
              <i className="dot" style={{ background: PLATFORM_CONFIG[p]?.color }} />{p}
            </button>
          ))}
        </div>
        <span className="muted small mono">{hint}</span>
      </div>

      {mode === 'custom' && (
        <>
          <Segmented size="sm" label="Custom mode" options={CUSTOM_MODES} value={sub} onChange={(s) => { setSub(s); setResult(null); }} />
          {sub === 'daterange' && (
            <div className="grid-2">
              <PickerCard tone="a" title="Period A"><input type="date" className="field" aria-label="A start" value={val('cAS')} onChange={set('cAS')} /><span className="muted">→</span><input type="date" className="field" aria-label="A end" value={val('cAE')} onChange={set('cAE')} /></PickerCard>
              <PickerCard tone="b" title="Period B"><input type="date" className="field" aria-label="B start" value={val('cBS')} onChange={set('cBS')} /><span className="muted">→</span><input type="date" className="field" aria-label="B end" value={val('cBE')} onChange={set('cBE')} /></PickerCard>
            </div>
          )}
          {sub === 'daycount' && (
            <div className="grid-2">
              <PickerCard tone="a" title="Period A: start date"><input type="date" className="field" aria-label="A start" value={val('dcAS')} onChange={set('dcAS')} /><span className="muted">+</span><input type="number" min="1" max="365" placeholder="Days" className="field narrow" aria-label="A days" value={val('dcAD')} onChange={set('dcAD')} /><span className="muted small">days</span></PickerCard>
              <PickerCard tone="b" title="Period B: start date"><input type="date" className="field" aria-label="B start" value={val('dcBS')} onChange={set('dcBS')} /><span className="muted">+</span><input type="number" min="1" max="365" placeholder="Days" className="field narrow" aria-label="B days" value={val('dcBD')} onChange={set('dcBD')} /><span className="muted small">days</span></PickerCard>
            </div>
          )}
          {sub === 'singledaily' && (
            <PickerCard tone="a" title="Pick a date range to see the daily breakdown"><input type="date" className="field" aria-label="Start" value={val('sdS')} onChange={set('sdS')} /><span className="muted">→</span><input type="date" className="field" aria-label="End" value={val('sdE')} onChange={set('sdE')} /></PickerCard>
          )}
        </>
      )}
      {pickers[mode] && (
        <div className="grid-2">
          {pickers[mode].map(([title, node], i) => <PickerCard key={title} tone={i ? 'b' : 'a'} title={title}>{node}</PickerCard>)}
        </div>
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {!result && !error && <div className="empty-box">Choose what to compare, then press <strong>Compare →</strong></div>}
      {result?.kind === 'pair' && <PairResult r={result} mode={mode} />}
      {result?.kind === 'multi' && <MultiResult r={result} />}
      {result?.kind === 'daily' && <DailyResult r={result} />}
    </div>
  );
}

function MonthSelect({ opts, value, onChange, label }) {
  return (
    <select className="field" aria-label={label} value={value} onChange={onChange}>
      <option value="">Select month</option>
      {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function PickerCard({ tone, title, children }) {
  return (
    <div className={`picker picker-${tone}`}>
      <div className="picker-title">{title}</div>
      <div className="picker-row">{children}</div>
    </div>
  );
}

function PairResult({ r, mode }) {
  const { a, b, la, lb } = r;
  const metrics = [
    ['Total sales', fmt, a.total.sales, b.total.sales],
    ['Ad spends', fmt, a.total.spends, b.total.spends],
    ['ROAS', (v) => (v > 0 ? v.toFixed(2) + 'x' : '--'), a.total.roas, b.total.roas],
    ['Total units', (v) => fmt(v, false), a.total.units, b.total.units],
  ];
  const plats = [...new Set([...Object.keys(a.byPlatform), ...Object.keys(b.byPlatform)])].sort();
  const bar = (field, formatter) => ({
    colors: [A, B],
    plotOptions: { bar: { borderRadius: 4, columnWidth: '62%', grouped: true } },
    legend: { position: 'top' },
    xaxis: { categories: plats },
    yaxis: { labels: { formatter } },
    tooltip: { y: { formatter } },
  });
  const roasFmt = (v) => (v > 0 ? v.toFixed(1) + 'x' : '--');
  const dayAxis = (start) => Array.from({ length: 7 }, (_, i) => dayKey(addDays(start, i)));

  return (
    <>
      <div className="grid-4">
        {metrics.map(([label, f, va, vb]) => {
          const d = delta(va, vb);
          return (
            <div key={label} className="stat">
              <div className="eyebrow">{label}</div>
              <div className="stat-row">
                <div><div className="tag" style={{ color: A }}>{la}</div><div className="stat-val" style={{ color: A }}>{f(va)}</div></div>
                <div className="r"><div className="tag" style={{ color: B }}>{lb}</div><div className="stat-val" style={{ color: B }}>{f(vb)}</div></div>
              </div>
              <div className={`delta-line ${d === null ? 'neu' : d >= 0 ? 'pos' : 'neg'}`}>{d === null ? '--' : `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}%`} A vs B</div>
            </div>
          );
        })}
      </div>
      <div className="grid-2">
        <Card title="Sales by platform (₹)">
          <Chart type="bar" height={280} series={[{ name: la, data: plats.map((p) => a.byPlatform[p]?.sales || 0) }, { name: lb, data: plats.map((p) => b.byPlatform[p]?.sales || 0) }]} options={bar('sales', fmt)} />
        </Card>
        <Card title="ROAS by platform">
          <Chart type="bar" height={280} series={[{ name: la, data: plats.map((p) => +(a.byPlatform[p]?.roas || 0).toFixed(2)) }, { name: lb, data: plats.map((p) => +(b.byPlatform[p]?.roas || 0).toFixed(2)) }]} options={bar('roas', roasFmt)} />
        </Card>
      </div>
      {mode === 'week' && r.weekA && (
        <Card title="Week A vs week B: daily sales (₹)">
          <Chart type="line" height={300}
            series={[{ name: la, data: dayAxis(r.weekA).map((k) => a.byDate[k] || 0) }, { name: lb, data: dayAxis(r.weekB).map((k) => b.byDate[k] || 0) }]}
            options={{ colors: [A, B], markers: { size: 4 }, legend: { position: 'top' }, xaxis: { categories: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'] }, yaxis: { labels: { formatter: fmt } }, tooltip: { y: { formatter: fmt } } }} />
        </Card>
      )}
    </>
  );
}

function MultiResult({ r }) {
  const { periods, tag } = r;
  if (!periods.length) return <Empty title="No periods to compare" />;
  const labels = periods.map((p) => p.label);
  const growth = periods.map((p, i) => (i === 0 ? 0 : periods[i - 1].agg.total.sales > 0 ? +(((p.agg.total.sales - periods[i - 1].agg.total.sales) / periods[i - 1].agg.total.sales) * 100).toFixed(1) : 0));
  return (
    <>
      <div className="multi-grid" style={{ '--n': Math.min(periods.length, 4) }}>
        {periods.map((p, i) => {
          const t = p.agg.total;
          const d = i ? delta(t.sales, periods[i - 1].agg.total.sales) : null;
          return (
            <div key={p.label} className="stat" style={{ borderTop: `2px solid ${i === 0 ? '#555b6b' : A}` }}>
              <div className="eyebrow">{p.label}</div>
              <div className="stat-val big">{fmt(t.sales)}</div>
              <div className="stat-meta mono"><span>ROAS {t.roas > 0 ? t.roas.toFixed(2) + 'x' : '--'}</span><span>{fmt(t.units, false)} units</span></div>
              <div className="stat-meta mono"><span>Spends {t.spends > 0 ? fmt(t.spends) : '--'}</span></div>
              <div className={`delta-line ${i === 0 || d === null ? 'neu' : d >= 0 ? 'pos' : 'neg'}`}>{i === 0 ? 'Baseline' : d === null ? '--' : `${d >= 0 ? '▲' : '▼'} ${Math.abs(d).toFixed(1)}% ${tag}`}</div>
            </div>
          );
        })}
      </div>
      <Card title={`${labels[0]} → ${labels[labels.length - 1]} · ${tag} trajectory`}>
        <Chart type="line" height={320}
          series={[{ name: 'Sales', type: 'column', data: periods.map((p) => Math.round(p.agg.total.sales)) }, { name: `${tag} growth %`, type: 'line', data: growth }]}
          options={{
            colors: [A, B],
            stroke: { width: [0, 3], curve: 'smooth' },
            markers: { size: [0, 5] },
            plotOptions: { bar: { borderRadius: 4, columnWidth: '50%' } },
            legend: { position: 'top' },
            xaxis: { categories: labels },
            yaxis: [{ labels: { formatter: fmt }, title: { text: 'Sales (₹)', style: { color: '#8a90a2', fontSize: '11px' } } }, { opposite: true, labels: { formatter: (v) => v.toFixed(0) + '%', style: { colors: B } }, title: { text: 'Growth %', style: { color: B, fontSize: '11px' } } }],
            tooltip: { shared: true, y: [{ formatter: fmt }, { formatter: (v) => v.toFixed(1) + '%' }] },
          }} />
      </Card>
    </>
  );
}

function DailyResult({ r }) {
  const { days } = r;
  return (
    <>
      <Card title={`Daily sales · ${days[0].key} → ${days[days.length - 1].key}`}>
        <Chart type="area" height={280} series={[{ name: 'Daily sales', data: days.map((d) => d.sales) }]}
          options={{ colors: [A], fill: areaFill(0.3), markers: { size: 3 }, xaxis: { categories: days.map((d) => shortDayLabel(d.key)), tickAmount: Math.min(15, days.length), labels: { rotate: -45, rotateAlways: true } }, yaxis: { labels: { formatter: fmt } }, tooltip: { y: { formatter: fmt } } }} />
      </Card>
      <div className="card table-card">
        <header className="card-head"><h3 className="card-title">Day by day</h3><span className="card-caption">{days.length} days</span></header>
        <div className="table-scroll">
          <table className="table" style={{ minWidth: 720 }}>
            <thead><tr><th>Date</th><th className="r">Sales</th><th className="r">Ad spends</th><th className="r">ROAS</th><th className="r">Units</th><th className="r">DoD %</th></tr></thead>
            <tbody>
              {days.map((d, i) => {
                const prev = i ? days[i - 1].sales : 0;
                const dod = i && prev > 0 ? ((d.sales - prev) / prev) * 100 : null;
                return (
                  <tr key={d.key}>
                    <td className="strong">{dateLabel(d.key)}</td>
                    <td className="r strong">{fmt(d.sales)}</td>
                    <td className="r">{d.spends > 0 ? fmt(d.spends) : '--'}</td>
                    <td className="r">{d.roas > 0 ? d.roas.toFixed(2) + 'x' : '--'}</td>
                    <td className="r">{fmt(d.units, false)}</td>
                    <td className="r mono" style={{ color: dod === null ? 'var(--muted)' : dod >= 0 ? 'var(--green)' : 'var(--red)' }}>{dod === null ? '--' : `${dod >= 0 ? '▲' : '▼'} ${Math.abs(dod).toFixed(1)}%`}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
