// Funnel in your pipeline order. "main" rows are the path forward (Leads →
// Customers → Scheduled → Viewed → …) and are drawn in the accent colour;
// "branch" rows are where the rest of the group stopped (Drop, Check,
// Pending, Follow-up, no status), drawn muted and indented under a label.
// Every bar is on the same scale — share of the first row (customers) — so
// lengths compare, and every % is "of customers".
export default function FunnelChart({ steps, compact = false, baseLabel = "customers" }) {
  const base = steps.length ? steps[0].value : 0;
  const width = (v) => (base && v ? Math.max((v / base) * 100, 0.8) : 0);
  const firstBranch = steps.findIndex((s) => s.kind === "branch");
  const firstForward = steps.findIndex((s, i) => i > firstBranch && s.kind === "main");
  return (
    <div className={`funnel ${compact ? "funnel-compact" : ""}`}>
      {steps.map((st, i) => (
        <div key={st.label}>
          {i === firstBranch && <div className="funnel-section">Stopped here</div>}
          {i === firstForward && firstBranch >= 0 && <div className="funnel-section">Moved forward</div>}
          <div className={`funnel-row ${st.kind === "branch" ? "funnel-row-branch" : ""}`}>
            <div className="funnel-label">
              <span className="funnel-name">{st.label}</span>
              {!compact && st.hint && <span className="muted small">{st.hint}</span>}
            </div>
            <div className="funnel-track">
              <div className="funnel-bar" style={{ width: `${width(st.value)}%` }} />
            </div>
            <div className="funnel-num">
              <strong>{st.value.toLocaleString()}</strong>
              <span className="muted small">{`${st.pct}% of ${baseLabel}`}</span>
              {st.kind === "main" && st.stepPct !== null && st.stepPct !== undefined && i > 0 && (
                <span className="muted small">{st.stepPct}% of previous</span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
