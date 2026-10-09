import { useMemo } from 'react';
import Chart from '../components/Chart';
import Donut from '../components/Donut';
import { Card, Empty, Kpi, KpiGrid, SectionHead } from '../components/ui';
import { PAID_CHANNELS, PLATFORM_CONFIG, platColor } from '../config';
import { useFilteredRows } from '../data/hooks';
import { blendedPaidRoas, dailyMap } from '../lib/selectors';
import { fmt, fmtRoas, fmtShort, fmtUnits } from '../lib/utils';

function DeepDiveLink({ onClick }) {
  return <button type="button" className="link-btn" onClick={onClick}>Deep dive →</button>;
}

export default function Overview({ onDeepDive }) {
  const { rows, agg } = useFilteredRows();

  const k = useMemo(() => {
    const totalSales = Object.values(agg).reduce((s, d) => s + d.sales, 0);
    const totalSpends = Object.values(agg).reduce((s, d) => s + d.spends, 0);
    const totalUnits = Object.values(agg).reduce((s, d) => s + d.units, 0);
    const { roas } = blendedPaidRoas(agg);
    let best = '--', bestRoas = 0;
    Object.entries(agg).forEach(([p, a]) => {
      if (a.roas > bestRoas && a.spends > 0) { bestRoas = a.roas; best = p; }
    });
    const sales = dailyMap(rows, 'Sales');
    const spends = dailyMap(rows, 'Spends');
    const units = dailyMap(rows, 'Units');
    const days = Object.keys(sales).sort();
    return {
      totalSales, totalSpends, totalUnits, roas, best, bestRoas,
      platformCount: Object.keys(agg).length,
      salesSpark: days.map((d) => Math.round(sales[d])),
      spendsSpark: days.map((d) => Math.round(spends[d] || 0)),
      unitsSpark: days.map((d) => Math.round(units[d] || 0)),
      roasSpark: days.map((d) => (spends[d] > 0 ? +(sales[d] / spends[d]).toFixed(2) : 0)),
    };
  }, [rows, agg]);

  if (!rows.length) {
    return <Empty title="No data for these filters" hint="Try a different month, period or platform." />;
  }

  const bySales = Object.entries(agg).filter(([, v]) => v.sales > 0).sort((a, b) => b[1].sales - a[1].sales);
  const byUnits = Object.entries(agg).filter(([, v]) => v.units > 0).sort((a, b) => b[1].units - a[1].units);
  const byRoas = Object.entries(agg)
    .filter(([p, v]) => PAID_CHANNELS.includes(p) && v.spends > 0 && v.sales > 0)
    .sort((a, b) => b[1].roas - a[1].roas);

  const roasHealthy = k.roas >= 2;

  return (
    <div className="stack">
      <KpiGrid cols={3}>
        <Kpi label="Total sales" value={k.totalSales} format={fmt} accent="#f97316" sparkColor="#f97316"
          sub={`${k.platformCount} platform${k.platformCount !== 1 ? 's' : ''}`} spark={k.salesSpark} />
        <Kpi label="Total ad spends" value={k.totalSpends} format={fmt} accent="#8b7cf6" sparkColor="#8b7cf6"
          sub={k.totalSpends > 0 ? 'Tracked budget' : 'No tracked spends'} spark={k.spendsSpark} />
        <Kpi label="Blended ROAS" value={k.roas} format={(v) => (v > 0 ? fmtRoas(v) : '--')}
          accent={roasHealthy ? '#22c55e' : k.roas > 0 ? '#eab308' : '#6b7280'}
          sparkColor={roasHealthy ? '#22c55e' : '#eab308'}
          sub={roasHealthy ? '▲ Healthy' : k.roas > 0 ? '△ Monitor' : 'Spends not tracked'}
          subTone={roasHealthy ? 'pos' : 'neu'} spark={k.roasSpark} />
        <Kpi label="Total units" value={k.totalUnits} format={(v) => fmt(v, false)} accent="#3b82f6" sparkColor="#3b82f6"
          sub={k.totalUnits > 0 ? `ASP ₹${(k.totalSales / k.totalUnits).toFixed(0)}` : ''} spark={k.unitsSpark} />
        <Kpi label="Best ROAS platform" value={k.best} accent={k.best !== '--' ? platColor(k.best) : '#6b7280'}
          sub={k.bestRoas > 0 ? fmtRoas(k.bestRoas) : '--'} subTone="pos" />
        <Kpi label="Active platforms" value={k.platformCount} accent="#eab308"
          sub={`of ${Object.keys(PLATFORM_CONFIG).length} tracked`} />
      </KpiGrid>

      <SectionHead title="Efficiency and scale" caption="Sales mix, unit volume and return on ad spend" />
      <div className="grid-3">
        <Card title="Sales mix (₹)" action={<DeepDiveLink onClick={() => onDeepDive('sales')} />}>
          <Donut height={210} labels={bySales.map(([p]) => p)} values={bySales.map(([, v]) => v.sales)} colors={bySales.map(([p]) => platColor(p))} total={k.totalSales} valueFmt={fmtShort} legendValue={false} />
        </Card>
        <Card title="ROAS by platform" action={<DeepDiveLink onClick={() => onDeepDive('roas')} />}>
          {byRoas.length ? (
            <Chart type="bar" height={250}
              series={[{ name: 'ROAS', data: byRoas.map(([, v]) => +v.roas.toFixed(2)) }]}
              options={{
                colors: byRoas.map(([p]) => platColor(p)),
                plotOptions: { bar: { borderRadius: 6, columnWidth: '48%', distributed: true } },
                legend: { show: false },
                xaxis: { categories: byRoas.map(([p]) => p) },
                yaxis: { labels: { formatter: (v) => v.toFixed(1) + 'x' } },
                tooltip: { y: { formatter: (v) => v.toFixed(2) + 'x' } },
              }} />
          ) : <Empty title="No tracked ad spend" hint="ROAS covers Blinkit, Zepto and Instamart." />}
        </Card>
        <Card title="Units mix" action={<DeepDiveLink onClick={() => onDeepDive('qty')} />}>
          <Donut height={210} labels={byUnits.map(([p]) => p)} values={byUnits.map(([, v]) => v.units)} colors={byUnits.map(([p]) => platColor(p))} total={k.totalUnits} valueFmt={fmtUnits} legendValue={false} />
        </Card>
      </div>

      <SectionHead title="Channel scorecards" caption="Sales, units, spend and pacing per platform" />
      <div className="platform-grid">
        {Object.keys(agg).sort((a, b) => agg[b].sales - agg[a].sales).map((p) => {
          const d = agg[p];
          const budget = PLATFORM_CONFIG[p]?.budget || 0;
          const asp = d.units > 0 ? Math.round(d.sales / d.units) : 0;
          const pacing = budget > 0 ? Math.min(100, (d.spends / budget) * 100) : null;
          return (
            <article key={p} className="platform-card" style={{ '--p': platColor(p) }}>
              <header>
                <h3>{p}</h3>
                <span className={`chip ${d.roas >= 2 ? 'pos' : d.roas > 0 ? 'warn' : 'neu'}`}>ROAS {fmtRoas(d.roas)}</span>
              </header>
              <dl>
                <div><dt>Sales</dt><dd>{fmt(d.sales)}</dd></div>
                <div><dt>Units</dt><dd>{fmt(d.units, false)}</dd></div>
                <div><dt>Spends</dt><dd className="mono">{d.spends > 0 ? fmt(d.spends) : '--'}</dd></div>
                <div><dt>ASP</dt><dd className="mono">{asp > 0 ? '₹' + asp : '--'}</dd></div>
                {pacing !== null && <div><dt>Budget pacing</dt><dd className="mono">{pacing.toFixed(1)}%</dd></div>}
              </dl>
            </article>
          );
        })}
      </div>
    </div>
  );
}
