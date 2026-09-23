import { useState } from "react";

// Horizontal single-hue bar chart — for categories with longer labels
// (drop/close reasons) where a vertical column chart would crowd the
// x-axis. Same mark spec as BarChart: capped thickness, rounded data-end
// (here the right end, since bars grow rightward), value at the tip.
export default function HBarChart({ data, barHeight = 22, rowGap = 14, valueFormat = (v) => v.toLocaleString() }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const width = 560;
  const labelWidth = 172;
  const padding = { top: 6, right: 110, bottom: 6 };
  const chartAreaWidth = width - labelWidth - padding.right;
  const rowHeight = barHeight + rowGap;
  const height = data.length * rowHeight + padding.top + padding.bottom - rowGap;

  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = niceCeiling(max);

  function wFor(v) {
    return (v / niceMax) * chartAreaWidth;
  }

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img">
        {data.map((d, i) => {
          const y = padding.top + i * rowHeight;
          const barW = Math.max(wFor(d.value), 2);
          const hovered = hoverIdx === i;
          return (
            <g key={d.label}>
              <rect
                x={0}
                y={y}
                width={width}
                height={barHeight}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onFocus={() => setHoverIdx(i)}
                onBlur={() => setHoverIdx(null)}
                tabIndex={0}
              />
              <text x={labelWidth - 10} y={y + barHeight / 2 + 3.5} textAnchor="end" className="chart-axis-label">
                {truncate(d.label, 26)}
              </text>
              <path
                d={roundedRightBar(labelWidth, y, barW, barHeight, 4)}
                fill={hovered ? "var(--heading)" : "var(--navy)"}
                pointerEvents="none"
              />
              <text x={labelWidth + barW + 8} y={y + barHeight / 2 + 3.5} className="chart-value-label" pointerEvents="none">
                <tspan>
                  {valueFormat(d.value)}
                  {d.pct != null ? ` (${d.pct}%)` : ""}
                </tspan>
                {d.tag && (
                  <tspan dx="10" className="chart-tag-label">
                    {d.tag}
                  </tspan>
                )}
              </text>
            </g>
          );
        })}
      </svg>
      {hoverIdx !== null && (
        <div className="chart-tooltip" role="status">
          <strong>{valueFormat(data[hoverIdx].value)}</strong>
          <span>{data[hoverIdx].label}</span>
        </div>
      )}
    </div>
  );
}

function roundedRightBar(x, y, w, h, r) {
  const rr = Math.min(r, w, h / 2);
  if (w <= rr * 1.2) {
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`;
  }
  return `M ${x} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h - rr} Q ${x + w} ${y + h} ${x + w - rr} ${y + h} L ${x} ${y + h} Z`;
}

function niceCeiling(max) {
  if (max <= 10) return Math.ceil(max / 2) * 2 || 2;
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)));
  const normalized = max / magnitude;
  let step;
  if (normalized <= 1) step = 1;
  else if (normalized <= 2) step = 2;
  else if (normalized <= 5) step = 5;
  else step = 10;
  return step * magnitude;
}

function truncate(s, n) {
  if (!s) return s;
  return s.length > n ? s.slice(0, n - 1) + "…" : s;
}
