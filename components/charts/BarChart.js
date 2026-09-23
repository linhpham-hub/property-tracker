import { useState } from "react";

// Single-hue vertical bar chart for "compare magnitude across categories".
// One series → no legend needed (the card title says what's plotted).
// Spec: bars capped at 24px thick, 4px rounded cap / square baseline,
// hairline gridlines, 2px gap between bars, hover tooltip on the bar itself.
export default function BarChart({ data, height = 220, valueFormat = (v) => v.toLocaleString() }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const padding = { top: 28, right: 12, bottom: 34, left: 12 };
  const width = 560;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...data.map((d) => d.value));
  // round the axis ceiling up to a clean step
  const niceMax = niceCeiling(max);

  const slot = innerW / data.length;
  const barWidth = Math.min(24, slot - 10);
  const gap = 2;
  const radius = 4;

  function yFor(v) {
    return padding.top + innerH - (v / niceMax) * innerH;
  }

  const ticks = [0, niceMax / 2, niceMax];

  return (
    <div className="chart-wrap">
      <svg viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img">
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={padding.left}
              x2={width - padding.right}
              y1={yFor(t)}
              y2={yFor(t)}
              className="chart-grid"
            />
            <text x={padding.left} y={yFor(t) - 4} className="chart-tick">
              {Math.round(t).toLocaleString()}
            </text>
          </g>
        ))}

        {data.map((d, i) => {
          const x = padding.left + i * slot + (slot - barWidth) / 2;
          const barH = (d.value / niceMax) * innerH;
          const y = yFor(d.value);
          const hovered = hoverIdx === i;
          return (
            <g key={d.label}>
              {/* full-slot invisible hit target, bigger than the painted bar */}
              <rect
                x={padding.left + i * slot + gap / 2}
                y={padding.top}
                width={Math.max(0, slot - gap)}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHoverIdx(i)}
                onMouseLeave={() => setHoverIdx(null)}
                onFocus={() => setHoverIdx(i)}
                onBlur={() => setHoverIdx(null)}
                tabIndex={0}
              />
              <path
                d={roundedTopBar(x, y, barWidth, Math.max(barH, 1), radius)}
                fill={hovered ? "var(--heading)" : "var(--navy)"}
                style={{ transition: "fill 0.1s ease" }}
                pointerEvents="none"
              />
              <text
                x={padding.left + i * slot + slot / 2}
                y={y - 8}
                textAnchor="middle"
                className="chart-value-label"
                pointerEvents="none"
              >
                {valueFormat(d.value)}
              </text>
              <text
                x={padding.left + i * slot + slot / 2}
                y={height - padding.bottom + 16}
                textAnchor="middle"
                className="chart-axis-label"
                pointerEvents="none"
              >
                {truncate(d.label, 14)}
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

function roundedTopBar(x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h);
  return `M ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y} L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} Z`;
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
