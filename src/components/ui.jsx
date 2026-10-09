import { useEffect, useRef, useState } from 'react';
import Chart from './Chart';

export function Card({ title, caption, action, children, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="card-head">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {caption && <p className="card-caption">{caption}</p>}
          </div>
          {action && <div className="card-action">{action}</div>}
        </header>
      )}
      {children}
    </section>
  );
}

export function SectionHead({ title, caption, right }) {
  return (
    <div className="section-head">
      <div>
        <h2>{title}</h2>
        {caption && <p>{caption}</p>}
      </div>
      {right}
    </div>
  );
}

export function Segmented({ options, value, onChange, size = 'md', label }) {
  return (
    <div className={`seg seg-${size}`} role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          title={o.title}
          aria-pressed={value === o.id}
          className={value === o.id ? 'on' : ''}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Select({ value, onChange, options, label, small = false, className = '' }) {
  return (
    <select
      className={`select ${small ? 'select-sm' : ''} ${className}`}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

export function Delta({ value, suffix = '%', digits = 1 }) {
  if (value === null || value === undefined || isNaN(value)) return <span className="chip neu">–</span>;
  const cls = value > 0 ? 'pos' : value < 0 ? 'neg' : 'neu';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '→';
  return <span className={`chip ${cls}`}>{arrow} {Math.abs(value).toFixed(digits)}{suffix}</span>;
}

/** Counts up from the previous value; skips animation if the user prefers reduced motion. */
export function AnimatedValue({ value, format }) {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof value !== 'number') { setShown(value); from.current = value; return; }
    const start = performance.now();
    const a = from.current;
    let raf;
    const tick = (t) => {
      const p = Math.min(1, (t - start) / 600);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(a + (value - a) * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{typeof shown === 'number' ? format(shown) : shown}</>;
}

export function Kpi({ label, value, format, sub, subTone = 'neu', accent = 'var(--accent)', spark, sparkColor, delta }) {
  return (
    <article className="kpi" style={{ '--k': accent }}>
      <div className="kpi-body">
        <div className="kpi-label">{label}</div>
        <div className="kpi-value">
          {format ? <AnimatedValue value={value} format={format} /> : value}
        </div>
        <div className="kpi-foot">
          {delta !== undefined && <Delta value={delta} />}
          {sub && <span className={`chip ${subTone}`}>{sub}</span>}
        </div>
      </div>
      {spark && spark.length > 1 && (
        <div className="kpi-spark" aria-hidden="true">
          <Chart
            type="area"
            height={52}
            series={[{ data: spark }]}
            options={{
              chart: { sparkline: { enabled: true }, animations: { enabled: false } },
              stroke: { width: 2, curve: 'smooth' },
              fill: { type: 'gradient', gradient: { opacityFrom: 0.4, opacityTo: 0, stops: [0, 100] } },
              colors: [sparkColor || '#f97316'],
              tooltip: { enabled: false },
            }}
          />
        </div>
      )}
    </article>
  );
}

export function Empty({ title = 'Nothing to show', hint }) {
  return (
    <div className="empty">
      <div className="empty-mark" aria-hidden="true">◌</div>
      <p className="empty-title">{title}</p>
      {hint && <p className="empty-hint">{hint}</p>}
    </div>
  );
}

export function Skeleton({ height = 180, lines }) {
  if (lines) {
    return (
      <div className="skeleton-lines">
        {Array.from({ length: lines }).map((_, i) => <div key={i} className="skeleton" style={{ height: 14, width: `${90 - i * 7}%` }} />)}
      </div>
    );
  }
  return <div className="skeleton" style={{ height }} />;
}

export function PctBar({ pct, color }) {
  return (
    <div className="pct">
      <div className="pct-track"><div className="pct-fill" style={{ width: `${Math.min(100, pct).toFixed(1)}%`, background: color }} /></div>
      <span>{pct.toFixed(1)}%</span>
    </div>
  );
}

export function CatBadge({ cat, color }) {
  return <span className="badge" style={{ '--b': color }}>{cat}</span>;
}

export function KpiGrid({ children, cols }) {
  return <div className="kpi-grid" style={cols ? { '--cols': cols } : undefined}>{children}</div>;
}
