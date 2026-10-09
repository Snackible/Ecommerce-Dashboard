import { useState } from 'react';
import Chart, { MONO, tooltipCard } from './Chart';

/** Donut with a readable centre label and a custom legend (name, share, value). */
export default function Donut({
  labels, values, colors, total, valueFmt, totalLabel = 'Total', height = 230,
  layout = 'below', ringSize = '74%', options = {}, legendValue = true,
}) {
  const [hover, setHover] = useState(null);
  const sum = values.reduce((a, b) => a + b, 0);
  const shown = total ?? sum;

  const opts = {
    labels,
    colors,
    legend: { show: false },
    stroke: { width: 3, colors: ['#12141b'] },
    plotOptions: {
      pie: {
        expandOnClick: false,
        donut: {
          size: ringSize,
          labels: {
            show: true,
            name: { show: true, fontSize: '10px', fontFamily: MONO, color: '#6b7280', offsetY: -8, formatter: (n) => String(n).toUpperCase().slice(0, 16) },
            value: { show: true, fontSize: '24px', fontWeight: 600, fontFamily: MONO, color: '#f0f0f0', offsetY: 6, formatter: (v) => valueFmt(Number(v)) },
            total: { show: true, showAlways: true, label: totalLabel, fontSize: '10px', fontFamily: MONO, color: '#6b7280', formatter: () => valueFmt(shown) },
          },
        },
      },
    },
    states: { hover: { filter: { type: 'none' } }, active: { filter: { type: 'none' } } },
    tooltip: {
      custom: ({ seriesIndex }) => tooltipCard(labels[seriesIndex], [
        [valueFmt(values[seriesIndex]), colors[seriesIndex]],
        [`${sum > 0 ? ((values[seriesIndex] / sum) * 100).toFixed(1) : '0.0'}% of ${totalLabel.toLowerCase()}`],
      ]),
    },
    ...options,
  };

  return (
    <div className={`donut donut-${layout}`}>
      <div className="donut-chart">
        <Chart type="donut" height={height} series={values} options={opts} />
      </div>
      <ul className="donut-legend">
        {labels.map((l, i) => {
          const pct = sum > 0 ? (values[i] / sum) * 100 : 0;
          return (
            <li key={l + i} className={hover === i ? 'on' : ''} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <i style={{ background: colors[i] }} />
              <span className="donut-name" title={l}>{l}</span>
              <span className="donut-pct mono">{pct < 0.1 ? '<0.1' : pct.toFixed(1)}%</span>
              {legendValue && <span className="donut-val mono">{valueFmt(values[i])}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
