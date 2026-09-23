// A single headline number. Per dataviz spec: label (sentence case, no
// trailing colon), value in proportional figures (not tabular-nums — this
// is a standalone number, not a column), optional signed delta colored by
// whether the direction is good or bad for this particular metric.
export default function StatTile({ label, value, delta, deltaGood }) {
  return (
    <div className="stat-tile">
      <div className="stat-tile-label">{label}</div>
      <div className="stat-tile-value">{value}</div>
      {delta ? (
        <div className={`stat-tile-delta ${deltaGood ? "stat-up" : "stat-down"}`}>{delta}</div>
      ) : null}
    </div>
  );
}
