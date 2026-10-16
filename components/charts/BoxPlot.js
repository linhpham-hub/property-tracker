import { useState } from "react";

// Horizontal box plots, one row per group, on a shared axis.
// Box = middle 50% (Q1–Q3), line = median, whiskers = 1.5×IQR fences
// (last value inside them), diamond = mean. Outliers beyond the whiskers
// are counted rather than drawn, to keep 100+ dots from swamping the view.
export default function BoxPlot({ rows, valueLabel = "value", xMax }) {
  const [hover, setHover] = useState(null);
  const width = 900;
  const labelW = 220;
  const right = 100;
  const rowH = 30;
  const top = 8;
  const axisH = 26;
  const height = top + rows.length * rowH + axisH;
  const max = xMax || Math.max(1, ...rows.map((r) => r.box.whiskerHi));
  const niceMax = niceCeil(max);
  const plotW = width - labelW - right;
  const x = (v) => labelW + (Math.min(v, niceMax) / niceMax) * plotW;
  const ticks = [0, 1, 2, 3, 4, 5].map((k) => (niceMax / 5) * k);

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={top} y2={height - axisH} className="chart-grid" />
            <text x={x(t)} y={height - 8} textAnchor="middle" className="chart-tick">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {rows.map((r, i) => {
          const cy = top + i * rowH + rowH / 2;
          const b = r.box;
          const h = 14;
          const on = hover === i;
          return (
            <g key={r.label} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={0} y={cy - rowH / 2} width={width} height={rowH} fill="transparent" />
              <text x={labelW - 10} y={cy + 3.5} textAnchor="end" className="chart-axis-label">
                {truncate(r.label, 30)}
              </text>
              <line x1={x(b.whiskerLo)} x2={x(b.q1)} y1={cy} y2={cy} stroke="var(--ink-soft)" strokeWidth="1.5" />
              <line x1={x(b.q3)} x2={x(b.whiskerHi)} y1={cy} y2={cy} stroke="var(--ink-soft)" strokeWidth="1.5" />
              <line x1={x(b.whiskerLo)} x2={x(b.whiskerLo)} y1={cy - 5} y2={cy + 5} stroke="var(--ink-soft)" strokeWidth="1.5" />
              <line x1={x(b.whiskerHi)} x2={x(b.whiskerHi)} y1={cy - 5} y2={cy + 5} stroke="var(--ink-soft)" strokeWidth="1.5" />
              <rect
                x={x(b.q1)}
                y={cy - h / 2}
                width={Math.max(2, x(b.q3) - x(b.q1))}
                height={h}
                rx={3}
                fill={on ? "var(--heading)" : "var(--navy)"}
                opacity={0.85}
              />
              <line x1={x(b.median)} x2={x(b.median)} y1={cy - h / 2 - 2} y2={cy + h / 2 + 2} stroke="var(--paper-raised)" strokeWidth="2.5" />
              <path
                d={`M ${x(b.mean)} ${cy - 4} L ${x(b.mean) + 4} ${cy} L ${x(b.mean)} ${cy + 4} L ${x(b.mean) - 4} ${cy} Z`}
                fill="var(--ink)"
              />
              <text x={width - right + 8} y={cy + 3.5} className="chart-tag-label">
                {b.outliers > 0 ? `+${b.outliers} outliers` : ""}
              </text>
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" role="status">
          <strong>{rows[hover].label}</strong>
          <span>
            median {fmt(rows[hover].box.median)} · middle 50% {fmt(rows[hover].box.q1)}–{fmt(rows[hover].box.q3)} · mean{" "}
            {fmt(rows[hover].box.mean)} · max {fmt(rows[hover].box.max)} {valueLabel}
          </span>
        </div>
      )}
    </div>
  );
}

const fmt = (v) => (Number.isInteger(v) ? v : v.toFixed(1));
function niceCeil(v) {
  if (v <= 10) return 10;
  const m = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / m;
  return (n <= 2 ? 2 : n <= 5 ? 5 : 10) * m;
}
function truncate(s, n) {
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
