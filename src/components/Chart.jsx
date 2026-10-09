import { memo, useMemo } from 'react';
import ReactApexChart from 'react-apexcharts';
import { CHART_COLORS, useTheme } from '../theme';

const FONT = 'Space Grotesk, sans-serif';
export const MONO = 'Geist Mono, monospace';

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
function merge(base, over) {
  const out = { ...base };
  for (const k of Object.keys(over || {})) {
    out[k] = isObj(base[k]) && isObj(over[k]) ? merge(base[k], over[k]) : over[k];
  }
  return out;
}

// Tabs author charts with the dark palette's literal colours; swap them for the active theme.
function remap(node, swap) {
  if (typeof node === 'string') return swap[node] ?? node;
  if (Array.isArray(node)) return node.map((n) => remap(n, swap));
  if (isObj(node)) {
    const out = {};
    for (const k of Object.keys(node)) out[k] = remap(node[k], swap);
    return out;
  }
  return node;
}

function baseFor(c, mode) {
  return {
    chart: {
      background: 'transparent',
      fontFamily: FONT,
      foreColor: c.axis,
      toolbar: { show: false },
      animations: { enabled: true, speed: 450, animateGradually: { enabled: false } },
      zoom: { enabled: false },
    },
    theme: { mode },
    dataLabels: { enabled: false },
    grid: { borderColor: c.grid, strokeDashArray: 3 },
    stroke: { width: 2.5, curve: 'smooth' },
    markers: { size: 0, strokeWidth: 0, hover: { size: 5 } },
    xaxis: {
      labels: { style: { colors: c.axis, fontSize: '11px', fontFamily: MONO } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: { labels: { style: { colors: c.axis, fontSize: '11px', fontFamily: MONO } } },
    legend: {
      labels: { colors: c.axis },
      fontSize: '11px',
      fontFamily: MONO,
      markers: { width: 8, height: 8, radius: 8 },
      itemMargin: { horizontal: 8, vertical: 4 },
    },
    tooltip: { theme: mode },
    states: { hover: { filter: { type: 'lighten', value: 0.05 } } },
  };
}

export const areaFill = (from = 0.32) => ({
  type: 'gradient',
  gradient: { shade: 'dark', type: 'vertical', opacityFrom: from, opacityTo: 0.02, stops: [0, 100] },
});

/** Custom tooltip card; reads the theme at hover time so it always matches the page. */
export function tooltipCard(title, lines) {
  const c = CHART_COLORS[document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'];
  const rows = lines
    .filter(Boolean)
    .map(([text, color]) => `<div style="color:${color || c.tipMuted};font-family:${MONO};font-size:12px;margin-top:4px">${text}</div>`)
    .join('');
  return `<div style="padding:8px 12px;background:${c.surface};border:1px solid ${c.tipBorder};border-radius:8px;box-shadow:0 10px 24px -12px rgba(0,0,0,.4)"><div style="color:${c.tipText};font-weight:600;font-size:12px">${title}</div>${rows}</div>`;
}

export function donutLabels({ size = '66%', total, valueFmt, totalLabel = 'Total', valueSize = '18px' }) {
  return {
    pie: {
      donut: {
        size,
        labels: {
          show: true,
          name: { show: true, fontSize: '11px', color: '#6b7280', fontFamily: MONO },
          value: { show: true, fontSize: valueSize, fontWeight: 600, color: '#f0f0f0', fontFamily: MONO, formatter: (v) => valueFmt(Number(v)) },
          total: { show: true, label: totalLabel, color: '#9ca3b3', fontFamily: MONO, formatter: () => valueFmt(total) },
        },
      },
    },
  };
}

function Chart({ type = 'line', height = 260, series, options }) {
  const { theme } = useTheme();
  const merged = useMemo(() => {
    const c = CHART_COLORS[theme];
    const swap = theme === 'light'
      ? { '#12141b': c.surface, '#f0f0f0': c.text, '#9ca3b3': c.axis, '#8a90a2': c.axis, 'rgba(255,255,255,0.2)': c.line, '#0b0c10': '#ffffff' }
      : {};
    return remap(merge(baseFor(c, theme), options), swap);
  }, [theme, options]);
  return <ReactApexChart key={theme} type={type} height={height} series={series} options={merged} />;
}

export default memo(Chart);
