import { useEffect, useState } from 'react';
import { DataProvider, useData } from './data/DataContext';
import { FiltersProvider, useFilters } from './data/FiltersContext';
import { useFilteredRows } from './data/hooks';
import { Segmented, Select } from './components/ui';
import Logo from './components/Logo';
import { useTheme } from './theme';
import { ALL_MONTHS, PERIODS, PERIOD_LABELS, PLATFORMS } from './config';
import { monthsWithData } from './lib/selectors';
import Overview from './tabs/Overview';
import Channel from './tabs/Channel';
import Compare from './tabs/Compare';
import SkuView from './tabs/SkuView';
import SkuCompare from './tabs/SkuCompare';
import Shopify from './tabs/Shopify';
import DeepDive from './tabs/DeepDive';

const TAB_GROUPS = [
  [{ id: 'overview', label: 'Overview' }, { id: 'compare', label: 'Compare' }],
  [{ id: 'Blinkit', label: 'Blinkit' }, { id: 'Zepto', label: 'Zepto' }, { id: 'Instamart', label: 'Instamart' }, { id: 'Big Basket', label: 'Big Basket' }],
  [{ id: 'skus', label: 'SKU view' }, { id: 'skucompare', label: 'SKU compare' }],
  [{ id: 'shopify', label: 'Shopify' }, { id: 'deepdive', label: 'Deep dive' }],
];
const CHANNEL_TABS = new Set(['Blinkit', 'Zepto', 'Instamart', 'Big Basket']);
const USES_FILTERS = new Set(['overview', 'skus', 'deepdive', ...CHANNEL_TABS]);
const TITLES = {
  overview: 'Executive overview', compare: 'Compare periods', skus: 'SKU view', skucompare: 'SKU compare',
  shopify: 'Shopify', deepdive: 'Deep dive',
};

export default function App() {
  return (
    <DataProvider>
      <Gate />
    </DataProvider>
  );
}

function Gate() {
  return (
    <FiltersProvider>
      <Shell />
    </FiltersProvider>
  );
}

function InlineLoader({ label = 'Loading data' }) {
  return (
    <div className="inline-loader" role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

function InlineError({ message, onRetry }) {
  return (
    <div className="inline-error" role="alert">
      <p className="strong">Couldn't load the dashboard</p>
      <p className="muted small">{message}</p>
      <button type="button" className="btn-primary" onClick={onRetry}>Try again</button>
    </div>
  );
}

function Shell() {
  const [tab, setTab] = useState('overview');
  const [ddMetric, setDdMetric] = useState('sales');
  const { refresh, refreshing, loadedAt, oms, status, error } = useData();
  const loading = status === 'loading';
  const { latest } = useData();
  const { pref, setPref } = useTheme();

  // Cursor-follow highlight on cards (sets --mx/--my; purely cosmetic).
  useEffect(() => {
    const onMove = (e) => {
      const el = e.target.closest?.('.card, .kpi, .platform-card');
      if (!el) return;
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    };
    document.addEventListener('pointermove', onMove, { passive: true });
    return () => document.removeEventListener('pointermove', onMove);
  }, []);

  const openDeepDive = (metric) => { setDdMetric(metric); setTab('deepdive'); };

  return (
    <>
      <a className="skip" href="#content">Skip to content</a>
      <header className="topbar">
        <div className="brand">
          <Logo size={28} />
          <span>Snackible</span>
          <span className="brand-sub">executive</span>
        </div>
        <div className="topbar-right">
          <Segmented size="sm" label="Theme" value={pref} onChange={setPref}
            options={[{ id: 'system', label: 'Auto' }, { id: 'light', label: 'Light' }, { id: 'dark', label: 'Dark' }]} />
          {loading ? (
            <span className="sync mono"><span className="spinner sm" aria-hidden="true" />Loading</span>
          ) : (
            <span className="sync mono" title={loadedAt?.toLocaleString()}>
              <i className="live-dot" />{oms.length.toLocaleString('en-IN')} rows
            </span>
          )}
          <button type="button" className={`btn-ghost ${refreshing ? 'spin' : ''}`} onClick={refresh} disabled={refreshing || loading} title="Clear cache and refetch">
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M23 4v6h-6" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>
            Refresh
          </button>
        </div>
      </header>

      <main className="wrap" id="content">
        <div className="page-head">
          <div className="page-title-row">
            <h1>{TITLES[tab] || tab}</h1>
            {!loading && status === 'ready' && (
              <span className="asof mono" title="Latest day in the sales sheet">
                <i className="live-dot" />Data through {latest.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
          {tab === 'overview' && <p className="lede">Daily pulse across Blinkit, Zepto, Instamart, Big Basket, Amazon, First Club and Shopify.</p>}
        </div>

        <nav className="tabs" aria-label="Sections">
          {TAB_GROUPS.map((g, gi) => (
            <div className="tab-group" key={gi}>
              {g.map((t) => (
                <button key={t.id} type="button" aria-current={tab === t.id ? 'page' : undefined} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)}>{t.label}</button>
              ))}
            </div>
          ))}
        </nav>

        {USES_FILTERS.has(tab) && !loading && status !== 'error' && <FilterBar />}

        {loading && <InlineLoader />}
        {status === 'error' && <InlineError message={error} onRetry={refresh} />}
        {status === 'ready' && <div key={tab} className="fade-in">
          {tab === 'overview' && <Overview onDeepDive={openDeepDive} />}
          {tab === 'compare' && <Compare />}
          {CHANNEL_TABS.has(tab) && <Channel platform={tab} />}
          {tab === 'skus' && <SkuView />}
          {tab === 'skucompare' && <SkuCompare />}
          {tab === 'shopify' && <Shopify />}
          {tab === 'deepdive' && <DeepDive metric={ddMetric} onMetric={setDdMetric} />}
        </div>}
      </main>
    </>
  );
}

function FilterBar() {
  const data = useData();
  const f = useFilters();
  const { rows } = useFilteredRows();
  const months = monthsWithData(data, ALL_MONTHS).slice().reverse();
  const monthOpts = [...months.map((m) => ({ value: m.key, label: m.label })), { value: 'All', label: 'All time' }];
  const monthLabel = f.month === 'All' ? 'All time' : months.find((m) => m.key === f.month)?.label || f.month;
  const dayPeriodsOff = !f.isCurrentMonth;
  const periods = PERIODS.map((p) => ({ ...p, label: p.label }));

  return (
    <section className="filters" aria-label="Filters">
      <div className="filters-row">
        <Segmented label="Period" value={f.period} onChange={f.setPeriod}
          options={periods.filter((p) => !(dayPeriodsOff && (p.id === 't1' || p.id === 't2')))} />
        {f.period === 'custom' && (
          <div className="date-pair">
            <input type="date" className="field" aria-label="Start date" value={f.customStart} onChange={(e) => f.setCustomStart(e.target.value)} />
            <span className="muted">→</span>
            <input type="date" className="field" aria-label="End date" value={f.customEnd} onChange={(e) => f.setCustomEnd(e.target.value)} />
          </div>
        )}
        <Select label="Month" value={f.month} onChange={f.setMonth} options={monthOpts} />
        <Select label="Platform" value={f.platform} onChange={f.setPlatform}
          options={[{ value: 'All', label: 'All platforms' }, ...PLATFORMS.map((p) => ({ value: p, label: p }))]} />
      </div>
      <p className="filters-note mono">
        {monthLabel} · {PERIOD_LABELS[f.period]}{f.platform !== 'All' ? ` · ${f.platform}` : ''} · {rows.length.toLocaleString('en-IN')} records
      </p>
    </section>
  );
}
