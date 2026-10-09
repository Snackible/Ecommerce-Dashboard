import { useMemo, useState } from 'react';
import Chart from '../components/Chart';
import { Card, Empty, Kpi, KpiGrid } from '../components/ui';
import { FY_CUR_MONTHS } from '../config';
import { useData } from '../data/DataContext';
import { fmt, dateLabel, shortDayLabel } from '../lib/utils';

const SHOPIFY = '#ec4899';

export default function Shopify() {
  const { oms, latest } = useData();
  const defaultKey = `${latest.getFullYear()}-${String(latest.getMonth() + 1).padStart(2, '0')}`;
  const [key, setKey] = useState(FY_CUR_MONTHS.some((m) => m.key === defaultKey) ? defaultKey : FY_CUR_MONTHS[0].key);
  const cur = FY_CUR_MONTHS.find((m) => m.key === key);

  const rows = useMemo(() => oms
    .filter((r) => r.Platform === 'Shopify' && r._y === cur.y && r._m === cur.m)
    .map((r) => ({
      day: r._day, sales: r.Sales, spends: r.Spends, roi: r.ROAS, orders: r.Units,
      aov: r.Units > 0 ? r.Sales / r.Units : 0,
    }))
    .sort((a, b) => a.day.localeCompare(b.day)), [oms, cur]);

  const totalSales = rows.reduce((s, r) => s + r.sales, 0);
  const totalSpends = rows.reduce((s, r) => s + r.spends, 0);
  const totalOrders = rows.reduce((s, r) => s + r.orders, 0);
  const validRoi = rows.filter((r) => r.roi > 0);
  const avgRoi = validRoi.length ? validRoi.reduce((s, r) => s + r.roi, 0) / validRoi.length : 0;
  const aov = totalOrders > 0 ? totalSales / totalOrders : 0;
  const days = rows.map((r) => shortDayLabel(r.day));

  return (
    <div className="stack">
      <div className="toolbar between">
        <div>
          <h2 className="h2">Shopify</h2>
          <p className="muted small">Direct-to-consumer · {rows.length ? `${rows.length} days of data` : 'no data'}</p>
        </div>
        <div className="chip-row" role="group" aria-label="Month">
          {FY_CUR_MONTHS.map((m) => (
            <button key={m.key} type="button" className={`pill ${m.key === key ? 'on' : ''}`} aria-pressed={m.key === key} onClick={() => setKey(m.key)}>{m.label}</button>
          ))}
        </div>
      </div>

      {!rows.length ? <Empty title="No Shopify data for this month" hint="Pick another month above." /> : (
        <>
          <KpiGrid cols={3}>
            <Kpi label="Shopify GMV" value={totalSales} format={fmt} accent={SHOPIFY} sub={`${rows.length} days`} />
            <Kpi label="GT spends" value={totalSpends} format={(v) => (v > 0 ? fmt(v) : '--')} accent="#3b82f6" sub="Total ad spend" />
            <Kpi label="Avg ROI" value={avgRoi} format={(v) => (v > 0 ? v.toFixed(2) + 'x' : '--')}
              accent={avgRoi >= 3 ? '#22c55e' : '#eab308'} sub={avgRoi >= 3 ? '▲ Healthy' : avgRoi > 0 ? '△ Monitor' : 'No spends tracked'} subTone={avgRoi >= 3 ? 'pos' : 'neu'} />
            <Kpi label="Total orders" value={totalOrders} format={(v) => (v > 0 ? Math.round(v).toLocaleString('en-IN') : '--')} accent="#f97316" sub="MTD" />
            <Kpi label="AOV" value={aov} format={(v) => (v > 0 ? '₹' + v.toFixed(0) : '--')} accent="#8b7cf6" sub="Avg order value" />
            <Kpi label="Cost per order" value={totalOrders > 0 ? totalSpends / totalOrders : 0} format={(v) => (v > 0 ? '₹' + v.toFixed(0) : '--')} accent="#eab308" sub="Spend ÷ orders" />
          </KpiGrid>

          <div className="grid-2">
            <Card title="Daily GMV (₹)">
              <Chart type="bar" height={240} series={[{ name: 'GMV', data: rows.map((r) => r.sales) }]}
                options={{
                  colors: [SHOPIFY],
                  plotOptions: { bar: { borderRadius: 4, columnWidth: '60%' } },
                  xaxis: { categories: days, tickAmount: 8, labels: { rotate: -45, rotateAlways: true } },
                  yaxis: { labels: { formatter: fmt } },
                  tooltip: { y: { formatter: fmt } },
                }} />
            </Card>
            <Card title="Daily ROI">
              <Chart type="line" height={240} series={[{ name: 'ROI', data: rows.map((r) => +r.roi.toFixed(2)) }]}
                options={{
                  colors: ['#22c55e'],
                  markers: { size: 3 },
                  xaxis: { categories: days, tickAmount: 8, labels: { rotate: -45, rotateAlways: true } },
                  yaxis: { labels: { formatter: (v) => (v > 0 ? v.toFixed(1) + 'x' : '--') } },
                  annotations: { yaxis: [{ y: 3, borderColor: 'rgba(255,255,255,0.2)', strokeDashArray: 4, label: { text: '3x target', style: { color: '#8a90a2', background: 'transparent', fontSize: '10px' } } }] },
                  tooltip: { y: { formatter: (v) => (v > 0 ? v.toFixed(2) + 'x' : '--') } },
                }} />
            </Card>
          </div>

          <div className="card table-card">
            <header className="card-head">
              <h3 className="card-title">Day by day · {cur.label}</h3>
              <span className="card-caption">{rows.length} days</span>
            </header>
            <div className="table-scroll">
              <table className="table" style={{ minWidth: 640 }}>
                <thead><tr><th>Date</th><th className="r">GMV</th><th className="r">GT spends</th><th className="r">Orders</th><th className="r">AOV</th><th className="r">ROI</th></tr></thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.day}>
                      <td className="strong">{dateLabel(r.day)}</td>
                      <td className="r strong">{fmt(r.sales)}</td>
                      <td className="r">{r.spends > 0 ? fmt(r.spends) : '--'}</td>
                      <td className="r">{r.orders > 0 ? r.orders : '--'}</td>
                      <td className="r">{r.aov > 0 ? '₹' + r.aov.toFixed(0) : '--'}</td>
                      <td className="r" style={{ color: r.roi >= 3 ? 'var(--green)' : r.roi > 0 ? 'var(--yellow)' : undefined }}>{r.roi > 0 ? r.roi.toFixed(2) + 'x' : '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
