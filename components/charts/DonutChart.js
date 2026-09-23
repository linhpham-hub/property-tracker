import { useState } from "react";

// Rose-palette rotation for multi-category charts (donut, and anything
// else with more than one series' worth of categories to tell apart).
const PALETTE = ["var(--navy)", "var(--heading)", "var(--brass-dark)", "var(--green)", "var(--red)", "var(--ink-soft)"];

// Part-to-whole breakdown for a small number of categories. Used for
// "Pipeline stage" — a donut answers "what share of the pipeline is in
// each stage" faster than a bar does, and gives the dashboard a second
// chart form instead of bars everywhere.
export default function DonutChart({ data, size = 200, thickness = 28, valueFormat = (v) => v.toLocaleString() }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const r = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * r;

  let cumulative = 0;
  const segments = data.map((d, i) => {
    const frac = d.value / total;
    const dash = frac * circumference;
    const offset = -cumulative * circumference;
    cumulative += frac;
    return { ...d, dash, offset, color: PALETTE[i % PALETTE.length], pct: Math.round(frac * 100) };
  });

  return (
    <div className="chart-wrap donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="chart-svg donut-svg" role="img">
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {segments.map((s, i) => (
            <circle
              key={s.label}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={thickness}
              strokeDasharray={`${s.dash} ${circumference - s.dash}`}
              strokeDashoffset={s.offset}
              opacity={hoverIdx === null || hoverIdx === i ? 1 : 0.35}
              style={{ transition: "opacity 0.1s ease", cursor: "pointer" }}
              onMouseEnter={() => setHoverIdx(i)}
              onMouseLeave={() => setHoverIdx(null)}
            />
          ))}
        </g>
        <text x={cx} y={cy - 3} textAnchor="middle" className="donut-center-value">
          {total.toLocaleString()}
        </text>
        <text x={cx} y={cy + 15} textAnchor="middle" className="donut-center-label">
          total
        </text>
      </svg>
      <ul className="donut-legend">
        {segments.map((s, i) => (
          <li
            key={s.label}
            className={hoverIdx === i ? "hover" : ""}
            onMouseEnter={() => setHoverIdx(i)}
            onMouseLeave={() => setHoverIdx(null)}
          >
            <span className="donut-swatch" style={{ background: s.color }} />
            <span className="donut-legend-label">{s.label}</span>
            <span className="donut-legend-value">
              {valueFormat(s.value)} ({s.pct}%)
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
