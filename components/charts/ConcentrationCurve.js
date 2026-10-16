import { useState, useRef } from "react";

// Cumulative share of listings (y) held by the top x% of agents (x), agents
// sorted from most to fewest listings. The dashed diagonal is "perfectly
// even" — the further the curve bows above it, the more concentrated.
export default function ConcentrationCurve({ points, marks = [] }) {
  const [hover, setHover] = useState(null);
  const ref = useRef(null);
  const width = 560;
  const height = 300;
  const pad = { l: 44, r: 16, t: 14, b: 38 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const X = (v) => pad.l + v * w;
  const Y = (v) => pad.t + h - v * h;
  const path = points.map((p, i) => `${i ? "L" : "M"} ${X(p.x)} ${Y(p.y)}`).join(" ");
  const area = `${path} L ${X(1)} ${Y(0)} L ${X(0)} ${Y(0)} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  function onMove(e) {
    const r = ref.current.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    const v = Math.max(0, Math.min(1, (px - pad.l) / w));
    let best = 0;
    points.forEach((p, i) => {
      if (Math.abs(p.x - v) < Math.abs(points[best].x - v)) best = i;
    });
    setHover(best);
  }

  return (
    <div className="chart-wrap">
      <svg ref={ref} viewBox={`0 0 ${width} ${height}`} className="chart-svg" role="img" onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={X(0)} x2={X(1)} y1={Y(t)} y2={Y(t)} className="chart-grid" />
            <text x={pad.l - 6} y={Y(t) + 3} textAnchor="end" className="chart-tick">
              {Math.round(t * 100)}%
            </text>
            <text x={X(t)} y={height - pad.b + 14} textAnchor="middle" className="chart-tick">
              {Math.round(t * 100)}%
            </text>
          </g>
        ))}
        <text x={X(0.5)} y={height - 4} textAnchor="middle" className="chart-axis-label">
          Share of agents (most listings first)
        </text>
        <text x={12} y={Y(0.5)} textAnchor="middle" className="chart-axis-label" transform={`rotate(-90 12 ${Y(0.5)})`}>
          Share of all listings
        </text>
        <line x1={X(0)} y1={Y(0)} x2={X(1)} y2={Y(1)} stroke="var(--ink-soft)" strokeDasharray="4 4" strokeWidth="1" />
        <text x={X(0.78)} y={Y(0.72)} className="chart-tick" transform={`rotate(-28 ${X(0.78)} ${Y(0.72)})`}>
          perfectly even
        </text>
        <path d={area} fill="var(--navy)" opacity="0.1" />
        <path d={path} fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round" />
        {marks.map((m) => (
          <g key={m.x}>
            <line x1={X(m.x)} x2={X(m.x)} y1={Y(m.y)} y2={Y(0)} stroke="var(--heading)" strokeDasharray="2 3" strokeWidth="1" />
            <circle cx={X(m.x)} cy={Y(m.y)} r={4} fill="var(--heading)" stroke="var(--paper-raised)" strokeWidth="2" />
            <text
              x={X(m.x) + 7}
              y={Y(m.y) + 14}
              className="chart-value-label"
              stroke="var(--paper-raised)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {m.label}
            </text>
          </g>
        ))}
        {hover !== null && (
          <g pointerEvents="none">
            <line x1={X(points[hover].x)} x2={X(points[hover].x)} y1={Y(0)} y2={Y(1)} className="chart-crosshair" />
            <circle cx={X(points[hover].x)} cy={Y(points[hover].y)} r={4} fill="var(--navy)" stroke="var(--paper-raised)" strokeWidth="2" />
          </g>
        )}
      </svg>
      {hover !== null && (
        <div className="chart-tooltip" role="status">
          <strong>{Math.round(points[hover].y * 100)}% of listings</strong>
          <span>held by the top {Math.round(points[hover].x * 100)}% of agents</span>
        </div>
      )}
    </div>
  );
}
