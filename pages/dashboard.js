import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useProfile } from "../lib/useProfile";
import Navbar from "../components/Navbar";
import StatTile from "../components/charts/StatTile";
import BarChart from "../components/charts/BarChart";
import LineChart from "../components/charts/LineChart";
import HBarChart from "../components/charts/HBarChart";
import DonutChart from "../components/charts/DonutChart";

const DAY = 24 * 60 * 60 * 1000;
const MATURE_DAYS = 5; // your own follow-up rule: judge a lead only once it's had 5+ days
const UNRESOLVED_STATUSES = new Set(["", "Pending", "Check"]);
const STORAGE_KEY = "property-tracker-lead-dashboard-state";

function loadSavedState() {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export default function DashboardPage() {
  const { profile, loading } = useProfile();
  const [leads, setLeads] = useState([]);
  const [properties, setProperties] = useState([]);
  const [fetching, setFetching] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  const saved = useMemo(loadSavedState, []);
  const [yearFilter, setYearFilter] = useState(saved.yearFilter || "all");
  const [monthFilter, setMonthFilter] = useState(saved.monthFilter || "all");
  const [dayFilter, setDayFilter] = useState(saved.dayFilter || "all");
  const [enquirerFilter, setEnquirerFilter] = useState(
    LEAD_TYPES.includes(saved.enquirerFilter) ? saved.enquirerFilter : "all"
  );
  const [propertySearch, setPropertySearch] = useState(saved.propertySearch || "");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ yearFilter, monthFilter, dayFilter, enquirerFilter, propertySearch })
      );
    } catch (e) {}
  }, [yearFilter, monthFilter, dayFilter, enquirerFilter, propertySearch]);

  // A day only means something inside one specific month.
  useEffect(() => {
    if ((yearFilter === "all" || monthFilter === "all") && dayFilter !== "all") setDayFilter("all");
  }, [yearFilter, monthFilter, dayFilter]);

  const canEdit = profile?.role === "owner" || profile?.role === "editor";

  useEffect(() => {
    if (!profile) return;
    loadLeads();
    loadProperties();
  }, [profile]);

  // Supabase/PostgREST caps a plain .select() at 1000 rows by default —
  // with 1600+ leads now synced, a single unbounded query was silently
  // truncating the table, and since it's ordered oldest-first, whatever
  // didn't fit in the first 1000 (recent months, e.g. most of August
  // onward) just vanished from every stat and chart. This pages through
  // in batches of 1000 so the full table always loads regardless of size.
  async function loadLeads() {
    setFetching(true);
    const pageSize = 1000;
    let all = [];
    let from = 0;
    for (let page = 0; page < 50; page++) {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .order("enquiry_date", { ascending: true })
        .range(from, from + pageSize - 1);
      if (error) break;
      const rows = data || [];
      all = all.concat(rows);
      if (rows.length < pageSize) break;
      from += pageSize;
    }
    setLeads(all);
    setFetching(false);
  }

  async function loadProperties() {
    const { data } = await supabase.from("properties").select("id, property_name, property_link, property_status");
    setProperties(data || []);
  }

  // The Property_master sheet's own Property_link cell is the reliable,
  // complete source for a property's listings — often "Propertyguru: url
  //   99.co: url   SRX: url   EdgeProp: url" all in one cell. A single
  // lead's own property_link (from Data_raw) only ever has one platform's
  // link, and is sometimes not a URL at all (a mis-entered address), so
  // this is preferred whenever the property name matches.
  const propertyLinksByName = useMemo(() => {
    const map = {};
    for (const p of properties) {
      if (p.property_name) map[p.property_name.trim().toLowerCase()] = p.property_link || "";
    }
    return map;
  }, [properties]);

  // Lets "Leads by property" / "Needs follow-up" link straight to the
  // matching property page — 11 Amber Road_1/_2/_3 etc. are otherwise
  // impossible to tell apart from the name alone.
  const propertyIdByName = useMemo(() => {
    const map = {};
    for (const p of properties) {
      if (p.property_name) map[p.property_name.trim().toLowerCase()] = p.id;
    }
    return map;
  }, [properties]);

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
        const notes = [];
        if (result.blankNo) notes.push(`${result.blankNo} with a blank No.`);
        if (result.repeatedNos && result.repeatedNos.length)
          notes.push(
            `No. ${result.repeatedNos.slice(0, 10).join(", ")}${result.repeatedNos.length > 10 ? "…" : ""} used more than once`
          );
        setSyncMessage(
          `Synced ${result.synced} lead${result.synced === 1 ? "" : "s"}.` +
            (notes.length ? ` All were included; to tidy Data_raw: ${notes.join("; ")}.` : "")
        );
        await loadLeads();
      }
    } catch (e) {
      setSyncMessage("Refresh failed: " + e.message);
    }
    setSyncing(false);
  }

  const now = useMemo(() => new Date(), [leads]); // recompute "today" each time data reloads
  const availableYears = useMemo(() => getAvailableYears(leads), [leads]);
  const enquirerOptions = LEAD_TYPES;
  const daysInMonth =
    yearFilter !== "all" && monthFilter !== "all" ? new Date(Number(yearFilter), Number(monthFilter) + 1, 0).getDate() : 0;

  // Everything except the date: enquirer type + property search.
  const nonDateFiltered = useMemo(() => {
    const q = propertySearch.trim().toLowerCase();
    return leads.filter((l) => {
      if (enquirerFilter !== "all" && leadType(l) !== enquirerFilter) return false;
      if (q && !(l.property_name || "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [leads, enquirerFilter, propertySearch]);
  // Leads per day always plots the whole month (so picking one day doesn't
  // collapse it to a single dot) — everything else narrows to the day.
  const monthScopedLeads = useMemo(
    () => filterByYearMonth(nonDateFiltered, yearFilter, monthFilter),
    [nonDateFiltered, yearFilter, monthFilter]
  );
  const filteredLeads = useMemo(
    () => (dayFilter === "all" ? monthScopedLeads : monthScopedLeads.filter((l) => l.enquiry_date && Number(l.enquiry_date.slice(8, 10)) === Number(dayFilter))),
    [monthScopedLeads, dayFilter]
  );
  const undatedExcluded = useMemo(
    () => (yearFilter !== "all" || monthFilter !== "all" ? nonDateFiltered.filter((l) => !l.enquiry_date).length : 0),
    [nonDateFiltered, yearFilter, monthFilter]
  );

  const stats = useMemo(
    () => computeStats(leads, filteredLeads, yearFilter, monthFilter, now, monthScopedLeads),
    [leads, filteredLeads, yearFilter, monthFilter, now, monthScopedLeads]
  );

  // Active listings in Property_master, ranked by how few enquiries they
  // got in the selected period — the ones Javier's listing work isn't
  // reaching. "Low" = under half the typical (median) active listing.
  const attention = useMemo(
    () => computeAttention(properties, filteredLeads, leads, propertyLinksByName, propertySearch),
    [properties, filteredLeads, leads, propertyLinksByName, propertySearch]
  );

  const leadList = useMemo(
    () =>
      [...filteredLeads].sort((a, b) => (b.enquiry_date || "").localeCompare(a.enquiry_date || "") || (b.row_no || 0) - (a.row_no || 0)),
    [filteredLeads]
  );
  const showLeadList = dayFilter !== "all" || propertySearch.trim() !== "" || enquirerFilter !== "all" || monthFilter !== "all";
  const lastSynced = useMemo(() => {
    const dates = leads.map((l) => l.synced_at).filter(Boolean);
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  }, [leads]);

  const filteredPropertyRows = stats.propertyTable;

  if (loading || !profile) return <div className="loading-screen">Loading…</div>;

  return (
    <div>
      <Navbar profile={profile} />
      <div className="page">
        <div className="page-header">
          <h1>Lead dashboard</h1>
          <div className="dashboard-toolbar">
            {lastSynced && <span className="last-synced">Last synced {lastSynced.toLocaleString()}</span>}
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
            <div className="filters dashboard-filters">
              <span className="muted small">Year:</span>
              <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
                <option value="all">All years</option>
                {availableYears.map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <span className="muted small">Month:</span>
              <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)}>
                <option value="all">All months</option>
                {MONTH_NAMES.map((name, i) => (
                  <option key={i} value={i}>
                    {name}
                  </option>
                ))}
              </select>
              <span className="muted small">Day:</span>
              <select
                value={dayFilter}
                onChange={(e) => setDayFilter(e.target.value)}
                disabled={!daysInMonth}
                title={daysInMonth ? "" : "Pick a year and a month first"}
              >
                <option value="all">All days</option>
                {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
              <span className="muted small">Who:</span>
              <select value={enquirerFilter} onChange={(e) => setEnquirerFilter(e.target.value)}>
                <option value="all">All</option>
                {enquirerOptions.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
              <input
                className="table-search"
                placeholder="Search property…"
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
              />
              {(dayFilter !== "all" || enquirerFilter !== "all" || propertySearch) && (
                <button
                  type="button"
                  className="link-button small"
                  onClick={() => {
                    setDayFilter("all");
                    setEnquirerFilter("all");
                    setPropertySearch("");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>
            {undatedExcluded > 0 && (
              <p className="muted small" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
                {undatedExcluded.toLocaleString()} lead{undatedExcluded === 1 ? "" : "s"} with no recorded enquiry date{" "}
                {undatedExcluded === 1 ? "isn't" : "aren't"} included in this date range (they're included under "All time").
              </p>
            )}

            <div className="stat-grid">
              <StatTile label="Total leads (in range)" value={stats.total.toLocaleString()} />
              <StatTile label="Follow-up" value={stats.followUp.toLocaleString()} />
              <StatTile label="Active (Follow-up + Pending + Check)" value={stats.activePipeline.toLocaleString()} />
              <StatTile
                label={`Drop rate (${MATURE_DAYS}+ day leads)`}
                value={stats.dropRateMatured !== null ? `${stats.dropRateMatured}%` : "—"}
              />
            </div>

            <div className="dashboard-grid">
              <div className="chart-card">
                <div className="chart-card-title">
                  {stats.dailyTrend.some((d) => d.weekly) ? "Leads per week" : "Leads per day"}
                  {dayFilter !== "all" && <span className="muted small"> — whole month shown, day {dayFilter} marked</span>}
                </div>
                {stats.dailyTrend.length > 1 ? (
                  <LineChart
                    data={stats.dailyTrend}
                    refValue={stats.dailyStats ? stats.dailyStats.average : null}
                    refLabel={stats.dailyStats ? `avg ${stats.dailyStats.average.toFixed(1)}` : ""}
                    highlightIndex={dayFilter !== "all" ? Number(dayFilter) - 1 : null}
                  />
                ) : (
                  <p className="muted small">Not enough dated leads yet to chart this.</p>
                )}
                {stats.dailyStats && (
                  <div className="daily-stats">
                    <div>
                      <span className="daily-stats-label">Average / day</span>
                      <span className="daily-stats-value">{stats.dailyStats.average.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="daily-stats-label">Median</span>
                      <span className="daily-stats-value">{Number.isInteger(stats.dailyStats.median) ? stats.dailyStats.median : stats.dailyStats.median.toFixed(1)}</span>
                    </div>
                    <div>
                      <span className="daily-stats-label">Busiest</span>
                      <span className="daily-stats-value">{stats.dailyStats.max}</span>
                      <span className="daily-stats-sub">{stats.dailyStats.busiestLabel}</span>
                    </div>
                    <div>
                      <span className="daily-stats-label">Quietest</span>
                      <span className="daily-stats-value">{stats.dailyStats.min}</span>
                      <span className="daily-stats-sub">{stats.dailyStats.quietestLabel}</span>
                    </div>
                    <div>
                      <span className="daily-stats-label">Days with 0</span>
                      <span className="daily-stats-value">{stats.dailyStats.zeroDays}</span>
                      <span className="daily-stats-sub">of {stats.dailyStats.days}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Leads by source</div>
                {stats.leadSource.length ? (
                  <DonutChart data={stats.leadSource} />
                ) : (
                  <p className="muted small">No source data yet.</p>
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
                <div className="chart-card-title">Pipeline stage</div>
                {stats.customerStatus.length ? (
                  <DonutChart data={stats.customerStatus} />
                ) : (
                  <p className="muted small">No status data yet.</p>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Why leads drop or close</div>
                {stats.dropReasonsGrouped.length ? (
                  <HBarChart data={stats.dropReasonsGrouped} />
                ) : (
                  <p className="muted small">No reason data yet.</p>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  Reasons ({stats.dropReasonsRaw.length}) — what rolled into each bucket above
                </div>
                {stats.dropReasonsRaw.length ? (
                  <div className="table-wrap table-scroll">
                    <table className="reason-table">
                      <thead>
                        <tr>
                          <th>Reason (spelling variants merged)</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.dropReasonsRaw.map((r) => (
                          <tr key={r.label}>
                            <td>
                              {r.label}
                              {r.variants.length > 1 && (
                                <div className="muted small">Written as: {r.variants.map((v) => `“${v}”`).join(", ")}</div>
                              )}
                            </td>
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

              <div className="chart-card">
                <div className="chart-card-title">Agent vs customer</div>
                {stats.leadTypes.length ? (
                  <DonutChart data={stats.leadTypes} />
                ) : (
                  <p className="muted small">No leads in this range.</p>
                )}
                <p className="muted small" style={{ marginTop: "0.5rem" }}>
                  Agent = Enquirer Type "Agent", or "Agent" written in the Reason column. Customer = Enquirer Type
                  "Consumer". Not specified = neither (mostly 99.co, which has no Enquirer Type).
                </p>
              </div>

              <div className="chart-card">
                <div className="chart-card-title">Agent vs customer, by platform</div>
                {stats.leadTypeBySource.length ? (
                  <div className="table-wrap">
                    <table className="reason-table">
                      <thead>
                        <tr>
                          <th>Platform</th>
                          <th>Agent</th>
                          <th>Customer</th>
                          <th>Not specified</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.leadTypeBySource.map((r) => (
                          <tr key={r.source}>
                            <td>{r.source}</td>
                            <td>{r.Agent.toLocaleString()}</td>
                            <td>{r.Customer.toLocaleString()}</td>
                            <td>{r["Not specified"].toLocaleString()}</td>
                            <td>
                              <strong>{r.total.toLocaleString()}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted small">No leads in this range.</p>
                )}
              </div>
            </div>

            <div className="dashboard-grid" style={{ marginTop: "1.25rem" }}>
              <div className="chart-card">
                <div className="chart-card-title">
                  Top {stats.topPropertiesByStatus.active.length} most-enquired properties — Active
                </div>
                {stats.topPropertiesByStatus.active.length ? (
                  <HBarChart data={stats.topPropertiesByStatus.active} />
                ) : (
                  <p className="muted small">No active-listing property data yet.</p>
                )}
              </div>

              <div className="chart-card">
                <div className="chart-card-title">
                  Top {stats.topPropertiesByStatus.expired.length} most-enquired properties — Expired
                </div>
                {stats.topPropertiesByStatus.expired.length ? (
                  <HBarChart data={stats.topPropertiesByStatus.expired} />
                ) : (
                  <p className="muted small">No expired-listing property data yet.</p>
                )}
              </div>
            </div>

            <div className="chart-card" style={{ marginTop: "1.25rem" }}>
              <div className="chart-card-title">Listings needing attention ({attention.rows.length})</div>
              <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                Active listings in Property_master with no enquiries, or fewer than half of what a typical active listing got
                ({attention.median % 1 ? attention.median.toFixed(1) : attention.median} enquiries) in the selected period.
                {" "}{attention.activeCount} active listings checked.
              </p>
              {attention.rows.length ? (
                <div className="table-wrap table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Property</th>
                        <th>Enquiries</th>
                        <th>Flag</th>
                        <th>Last enquiry (any time)</th>
                        <th>Listings</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attention.rows.map((r) => (
                        <tr key={r.id}>
                          <td>
                            <a href={`/property/${r.id}`} target="_blank" rel="noopener noreferrer">
                              {r.name}
                            </a>
                          </td>
                          <td>{r.count}</td>
                          <td>
                            <span className={`flag-chip ${r.count === 0 ? "flag-none" : "flag-low"}`}>{r.flag}</span>
                          </td>
                          <td>{r.lastEnquiry ? formatDate(r.lastEnquiry) : "Never"}</td>
                          <td>
                            {r.links.length
                              ? r.links.map((l) => (
                                  <a key={l.url} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-link">
                                    {l.label} ↗
                                  </a>
                                ))
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted small">Every active listing is getting a normal share of enquiries in this period.</p>
              )}
            </div>

            <div className="chart-card" style={{ marginTop: "1.25rem" }}>
              <div className="chart-card-title">Leads by property</div>
              <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                "Enquiries" = contact rows recorded in the sheet for that property (the sheet doesn't track page views/clicks
                separately). Listings come from that property's entry in Property_master when there's a name match — the same
                place your Propertyguru/99.co/SRX/EdgeProp links live — falling back to whatever link was recorded directly
                on a lead if there's no match. Use the property search at the top to narrow this table.
              </p>
              <div className="table-wrap table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>Property</th>
                      <th>Listings</th>
                      <th>Enquiries</th>
                      <th>Drop</th>
                      <th>Follow-up</th>
                      <th>Pending</th>
                      <th>Check</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPropertyRows.map((r) => {
                      const compiled = parseCompiledLinks(propertyLinksByName[r.property_name.trim().toLowerCase()] || "");
                      const rowLinks = sortLinksByPriority(
                        mergeLinks(compiled, r.links.map((url) => ({ label: linkLabel(url), url })))
                      );
                      return (
                        <tr key={r.property_name}>
                          <td>{r.property_name}</td>
                          <td>
                            {rowLinks.length ? (
                              rowLinks.map((l) => (
                                <div key={l.url} style={{ marginBottom: "0.4rem" }}>
                                  <strong>{l.label}:</strong>
                                  <br />
                                  <a href={l.url} target="_blank" rel="noopener noreferrer">
                                    {l.url}
                                  </a>
                                </div>
                              ))
                            ) : (
                              "—"
                            )}
                          </td>
                          <td>{r.total}</td>
                          <td>{r.drop}</td>
                          <td>{r.followUp}</td>
                          <td>{r.pending}</td>
                          <td>{r.check}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                  {filteredPropertyRows.length > 0 && (
                    <tfoot>
                      <tr className="table-total-row">
                        <td>
                          <strong>Total ({filteredPropertyRows.length} properties)</strong>
                        </td>
                        <td></td>
                        <td>
                          <strong>{filteredPropertyRows.reduce((s, r) => s + r.total, 0).toLocaleString()}</strong>
                        </td>
                        <td>
                          <strong>{filteredPropertyRows.reduce((s, r) => s + r.drop, 0).toLocaleString()}</strong>
                        </td>
                        <td>
                          <strong>{filteredPropertyRows.reduce((s, r) => s + r.followUp, 0).toLocaleString()}</strong>
                        </td>
                        <td>
                          <strong>{filteredPropertyRows.reduce((s, r) => s + r.pending, 0).toLocaleString()}</strong>
                        </td>
                        <td>
                          <strong>{filteredPropertyRows.reduce((s, r) => s + r.check, 0).toLocaleString()}</strong>
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
              {filteredPropertyRows.length === 0 && <p className="muted small">No properties match.</p>}
            </div>

            {showLeadList && (
              <div className="chart-card" style={{ marginTop: "1.25rem" }}>
                <div className="chart-card-title">Lead list ({leadList.length})</div>
                <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                  Every lead matching the filters above, newest first — pick a day, a property or an enquirer type to deep-dive.
                </p>
                {leadList.length ? (
                  <div className="table-wrap table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Property</th>
                          <th>Customer</th>
                          <th>Mobile</th>
                          <th>Source</th>
                          <th>Who</th>
                          <th>Status</th>
                          <th>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {leadList.slice(0, 500).map((l) => (
                          <tr key={l.id}>
                            <td style={{ whiteSpace: "nowrap" }}>{l.enquiry_date ? formatDate(l.enquiry_date) : "—"}</td>
                            <td>{l.property_name || "—"}</td>
                            <td>{l.full_name && l.full_name !== "-" ? l.full_name : l.first_name || "—"}</td>
                            <td>{l.mobile || "—"}</td>
                            <td>{l.source_data || "—"}</td>
                            <td>{leadType(l)}</td>
                            <td>{l.customer_status || "(blank)"}</td>
                            <td>{l.customer_status_reason || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted small">No leads match these filters.</p>
                )}
                {leadList.length > 500 && (
                  <p className="muted small" style={{ marginTop: "0.5rem" }}>
                    Showing the newest 500 of {leadList.length.toLocaleString()} — narrow the filters to see the rest.
                  </p>
                )}
              </div>
            )}

            <div className="chart-card" style={{ marginTop: "1.25rem" }}>
              <div className="chart-card-title">Repeat customers ({stats.repeatCustomers.length})</div>
              <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                Customers (by mobile number) who enquired more than once, in the selected date range.
              </p>
              {stats.repeatCustomers.length ? (
                <div className="table-wrap table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Customer</th>
                        <th>Mobile</th>
                        <th>Enquiries</th>
                        <th>Properties</th>
                        <th>First → Last</th>
                        <th>Statuses seen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.repeatCustomers.slice(0, 100).map((c) => (
                        <tr key={c.mobile}>
                          <td>{c.name || "—"}</td>
                          <td>{c.mobile}</td>
                          <td>{c.count}</td>
                          <td>{c.properties.slice(0, 3).join(", ")}{c.properties.length > 3 ? ` +${c.properties.length - 3} more` : ""}</td>
                          <td>{c.first || "—"} → {c.last || "—"}</td>
                          <td>{c.statuses.join(", ") || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="muted small">No repeat customers in this range.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- year / month filter ----------

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function getAvailableYears(leads) {
  const years = new Set();
  for (const l of leads) {
    if (l.enquiry_date) years.add(Number(l.enquiry_date.slice(0, 4)));
  }
  years.add(new Date().getFullYear());
  return Array.from(years).sort((a, b) => b - a);
}

function filterByYearMonth(leads, yearFilter, monthFilter) {
  if (yearFilter === "all" && monthFilter === "all") return leads;
  return leads.filter((l) => {
    if (!l.enquiry_date) return false;
    const d = new Date(l.enquiry_date + "T00:00:00");
    if (yearFilter !== "all" && d.getFullYear() !== Number(yearFilter)) return false;
    if (monthFilter !== "all" && d.getMonth() !== Number(monthFilter)) return false;
    return true;
  });
}

// A property name (e.g. "11 Amber Road_1") linked straight to that
// property's page when it exists in the tracker, so near-identical names
// are easy to tell apart. Falls back to plain text if no match is found.
function PropertyLink({ name, idMap }) {
  if (!name) return "—";
  const id = idMap[name.trim().toLowerCase()];
  if (!id) return name;
  return (
    <a href={`/property/${id}`} target="_blank" rel="noopener noreferrer">
      {name}
    </a>
  );
}

// ---------- follow-up / maturity ----------

function daysSince(dateStr, refDate) {
  const d = new Date(dateStr + "T00:00:00");
  return Math.floor((refDate.getTime() - d.getTime()) / DAY);
}

function computeFollowUps(leads, refDate) {
  return leads
    .filter((l) => l.enquiry_date)
    .map((l) => ({ ...l, daysSince: daysSince(l.enquiry_date, refDate) }))
    .filter((l) => l.daysSince >= MATURE_DAYS && UNRESOLVED_STATUSES.has((l.customer_status || "").trim()))
    .sort((a, b) => b.daysSince - a.daysSince);
}

// ---------- drop/close reason taxonomy (my grouping of the 56 raw values) ----------

// Applied to the normalized reason text (see normalizeReason), so spelling
// and capitalisation variants all land in the same bucket.
const REASON_RULES = [
  { test: /expired/, label: "Property expired" },
  { test: /no whatsapp|whatsapp error|blocked/, label: "No WhatsApp contact" },
  { test: /no property name/, label: "Missing property info" },
  { test: /no match/, label: "No matching property" },
  { test: /\bagent\b/, label: "Agent lead (no follow-up needed)" },
  { test: /wait.*reply|no reply/, label: "Awaiting customer reply" },
  { test: /javier|schedul/, label: "Handed to Javier" },
  { test: /not last update|not last property/, label: "Tracking not updated" },
  { test: /viewed/, label: "Unit viewed" },
  { test: /no need/, label: "No longer needs property" },
];

function categorizeReason(raw) {
  if (!raw) return null;
  const n = normalizeReason(raw);
  if (!n) return null;
  for (const rule of REASON_RULES) {
    if (rule.test.test(n)) return rule.label;
  }
  return "Other";
}

// One canonical form per reason, so "no whatsapp" / "No whatsapp" /
// "Nowhatsapp", "Not last_update" / "Not last update", "Agent," / "Agent",
// "Viewrd" / "Viewed", "Javier follow?" / "Javier follow" are counted as one.
function normalizeReason(raw) {
  if (!raw) return "";
  let s = String(raw).toLowerCase().replace(/_/g, " ").replace(/\?/g, "");
  s = s.replace(/no\s*whats\s*app/g, "no whatsapp");
  s = s.replace(/\bviewrd\b/g, "viewed");
  s = s.replace(/\bno match property\b/g, "no match");
  s = s.replace(/\bnot last update\b/g, "not last update");
  return s
    .split(",")
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ");
}

// How a normalized reason is shown: first letter capitalised, proper nouns fixed.
function displayReason(n) {
  const s = n.replace(/\bjavier\b/g, "Javier").replace(/\bwhatsapp\b/g, "WhatsApp").replace(/\bsg\b/g, "SG");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Agent vs customer. Agent if the sheet's Enquirer Type says Agent, or if
// "Agent" was written in the Reason column (how agents were noted before
// Enquirer Type was filled in). Customer if Enquirer Type says Consumer.
// Otherwise not specified (mostly 99.co, which has no Enquirer Type).
const LEAD_TYPES = ["Agent", "Customer", "Not specified"];
function leadType(l) {
  const et = (l.enquirer_type || "").trim().toLowerCase();
  if (et === "agent" || /\bagent\b/.test(normalizeReason(l.customer_status_reason))) return "Agent";
  if (et === "consumer" || et === "customer") return "Customer";
  return "Not specified";
}

// ---------- main aggregation ----------

function computeStats(allLeads, filteredLeads, yearFilter, monthFilter, now, chartLeads = filteredLeads) {
  const total = filteredLeads.length;

  const statusCounts = countBy(filteredLeads, "customer_status");
  // Your definitions: Follow-up = leads with status "Follow-up" only;
  // Active pipeline = Follow-up + Pending + Check. Matched loosely on
  // spelling ("Follow up", "follow-up", "Followup" all count).
  const byKey = {};
  for (const l of filteredLeads) {
    const k = statusKey(l.customer_status);
    byKey[k] = (byKey[k] || 0) + 1;
  }
  const followUp = byKey.followup || 0;
  const activePipeline = followUp + (byKey.pending || 0) + (byKey.check || 0);
  const customerStatus = toChartData(statusCounts).sort((a, b) => b.value - a.value);

  const propertyTypeCounts = countBy(
    filteredLeads.map((l) => ({
      ...l,
      property_type: l.property_type && l.property_type !== "#N/A" ? l.property_type : "Unspecified",
    })),
    "property_type"
  );
  const propertyType = toChartData(propertyTypeCounts).sort((a, b) => b.value - a.value);

  // Drop rate judged only on leads old enough to have gone through a
  // follow-up cycle (your 5-day rule) — a fresh lead hasn't had the
  // chance to drop yet, so including it would understate the real rate.
  const matured = filteredLeads.filter((l) => l.enquiry_date && daysSince(l.enquiry_date, now) >= MATURE_DAYS);
  const dropRateMatured = matured.length
    ? Math.round((matured.filter((l) => statusKey(l.customer_status) === "drop").length / matured.length) * 100)
    : null;

  // Needs-follow-up: always computed from ALL leads (not the date-range
  // filter) and against the real current date — it's a live to-do list.
  const needsFollowUp = computeFollowUps(allLeads, now);

  const topPropertiesByStatus = computeTopPropertiesByStatus(filteredLeads);

  const leadSource = toChartData(countBy(filteredLeads, "source_data")).sort((a, b) => b.value - a.value);

  // Reason taxonomy — grouped (chart) + raw (audit table), scoped to the
  // selected date range.
  // Unlike the other breakdowns, this one is deliberately scoped to leads
  // that actually have a reason recorded (mostly Drop-status leads) — most
  // leads never get one (they're still active), so including blanks here
  // would just bury the real reasons under one giant "no reason yet" bar.
  // Counted by normalized text, so spelling/capitalisation variants merge;
  // each row also keeps the different ways it was actually written.
  const reasonCounts = {};
  const reasonVariants = {};
  for (const l of filteredLeads) {
    const n = normalizeReason(l.customer_status_reason);
    if (!n) continue;
    reasonCounts[n] = (reasonCounts[n] || 0) + 1;
    (reasonVariants[n] = reasonVariants[n] || new Set()).add(String(l.customer_status_reason).trim());
  }
  const groupedCounts = {};
  let groupedTotal = 0;
  for (const [n, count] of Object.entries(reasonCounts)) {
    const bucket = categorizeReason(n);
    if (!bucket) continue;
    groupedCounts[bucket] = (groupedCounts[bucket] || 0) + count;
    groupedTotal += count;
  }
  const dropReasonsGrouped = Object.entries(groupedCounts)
    .map(([label, value]) => ({ label, value, pct: groupedTotal ? Math.round((value / groupedTotal) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
  const dropReasonsRaw = Object.entries(reasonCounts)
    .map(([n, value]) => ({ label: displayReason(n), value, variants: Array.from(reasonVariants[n]) }))
    .sort((a, b) => b.value - a.value);

  // Agent vs customer, plus the same split per platform.
  const leadTypeCounts = {};
  const typeBySource = {};
  for (const l of filteredLeads) {
    const t = leadType(l);
    leadTypeCounts[t] = (leadTypeCounts[t] || 0) + 1;
    const src = (l.source_data || "").trim() || "(blank)";
    typeBySource[src] = typeBySource[src] || { source: src, Agent: 0, Customer: 0, "Not specified": 0, total: 0 };
    typeBySource[src][t]++;
    typeBySource[src].total++;
  }
  const leadTypes = LEAD_TYPES.filter((t) => leadTypeCounts[t]).map((t) => ({ label: t, value: leadTypeCounts[t] }));
  const leadTypeBySource = Object.values(typeBySource).sort((a, b) => b.total - a.total);

  const propertyTable = computePropertyTable(filteredLeads);
  const repeatCustomers = computeRepeatCustomers(filteredLeads);
  const dailyTrend = dailySeries(chartLeads, yearFilter, monthFilter, now);
  const dailyStats = summarizeDaily(dailyTrend);

  return {
    total,
    activePipeline,
    followUp,
    dropRateMatured,
    customerStatus,
    propertyType,
    topPropertiesByStatus,
    leadSource,
    dropReasonsGrouped,
    dropReasonsRaw,
    needsFollowUp,
    propertyTable,
    repeatCustomers,
    dailyTrend,
    dailyStats,
    leadTypes,
    leadTypeBySource,
  };
}

// "2026-10-01" → "1 Oct 2026" (built from the parts, so no time-zone shift).
function formatDate(iso) {
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${MONTH_NAMES[m - 1]} ${y}`;
}

// Active listings (Property_master status "Active") that got no or few
// enquiries in the selected period. "Low" = under half the median of all
// active listings in the same period — relative, so it adapts to busy
// and quiet months instead of using a fixed cut-off.
function computeAttention(properties, filteredLeads, allLeads, linksByName, search) {
  const q = (search || "").trim().toLowerCase();
  const active = properties.filter(
    (p) => p.property_name && statusKey(p.property_status) === "active" && (!q || p.property_name.toLowerCase().includes(q))
  );
  const counts = {};
  for (const l of filteredLeads) {
    const k = (l.property_name || "").trim().toLowerCase();
    if (k) counts[k] = (counts[k] || 0) + 1;
  }
  const lastEnquiry = {};
  for (const l of allLeads) {
    const k = (l.property_name || "").trim().toLowerCase();
    if (k && l.enquiry_date && (!lastEnquiry[k] || l.enquiry_date > lastEnquiry[k])) lastEnquiry[k] = l.enquiry_date;
  }
  const rows = active.map((p) => {
    const k = p.property_name.trim().toLowerCase();
    return {
      id: p.id,
      name: p.property_name.trim(),
      count: counts[k] || 0,
      lastEnquiry: lastEnquiry[k] || null,
      links: sortLinksByPriority(parseCompiledLinks(linksByName[k] || "")),
    };
  });
  const sortedCounts = rows.map((r) => r.count).sort((a, b) => a - b);
  const n = sortedCounts.length;
  const median = n ? (n % 2 ? sortedCounts[(n - 1) / 2] : (sortedCounts[n / 2 - 1] + sortedCounts[n / 2]) / 2) : 0;
  const lowCutoff = median / 2;
  const flagged = rows
    .map((r) => ({ ...r, flag: r.count === 0 ? "No enquiries" : r.count < lowCutoff ? "Low" : null }))
    .filter((r) => r.flag)
    .sort((a, b) => a.count - b.count || (a.lastEnquiry || "").localeCompare(b.lastEnquiry || ""));
  return { rows: flagged, activeCount: n, median };
}

// Average / median / min / max leads per day across the days plotted
// (days with no leads count as 0 — they're real quiet days, not missing).
// Weekly buckets (very long ranges) aren't days, so no stats for those.
function summarizeDaily(series) {
  if (!series.length || series.some((d) => d.weekly)) return null;
  const vals = series.map((d) => d.value);
  const sorted = [...vals].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = vals.reduce((s, v) => s + v, 0);
  const median = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
  const max = sorted[n - 1];
  const min = sorted[0];
  const busiest = series.find((d) => d.value === max);
  const quietest = series.find((d) => d.value === min);
  return {
    days: n,
    total: sum,
    average: sum / n,
    median,
    min,
    max,
    busiestLabel: busiest ? busiest.label : "",
    quietestLabel: quietest ? quietest.label : "",
    zeroDays: vals.filter((v) => v === 0).length,
  };
}

// A sheet value like "propertyguru.com.sg/listing/123" (no protocol) gets
// treated by the browser as a path on THIS app when clicked — e.g.
// "/dashboard/propertyguru.com.sg/listing/123" — which is a 404 here, not
// the listing. Adding https:// when it's missing is what makes "View ↗"
// actually leave the app.
function normalizeUrl(url) {
  if (!url) return "";
  const trimmed = url.trim();
  if (!trimmed) return "";
  // Some rows have an address or area typed into the link column instead
  // of a real URL ("188 Westwood Avenue, Boon Lay") — that has spaces or
  // commas a URL never does, so reject it outright rather than turning it
  // into a broken https:// link.
  if (/[\s,]/.test(trimmed)) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withProtocol);
    if (!u.hostname.includes(".")) return "";
    return withProtocol;
  } catch (e) {
    return "";
  }
}

// Property_master's Property_link cell often has several platforms
// compiled into one cell, e.g. "Propertyguru: https://…  99.co:
// https://…  SRX: https://…  EdgeProp: https://…". Pulls each labeled
// link out as its own {label, url} entry.
// Pulls every URL out of a Property_master link cell, whether it's a bare
// URL ("https://www.propertyguru.com.sg/…") or several labeled ones
// ("Propertyguru: https://…  99.co: https://…"). Each is labeled by its
// domain, so the label is consistent no matter how the cell was typed.
function parseCompiledLinks(text) {
  if (!text) return [];
  const out = [];
  const re = /https?:\/\/[^\s"'<>]+/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const url = normalizeUrl(m[0].replace(/[),.;]+$/, ""));
    if (url) out.push({ label: linkLabel(url), url });
  }
  return out;
}

// Property_master links first, then any extra platforms only seen on
// leads — one link per platform (Property_master wins a tie).
function mergeLinks(masterLinks, leadLinks) {
  const seen = new Set();
  const out = [];
  for (const l of [...masterLinks, ...leadLinks]) {
    const key = l.label.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(l);
  }
  return out;
}

// Your priority order for which listing platform to lead with — everything
// else (SRX, CommercialGuru, …) sorts after these, in whatever order it
// was found.
const LINK_PRIORITY = ["propertyguru", "99.co", "edgeprop"];
function sortLinksByPriority(links) {
  const rank = (l) => {
    const i = LINK_PRIORITY.findIndex((p) => l.label.toLowerCase().includes(p));
    return i === -1 ? LINK_PRIORITY.length : i;
  };
  return [...links].sort((a, b) => rank(a) - rank(b));
}

// A short, human label for a listing URL, so multiple links on the same
// property row (PropertyGuru, 99.co, …) are told apart at a glance
// instead of all reading "View".
function linkLabel(url) {
  try {
    const host = new URL(url).hostname.replace(/^www\./i, "");
    if (host.includes("propertyguru")) return "PropertyGuru";
    if (host.includes("99.co")) return "99.co";
    if (host.includes("commercialguru")) return "CommercialGuru";
    if (host.includes("srx")) return "SRX";
    if (host.includes("edgeprop")) return "EdgeProp";
    return host;
  } catch (e) {
    return "Listing";
  }
}

// One row per property, plus EVERY distinct listing URL recorded across
// its leads (not just the latest one) — the same property is often
// enquired through more than one platform, each with its own link, so
// picking a single "most recent" link was hiding the others.
function computePropertyTable(leads) {
  const map = {};
  for (const l of leads) {
    const name = (l.property_name || "").trim();
    if (!name) continue;
    if (!map[name]) map[name] = { property_name: name, total: 0, drop: 0, followUp: 0, pending: 0, check: 0, links: new Set() };
    const row = map[name];
    row.total++;
    const status = (l.customer_status || "").trim();
    const k = statusKey(status);
    if (k === "drop") row.drop++;
    else if (k === "followup") row.followUp++;
    else if (k === "pending") row.pending++;
    else if (k === "check") row.check++;

    if (l.property_link) {
      const url = normalizeUrl(l.property_link);
      if (url) row.links.add(url);
    }
  }
  return Object.values(map)
    .map((r) => ({ ...r, links: Array.from(r.links) }))
    .sort((a, b) => b.total - a.total);
}

// Top-N properties by enquiry count, split into separate Active/Expired
// lists rather than one mixed list — a property's status is its most
// recent recorded value (same "most recent wins" approach as the listing
// link), since it can change between enquiries (e.g. relisted).
function computeTopPropertiesByStatus(leads, limit = 10) {
  const map = {};
  for (const l of leads) {
    const name = (l.property_name || "").trim();
    if (!name) continue;
    if (!map[name]) map[name] = { name, count: 0, status: "", statusDate: null };
    const row = map[name];
    row.count++;
    const status = (l.property_status || "").trim();
    if (status) {
      const isNewer = !row.statusDate || (l.enquiry_date && l.enquiry_date > row.statusDate);
      if (!row.status || isNewer) {
        row.status = status;
        if (l.enquiry_date) row.statusDate = l.enquiry_date;
      }
    }
  }
  const all = Object.values(map);
  const topWithStatus = (status) =>
    all
      .filter((r) => r.status === status)
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((r) => ({ label: r.name, value: r.count }));
  return {
    active: topWithStatus("Active"),
    expired: topWithStatus("Expired"),
  };
}

function computeRepeatCustomers(leads) {
  const map = {};
  for (const l of leads) {
    const key = (l.mobile || "").trim();
    if (!key) continue;
    if (!map[key]) {
      map[key] = { mobile: key, name: "", count: 0, properties: new Set(), first: null, last: null, statuses: new Set() };
    }
    const c = map[key];
    c.count++;
    if (!c.name && (l.full_name || l.first_name)) c.name = l.full_name || l.first_name;
    if (l.property_name) c.properties.add(l.property_name.trim());
    if (l.customer_status) c.statuses.add(l.customer_status.trim());
    if (l.enquiry_date) {
      if (!c.first || l.enquiry_date < c.first) c.first = l.enquiry_date;
      if (!c.last || l.enquiry_date > c.last) c.last = l.enquiry_date;
    }
  }
  return Object.values(map)
    .filter((c) => c.count >= 2)
    .map((c) => ({ ...c, properties: Array.from(c.properties), statuses: Array.from(c.statuses) }))
    .sort((a, b) => b.count - a.count);
}

// "Follow-up" / "Follow up" / "followup " → "followup", so small spelling
// or spacing differences in the sheet don't split one status into two.
function statusKey(s) {
  return (s || "").toLowerCase().replace(/[^a-z]/g, "");
}

// Includes blank/missing values as their own "(blank)" bucket rather than
// silently dropping them — so a chart's bars always add up to the same
// total as "Total leads (in range)" above it, instead of quietly
// under-reporting whenever a field is empty for some rows.
function countBy(leads, field) {
  const counts = {};
  for (const l of leads) {
    const raw = (l[field] || "").trim();
    const v = raw || "(blank)";
    counts[v] = (counts[v] || 0) + 1;
  }
  return counts;
}

function toChartData(counts) {
  return Object.entries(counts).map(([label, value]) => ({ label, value }));
}

// ---------- daily trend (one point per calendar day, zero-filled) ----------

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// Local calendar date as YYYY-MM-DD. (toISOString() converts to UTC first,
// and midnight 1 Oct in Singapore is still 30 Sep in UTC — that shifted
// every day on the chart one day early.)
function dayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Picks the date span to plot: the selected month in full (clipped at
// today if it's the current month), the selected year (clipped at today
// if it's this year), or — for "All time" — from the earliest to the
// latest dated lead. Falls back to weekly buckets if that span would be
// unreasonably long (e.g. "All time" spanning several years).
function dailySeries(leads, yearFilter, monthFilter, now) {
  const dated = leads.filter((l) => l.enquiry_date);
  if (!dated.length) return [];

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start, end;

  if (yearFilter !== "all" && monthFilter !== "all") {
    const y = Number(yearFilter);
    const m = Number(monthFilter);
    start = new Date(y, m, 1);
    const lastOfMonth = new Date(y, m + 1, 0);
    end = lastOfMonth > today ? today : lastOfMonth;
  } else if (yearFilter !== "all") {
    const y = Number(yearFilter);
    start = new Date(y, 0, 1);
    const lastOfYear = new Date(y, 11, 31);
    end = lastOfYear > today ? today : lastOfYear;
  } else {
    const sortedDates = dated.map((l) => l.enquiry_date).sort();
    start = new Date(sortedDates[0] + "T00:00:00");
    end = new Date(sortedDates[sortedDates.length - 1] + "T00:00:00");
  }

  const spanDays = Math.round((end - start) / DAY) + 1;
  if (spanDays > 400) {
    // Too many days to plot one-per-day legibly — fall back to weekly.
    return weeklyFallback(dated);
  }

  const counts = {};
  for (const l of dated) counts[l.enquiry_date] = (counts[l.enquiry_date] || 0) + 1;

  // A single named month (e.g. Year 2026 + Sep) — the day-of-month number
  // alone (1, 2, 3…) is unambiguous, so the axis stays plain digits per
  // your request instead of repeating "Sep" on every tick. Any wider span
  // (a full year, or "all time") keeps the "Sep 1" short-date form so bars
  // from different months aren't confused with each other.
  const singleMonth = yearFilter !== "all" && monthFilter !== "all";

  const days = [];
  for (let cur = new Date(start); cur <= end; cur = addDays(cur, 1)) {
    const key = dayKey(cur);
    const shortLabel = cur.toLocaleDateString("en-SG", { month: "short", day: "numeric" });
    days.push({
      label: shortLabel,
      axisLabel: singleMonth ? String(cur.getDate()) : shortLabel,
      value: counts[key] || 0,
    });
  }
  return days;
}

function startOfWeek(d) {
  const day = d.getDay();
  const diff = (day === 0 ? -6 : 1) - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

function weeklyFallback(dated) {
  const buckets = {};
  for (const l of dated) {
    const d = new Date(l.enquiry_date + "T00:00:00");
    const key = dayKey(startOfWeek(d));
    buckets[key] = (buckets[key] || 0) + 1;
  }
  const keys = Object.keys(buckets).sort();
  return keys.map((key) => ({
    label: new Date(key + "T00:00:00").toLocaleDateString("en-SG", { month: "short", day: "numeric" }),
    value: buckets[key],
    weekly: true,
  }));
}
