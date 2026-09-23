import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useProfile } from "../lib/useProfile";
import Navbar from "../components/Navbar";
import StatTile from "../components/charts/StatTile";
import BarChart from "../components/charts/BarChart";
import LineChart from "../components/charts/LineChart";

const DAY = 24 * 60 * 60 * 1000;

export default function DashboardPage() {
  const { profile, loading } = useProfile();
  const [leads, setLeads] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const canEdit = profile?.role === "owner" || profile?.role === "editor";

  useEffect(() => {
    if (!profile) return;
    loadLeads();
  }, [profile]);

  async function loadLeads() {
    setFetching(true);
    const { data, error } = await supabase.from("leads").select("*").order("enquiry_date", { ascending: true });
    if (!error) setLeads(data || []);
    setFetching(false);
  }

  async function refreshFromSheet() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/leads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (!res.ok) {
        setSyncMessage(`Refresh failed: ${result.error}`);
      } else {
        setSyncMessage(
          `Synced ${result.synced} lead${result.synced === 1 ? "" : "s"}${result.skipped ? ` (${result.skipped} skipped — no row number)` : ""}.`
        );
        await loadLeads();
      }
    } catch (e) {
      setSyncMessage("Refresh failed: " + e.message);
    }
    setSyncing(false);
  }

  const stats = useMemo(() => computeStats(leads), [leads]);
  const lastSynced = useMemo(() => {
    const dates = leads.map((l) => l.synced_at).filter(Boolean);
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  }, [leads]);

  if (loading || !profile) return <div className="loading-screen">Loading…</div>;

  return (
    <div>
      <Navbar profile={profile} />
      <div className="page">
        <div className="page-header">
          <h1>Lead dashboard</h1>
          <div className="dashboard-toolbar">
            {lastSynced && (
              <span className="last-synced">Last synced {lastSynced.toLocaleString()}</span>
            )}
            {canEdit && (
              <button onClick={refreshFromSheet} disabled={syncing}>
                {syncing ? "Refreshing…" : "↻ Refresh data"}
              </button>
            )}
          </div>
        </div>
        {syncMessage && <p className="sync-message small">{syncMessage}</p>}

        {fetching ? (
          <div className="loading-screen">Loading leads…</div>
        ) : leads.length === 0 ? (
          <div className="empty-state">
            No lead data yet.{" "}
            {canEdit
              ? 'Click "Refresh data" above to pull the Data_raw tab from your Google Sheet.'
              : "Ask an editor to refresh the data."}
          </div>
        ) : (
          <>
            <div className="stat-grid">
              <StatTile label="Total leads" value={stats.total.toLocaleString()} />
              <StatTile
                label="New this week"
                value={stats.thisWeek.toLocaleString()}
                delta={stats.weekDeltaLabel}
                deltaGood={stats.weekDelta >= 0}
              />
              <StatTile label="Active pipeline" value={stats.activePipeline.toLocaleString()} />
              <StatTile label="Drop rate" value={stats.dropRate !== null ? `${stats.dropRate}%` : "—"} />
            </div>

            <div className="dashboard-grid">
              <div className="chart-card">
                <div className="chart-card-title">Weekly lead volume</div>
                {stats.weekly.length > 1 ? (
                  <LineChart data={stats.weekly} />
                ) : (
                  <p className="muted small">Not enough dated leads yet to chart a trend.</p>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Pipeline stage</div>
                {stats.customerStatus.length ? (
                  <BarChart data={stats.customerStatus} />
                ) : (
                  <p className="muted small">No status data yet.</p>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Property type interest</div>
                {stats.propertyType.length ? (
                  <BarChart data={stats.propertyType} />
                ) : (
                  <p className="muted small">No property type data yet.</p>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Lead channel</div>
                {stats.leadSource.length ? (
                  <BarChart data={stats.leadSource} />
                ) : (
                  <p className="muted small">No lead source data yet.</p>
                )}
              </div>
            </div>

            <div className="chart-card" style={{ marginTop: "1.25rem" }}>
              <div className="chart-card-title">Top reasons leads drop or close</div>
              {stats.dropReasons.length ? (
                <div className="table-wrap">
                  <table className="reason-table">
                    <thead>
                      <tr>
                        <th>Reason</th>
                        <th>Count</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.dropReasons.map((r) => (
                        <tr key={r.label}>
                          <td>{r.label}</td>
                          <td>{r.value.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted small">No reason data yet.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function computeStats(leads) {
  const total = leads.length;
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart = new Date(startOfToday.getTime() - 6 * DAY);
  const prevWeekStart = new Date(weekStart.getTime() - 7 * DAY);

  let thisWeek = 0;
  let prevWeek = 0;

  for (const l of leads) {
    if (!l.enquiry_date) continue;
    const d = new Date(l.enquiry_date + "T00:00:00");
    if (d >= weekStart && d <= now) thisWeek++;
    else if (d >= prevWeekStart && d < weekStart) prevWeek++;
  }

  const weekDelta = thisWeek - prevWeek;
  const weekDeltaLabel =
    prevWeek === 0 && thisWeek === 0
      ? ""
      : `${weekDelta >= 0 ? "+" : ""}${weekDelta} vs last week`;

  const statusCounts = countBy(leads, "customer_status");
  const activePipeline = (statusCounts["Follow-up"] || 0) + (statusCounts["Pending"] || 0);
  const totalWithStatus = leads.filter((l) => l.customer_status).length;
  const dropRate = totalWithStatus ? Math.round(((statusCounts["Drop"] || 0) / totalWithStatus) * 100) : null;

  const customerStatus = toChartData(statusCounts).sort((a, b) => b.value - a.value);

  const propertyTypeCounts = countBy(
    leads.map((l) => ({ ...l, property_type: l.property_type && l.property_type !== "#N/A" ? l.property_type : "Unspecified" })),
    "property_type"
  );
  const propertyType = toChartData(propertyTypeCounts).sort((a, b) => b.value - a.value);

  const leadSource = toChartDataTopN(countBy(leads, "lead_source"), 6);

  const dropReasons = toChartData(countBy(leads, "customer_status_reason"))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  const weekly = weeklySeries(leads);

  return {
    total,
    thisWeek,
    weekDelta,
    weekDeltaLabel,
    activePipeline,
    dropRate,
    customerStatus,
    propertyType,
    leadSource,
    dropReasons,
    weekly,
  };
}

function countBy(leads, field) {
  const counts = {};
  for (const l of leads) {
    const v = (l[field] || "").trim();
    if (!v) continue;
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

function toChartData(counts) {
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

function toChartDataTopN(counts, n) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, n);
  const rest = entries.slice(n).reduce((sum, [, v]) => sum + v, 0);
  const data = top.map(([label, value]) => ({ label, value }));
  if (rest > 0) data.push({ label: "Other", value: rest });
  return data;
}

// Monday-start weekly bucket, last 12 weeks that have any data.
function weeklySeries(leads) {
  const dated = leads.filter((l) => l.enquiry_date);
  if (!dated.length) return [];

  const buckets = {};
  for (const l of dated) {
    const d = new Date(l.enquiry_date + "T00:00:00");
    const monday = startOfWeek(d);
    const key = monday.toISOString().slice(0, 10);
    buckets[key] = (buckets[key] || 0) + 1;
  }

  const keys = Object.keys(buckets).sort();
  const last = keys.slice(-12);
  return last.map((key) => ({
    label: new Date(key + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" }),
    value: buckets[key],
  }));
}

function startOfWeek(d) {
  const day = d.getDay(); // 0=Sun..6=Sat
  const diff = (day === 0 ? -6 : 1) - day; // shift to Monday
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}
