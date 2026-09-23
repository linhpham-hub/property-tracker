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
  const [propertySearch, setPropertySearch] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ yearFilter, monthFilter }));
  }, [yearFilter, monthFilter]);

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
    const { data } = await supabase.from("properties").select("id, property_name, property_link");
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

  const now = useMemo(() => new Date(), [leads]); // recompute "today" each time data reloads
  const availableYears = useMemo(() => getAvailableYears(leads), [leads]);
  const filteredLeads = useMemo(() => filterByYearMonth(leads, yearFilter, monthFilter), [leads, yearFilter, monthFilter]);
  const undatedExcluded = useMemo(
    () => (yearFilter !== "all" || monthFilter !== "all" ? leads.filter((l) => !l.enquiry_date).length : 0),
    [leads, yearFilter, monthFilter]
  );

  const stats = useMemo(
    () => computeStats(leads, filteredLeads, yearFilter, monthFilter, now),
    [leads, filteredLeads, yearFilter, monthFilter, now]
  );
  const lastSynced = useMemo(() => {
    const dates = leads.map((l) => l.synced_at).filter(Boolean);
    if (!dates.length) return null;
    return new Date(Math.max(...dates.map((d) => new Date(d).getTime())));
  }, [leads]);

  const filteredPropertyRows = useMemo(() => {
    if (!propertySearch.trim()) return stats.propertyTable;
    const q = propertySearch.trim().toLowerCase();
    return stats.propertyTable.filter((r) => r.property_name.toLowerCase().includes(q));
  }, [stats.propertyTable, propertySearch]);

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
            </div>
            {undatedExcluded > 0 && (
              <p className="muted small" style={{ marginTop: "-0.5rem", marginBottom: "1rem" }}>
                {undatedExcluded.toLocaleString()} lead{undatedExcluded === 1 ? "" : "s"} with no recorded enquiry date{" "}
                {undatedExcluded === 1 ? "isn't" : "aren't"} included in this date range (they're included under "All time").
              </p>
            )}

            <div className="stat-grid">
              <StatTile label="Total leads (in range)" value={stats.total.toLocaleString()} />
              <StatTile
                label="Needs follow-up now"
                value={stats.needsFollowUp.length.toLocaleString()}
                delta={stats.needsFollowUp.length > 0 ? `${MATURE_DAYS}+ days, no update` : ""}
                deltaGood={stats.needsFollowUp.length === 0}
              />
              <StatTile label="Active pipeline" value={stats.activePipeline.toLocaleString()} />
              <StatTile
                label={`Drop rate (${MATURE_DAYS}+ day leads)`}
                value={stats.dropRateMatured !== null ? `${stats.dropRateMatured}%` : "—"}
              />
            </div>

            <div className="dashboard-grid">
              <div className="chart-card">
                <div className="chart-card-title">Leads per day</div>
                {stats.dailyTrend.length > 1 ? (
                  <LineChart data={stats.dailyTrend} />
                ) : (
                  <p className="muted small">Not enough dated leads yet to chart this.</p>
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
                  Raw reason text ({stats.dropReasonsRaw.length}) — what rolled into each bucket above
                </div>
                {stats.dropReasonsRaw.length ? (
                  <div className="table-wrap table-scroll">
                    <table className="reason-table">
                      <thead>
                        <tr>
                          <th>Reason (as written in the sheet)</th>
                          <th>Count</th>
                        </tr>
                      </thead>
                      <tbody>
                        {stats.dropReasonsRaw.map((r) => (
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
            </div>

            <div className="chart-card" style={{ marginTop: "1.25rem" }}>
              <div className="chart-card-title">Top {stats.topProperties.length} most-enquired properties</div>
              {stats.topProperties.length ? (
                <HBarChart data={stats.topProperties} />
              ) : (
                <p className="muted small">No property data yet.</p>
              )}
            </div>

            <div className="chart-card" style={{ marginTop: "1.25rem" }}>
              <div className="chart-card-title">Leads by property</div>
              <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                "Enquiries" = contact rows recorded in the sheet for that property (the sheet doesn't track page views/clicks
                separately). Listings come from that property's entry in Property_master when there's a name match — the same
                place your Propertyguru/99.co/SRX/EdgeProp links live — falling back to whatever link was recorded directly
                on a lead if there's no match.
              </p>
              <input
                className="table-search"
                placeholder="Search property…"
                value={propertySearch}
                onChange={(e) => setPropertySearch(e.target.value)}
                style={{ marginBottom: "0.75rem" }}
              />
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
                      const rowLinks = compiled.length ? compiled : r.links.map((url) => ({ label: linkLabel(url), url }));
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

const REASON_RULES = [
  { test: /expired/i, label: "Property expired" },
  { test: /no whatsapp/i, label: "No WhatsApp contact" },
  { test: /no property name/i, label: "Missing property info" },
  { test: /no match/i, label: "No matching property" },
  { test: /agent/i, label: "Agent lead (no follow-up needed)" },
  { test: /wait.*reply|customer no reply|no reply/i, label: "Awaiting customer reply" },
  { test: /let javier follow|scheduled/i, label: "Handed to Javier" },
  { test: /not last_update/i, label: "Tracking not updated" },
  { test: /viewed/i, label: "Unit viewed" },
  { test: /no need property/i, label: "No longer needs property" },
];

function categorizeReason(raw) {
  if (!raw) return null;
  for (const rule of REASON_RULES) {
    if (rule.test.test(raw)) return rule.label;
  }
  return "Other";
}

// ---------- main aggregation ----------

function computeStats(allLeads, filteredLeads, yearFilter, monthFilter, now) {
  const total = filteredLeads.length;

  const statusCounts = countBy(filteredLeads, "customer_status");
  const activePipeline = (statusCounts["Follow-up"] || 0) + (statusCounts["Pending"] || 0);
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
    ? Math.round((matured.filter((l) => (l.customer_status || "").trim() === "Drop").length / matured.length) * 100)
    : null;

  // Needs-follow-up: always computed from ALL leads (not the date-range
  // filter) and against the real current date — it's a live to-do list.
  const needsFollowUp = computeFollowUps(allLeads, now);

  const topProperties = computeTopProperties(filteredLeads);

  const leadSource = toChartData(countBy(filteredLeads, "source_data")).sort((a, b) => b.value - a.value);

  // Reason taxonomy — grouped (chart) + raw (audit table), scoped to the
  // selected date range.
  const reasonCounts = countBy(filteredLeads, "customer_status_reason");
  const groupedCounts = {};
  let groupedTotal = 0;
  for (const [raw, count] of Object.entries(reasonCounts)) {
    const bucket = categorizeReason(raw);
    if (!bucket) continue;
    groupedCounts[bucket] = (groupedCounts[bucket] || 0) + count;
    groupedTotal += count;
  }
  const dropReasonsGrouped = Object.entries(groupedCounts)
    .map(([label, value]) => ({ label, value, pct: groupedTotal ? Math.round((value / groupedTotal) * 100) : 0 }))
    .sort((a, b) => b.value - a.value);
  const dropReasonsRaw = toChartData(reasonCounts)
    .sort((a, b) => b.value - a.value)
    .slice(0, 15);

  const propertyTable = computePropertyTable(filteredLeads);
  const repeatCustomers = computeRepeatCustomers(filteredLeads);
  const dailyTrend = dailySeries(filteredLeads, yearFilter, monthFilter, now);

  return {
    total,
    activePipeline,
    dropRateMatured,
    customerStatus,
    propertyType,
    topProperties,
    leadSource,
    dropReasonsGrouped,
    dropReasonsRaw,
    needsFollowUp,
    propertyTable,
    repeatCustomers,
    dailyTrend,
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
function parseCompiledLinks(text) {
  if (!text) return [];
  const out = [];
  const re = /([A-Za-z0-9][A-Za-z0-9 .]{0,20}?):\s*(https?:\/\/\S+)/g;
  let m;
  while ((m = re.exec(text)) !== null) {
    const url = normalizeUrl(m[2]);
    if (url) out.push({ label: m[1].trim(), url });
  }
  return out;
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
    if (status === "Drop") row.drop++;
    else if (status === "Follow-up") row.followUp++;
    else if (status === "Pending") row.pending++;
    else if (status === "Check") row.check++;

    if (l.property_link) {
      const url = normalizeUrl(l.property_link);
      if (url) row.links.add(url);
    }
  }
  return Object.values(map)
    .map((r) => ({ ...r, links: Array.from(r.links) }))
    .sort((a, b) => b.total - a.total);
}

// Top-N properties by enquiry count, with the Rent/Sale status folded
// into the label ("Suites at Orchard, Rent") — same "most recent value
// wins" approach as the listing link, since a property's status can
// change between enquiries (e.g. relisted from Sale to Rent).
function computeTopProperties(leads, limit = 10) {
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
  return Object.values(map)
    .sort((a, b) => b.count - a.count)
    .slice(0, limit)
    .map((r) => ({ label: r.status ? `${r.name}, ${r.status}` : r.name, value: r.count }));
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

// ---------- daily trend (one point per calendar day, zero-filled) ----------

function addDays(d, n) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

function dayKey(d) {
  return d.toISOString().slice(0, 10);
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
  }));
}
