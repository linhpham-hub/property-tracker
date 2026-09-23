import { useState, useRef } from "react";

// Single-series trend line. Spec: 2px line, round join/cap, area wash at
// ~10% opacity, crosshair that snaps to the nearest point, one tooltip
// listing the value + date. One series → no legend (title says what it is).
export default function LineChart({ data, height = 220, valueFormat = (v) => v.toLocaleString() }) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const svgRef = useRef(null);
  const padding = { top: 28, right: 16, bottom: 34, left: 12 };
  const width = 560;
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const max = Math.max(1, ...data.map((d) => d.value));
  const niceMax = niceCeiling(max);

  const stepX = data.length > 1 ? innerW / (data.length - 1) : 0;

  function xFor(i) {
    return padding.left + i * stepX;
  }
  function yFor(v) {
    return padding.top + innerH - (v / niceMax) * innerH;
  }

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xFor(i)} ${yFor(d.value)}`).join(" ");
  const areaPath =
    `M ${xFor(0)} ${padding.top + innerH} ` +
    data.map((d, i) => `L ${xFor(i)} ${yFor(d.value)}`).join(" ") +
    ` L ${xFor(data.length - 1)} ${padding.top + innerH} Z`;

  const ticks = [0, niceMax / 2, niceMax];

  function handleMove(e) {
    const rect = svgRef.current.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * width;
    let idx = Math.round((px - padding.left) / (stepX || 1));
    idx = Math.max(0, Math.min(data.length - 1, idx));
    setHoverIdx(idx);
  }

  return (
    <div className="chart-wrap">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className="chart-svg"
        role="img"
        onMouseMove={handleMove}
        onMouseLeave={() => setHoverIdx(null)}
      >
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

        <path d={areaPath} fill="var(--navy)" opacity="0.1" stroke="none" />
        <path d={linePath} fill="none" stroke="var(--navy)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />

        {hoverIdx !== null && (
          <line
            x1={xFor(hoverIdx)}
            x2={xFor(hoverIdx)}
            y1={padding.top}
            y2={padding.top + innerH}
            className="chart-crosshair"
          />
        )}

        {data.map((d, i) => {
          const isEnd = i === data.length - 1;
          const isHover = hoverIdx === i;
          if (!isEnd && !isHover) return null;
          return (
            <circle
              key={i}
              cx={xFor(i)}
              cy={yFor(d.value)}
              r={4}
              fill="var(--navy)"
              stroke="var(--paper-raised)"
              strokeWidth="2"
            />
          );
        })}

        {/* sparse x labels: first, last, and hovered */}
        {data.map((d, i) => {
          const show = i === 0 || i === data.length - 1 || i === hoverIdx;
          if (!show) return null;
          return (
            <text
              key={i}
              x={xFor(i)}
              y={height - padding.bottom + 16}
              textAnchor={i === 0 ? "start" : i === data.length - 1 ? "end" : "middle"}
              className="chart-axis-label"
            >
              {d.label}
            </text>
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
