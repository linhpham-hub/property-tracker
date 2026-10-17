import { useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useProfile } from "../lib/useProfile";
import Navbar from "../components/Navbar";
import StatTile from "../components/charts/StatTile";
import BarChart from "../components/charts/BarChart";
import BoxPlot from "../components/charts/BoxPlot";
import ConcentrationCurve from "../components/charts/ConcentrationCurve";
import {
  GROUPS,
  BLAST_ORDER,
  buildWarmIndex,
  normName,
  phoneKey,
  enrichAgents,
  histogram,
  concentration,
  agencyStats,
  groupSummary,
  nextBatch,
  toCsv,
} from "../lib/agentAnalytics";

// Co-broke targeting: which agents to send a blasting message to.
// Agents come live from the Agent_profile tab, grouped A–E by active
// listings. "Enquired before" is shown for reference only — matched
// against the agent enquiries in the leads table.

// Javier's agency — pinned and highlighted in the Agencies table.
const HOME_AGENCY = /crestbrick/i;

const AGENT_TABS = [
  { key: "summary", label: "Summary" },
  { key: "agencies", label: "Agencies" },
  { key: "blast", label: "Blast list" },
];

const pct = (v, d = 0) => `${(v * 100).toFixed(d)}%`;
const int = (v) => Number(v || 0).toLocaleString();
// "PROPNEX REALTY PTE. LTD." → "Propnex Realty"
function shortAgency(a) {
  const s = String(a || "")
    .replace(/\b(PTE\.?|PRIVATE)\s*(LTD|LIMITED)\.?/gi, "")
    .replace(/[\s.,]+$/, "")
    .replace(/\s+/g, " ")
    .trim();
  return s.toLowerCase().replace(/\b([a-z])/g, (m) => m.toUpperCase()).replace(/&/g, "&") || "(no agency)";
}
const leadIsAgent = (l) =>
  String(l.enquirer_type || "").trim().toLowerCase() === "agent" ||
  /\bagent\b/.test(String(l.customer_status_reason || "").toLowerCase());
function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  return `${d} ${["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][m - 1]} ${y}`;
}
const whatsapp = (phone) => {
  const d = String(phone || "").replace(/\D/g, "");
  return d.length >= 8 ? `https://wa.me/${d.length === 8 ? "65" + d : d}` : null;
};

export default function AgentsPage() {
  const { profile, loading } = useProfile();
  const [raw, setRaw] = useState(null);
  const [agentLeads, setAgentLeads] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const [tab, setTab] = useState("summary");
  const [agencyFilter, setAgencyFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [batchSize, setBatchSize] = useState(200);
  const [tierFilter, setTierFilter] = useState("all");

  useEffect(() => {
    if (!profile) return;
    load(false);
  }, [profile]);

  async function load(fresh) {
    setBusy(true);
    setError("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch(`/api/agents${fresh ? "?refresh=1" : ""}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not load agents");
      setRaw(json);
      // agent enquiries from the lead sheet (for "warm" matching)
      const out = [];
      for (let from = 0, page = 0; page < 50; page++, from += 1000) {
        const { data, error: e } = await supabase
          .from("leads")
          .select("full_name, mobile, enquirer_type, customer_status_reason, property_name, enquiry_date")
          .range(from, from + 999);
        if (e) break;
        out.push(...(data || []));
        if (!data || data.length < 1000) break;
      }
      setAgentLeads(out.filter(leadIsAgent));
    } catch (e) {
      setError(e.message);
    }
    setBusy(false);
  }

  const base = useMemo(() => {
    if (!raw) return null;
    const cols = raw.columns;
    const rawAgents = raw.rows.map((r) => Object.fromEntries(cols.map((c, i) => [c, r[i]])));
    return enrichAgents(rawAgents, buildWarmIndex(agentLeads));
  }, [raw, agentLeads]);

  const allAgencies = useMemo(() => (base ? agencyStats(base.agents) : []), [base]);

  // Where Javier's agency stands, against every agency (ignores filters).
  const home = useMemo(() => {
    const g = allAgencies.find((x) => HOME_AGENCY.test(x.agency));
    if (!g) return null;
    const rankBy = (list, key) => [...list].sort((a, b) => b[key] - a[key]).findIndex((x) => x.agency === g.agency) + 1;
    const peers = allAgencies.filter((x) => x.active >= 5 || x.agency === g.agency);
    return {
      ...g,
      total: allAgencies.length,
      rankAgents: rankBy(allAgencies, "agents"),
      rankAvg: rankBy(peers, "avg"),
      peers: peers.length,
      topPct: g.rank / allAgencies.length,
    };
  }, [allAgencies]);
  // Distinct agents who enquired (lead sheet), and how many matched a profile.
  const enquirers = useMemo(() => {
    const keys = new Set();
    for (const l of agentLeads) {
      const k = phoneKey(l.mobile) || normName(l.full_name);
      if (k) keys.add(k);
    }
    const matched = base ? base.agents.filter((a) => a.warm) : [];
    return {
      distinct: keys.size,
      matched: matched.length,
      byPhone: matched.filter((a) => a.warm.by.includes("phone")).length,
      byNameOnly: matched.filter((a) => a.warm.by === "name").length,
    };
  }, [agentLeads, base]);
  const rankOf = useMemo(() => Object.fromEntries(allAgencies.map((g) => [g.agency, g.rank])), [allAgencies]);

  const agents = useMemo(() => {
    if (!base) return [];
    const q = search.trim().toLowerCase();
    return base.agents.filter(
      (a) =>
        (agencyFilter === "all" || a.agency === agencyFilter) &&
        (!q || a.name.toLowerCase().includes(q) || a.agency.toLowerCase().includes(q))
    );
  }, [base, agencyFilter, search]);

  const view = useMemo(() => {
    if (!base) return null;
    const c = base.cutoffs;
    const listings = agents.reduce((s, a) => s + a.listings, 0);
    const sorted = agents.map((a) => a.listings).sort((x, y) => x - y);
    const median = sorted.length ? (sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2) : 0;
    const conc = concentration(agents);
    const hist = histogram(agents).map((b) => ({ ...b, muted: !b.highlight }));
    const agencies = agencyStats(agents);
    const prio = {};
    const prioOpen = {};
    for (const a of agents) {
      prio[a.group] = (prio[a.group] || 0) + 1;
      if (!a.contacted) prioOpen[a.group] = (prioOpen[a.group] || 0) + 1;
    }
    return {
      c,
      listings,
      median,
      conc,
      hist,
      agencies,
      tiers: groupSummary(agents),
      prio,
      prioOpen,
      contacted: agents.filter((a) => a.contacted).length,
      warm: agents.filter((a) => a.warm),
    };
  }, [base, agents]);

  const batch = useMemo(() => {
    const pool = tierFilter === "all" ? agents : agents.filter((a) => a.group === tierFilter);
    return nextBatch(pool, Number(batchSize) || 0);
  }, [agents, batchSize, tierFilter]);

  function downloadCsv() {
    const blob = new Blob(["﻿" + toCsv(batch)], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cobroke-blast-batch-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading || !profile) return <div className="loading-screen">Loading…</div>;

  return (
    <div className="theme-agent">
      <Navbar profile={profile} />
      <div className="page">
        <div className="page-header">
          <div>
            <h1>Agent dashboard</h1>
            <p className="muted small" style={{ margin: "0.2rem 0 0" }}>
              Co-broke targeting — which agents to send a blasting message to.
            </p>
          </div>
          <div className="dashboard-toolbar">
            {raw && (
              <span className="last-synced">
                Agent_profile {raw.dataAsOf ? `· ${raw.dataAsOf}` : ""} · read {new Date(raw.readAt).toLocaleString()}
              </span>
            )}
            <button onClick={() => load(true)} disabled={busy}>
              {busy ? "Loading…" : "↻ Reload sheet"}
            </button>
          </div>
        </div>

        {error && <p className="sync-message small">Could not load: {error}</p>}
        {busy && !base && <div className="loading-screen">Loading agents…</div>}

        {base && view && (
          <>
            <div className="filters dashboard-filters">
              <span className="muted small">Agency:</span>
              <select value={agencyFilter} onChange={(e) => setAgencyFilter(e.target.value)}>
                <option value="all">All agencies ({int(allAgencies.length)})</option>
                {allAgencies
                  .filter((g) => g.agents >= 5)
                  .sort((a, b) => b.agents - a.agents)
                  .map((g) => (
                    <option key={g.agency} value={g.agency}>
                      {shortAgency(g.agency)} ({int(g.agents)})
                    </option>
                  ))}
              </select>
              <input
                className="table-search"
                placeholder="Search agent or agency…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {(agencyFilter !== "all" || search) && (
                <button
                  type="button"
                  className="link-button small"
                  onClick={() => {
                    setAgencyFilter("all");
                    setSearch("");
                  }}
                >
                  Clear filters
                </button>
              )}
            </div>

            <div className="stat-grid">
              <StatTile label="Agents" value={int(agents.length)} />
              <StatTile label="Active listings" value={int(view.listings)} />
              <StatTile label="Median listings / agent" value={view.median} />
              <StatTile
                label="To blast (3+ listings)"
                value={int(BLAST_ORDER.reduce((s, k) => s + (view.prioOpen[k] || 0), 0))}
              />
              <StatTile
                label="Enquired on Javier's listings"
                value={`${int(view.warm.length)} (${pct(view.warm.length / Math.max(1, agents.length), 1)})`}
              />
              <StatTile label="Contacted so far" value={`${int(view.contacted)} (${pct(view.contacted / Math.max(1, agents.length), 1)})`} />
            </div>

            <div className="answer-card">
              <div className="answer-title">Who to blast next</div>
              <p className="small" style={{ margin: "0 0 0.5rem" }}>
                Agents are grouped by how many active listings they have — more listings means more chances to co-broke.
                Message the biggest group first, and skip group A.
              </p>
              <ol className="answer-list">
                {[...GROUPS].reverse().map((g) => (
                  <li key={g.key}>
                    <strong>Group {g.key}</strong> ({g.range}):{" "}
                    {g.key === "A" ? (
                      <span className="muted">skip — {int(view.prio.A || 0)} agents with too few listings</span>
                    ) : (
                      <>
                        <strong>{int(view.prioOpen[g.key] || 0)}</strong> not yet contacted
                      </>
                    )}
                  </li>
                ))}
              </ol>
              <button type="button" className="link-button" onClick={() => setTab("blast")}>
                Open the blast list →
              </button>
            </div>

            <div className="tab-bar" role="tablist">
              {AGENT_TABS.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.key}
                  className={`tab-button ${tab === t.key ? "tab-active" : ""}`}
                  onClick={() => setTab(t.key)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "summary" && (
              <div className="tab-panel">
                <div className="dashboard-grid">
                  <div className="chart-card">
                    <div className="chart-card-title">Distribution of active listings per agent</div>
                    <BarChart data={view.hist} />
                    <p className="muted small" style={{ marginTop: "0.5rem" }}>
                      Number of agents per listings band. Bands widen to the right because the distribution is strongly
                      right-skewed: median {view.c.median}, mean {view.c.mean.toFixed(1)}, 99th percentile {Math.round(view.c.p99)}, max{" "}
                      {view.c.max}. Dark bars = the agents to blast (groups B–E, 3+ listings).
                    </p>
                  </div>

                  <div className="chart-card">
                    <div className="chart-card-title">How concentrated are listings?</div>
                    <ConcentrationCurve
                      points={view.conc.points}
                      marks={[
                        { x: 0.1, y: view.conc.top.p10 || 0, label: `Top 10% → ${pct(view.conc.top.p10 || 0)}` },
                        { x: 0.2, y: view.conc.top.p20 || 0, label: `Top 20% → ${pct(view.conc.top.p20 || 0)}` },
                      ]}
                    />
                    <p className="muted small" style={{ marginTop: "0.5rem" }}>
                      {pct(view.conc.half || 0)} of agents hold half of all listings; {pct(view.conc.eighty || 0)} hold 80%. Gini
                      coefficient {view.conc.gini.toFixed(2)} (0 = evenly spread, 1 = one agent holds everything). A few agents
                      control a large share of supply — targeting them first gives the widest reach per message.
                    </p>
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-card-title">Groups by active listings</div>
                  <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                    Fixed bands, so a group always means the same thing. E = most listings. Groups B–E go into the blast list;
                    A is skipped.
                  </p>
                  <div className="table-wrap">
                    <table className="scorecard-table">
                      <thead>
                        <tr>
                          <th>Group</th>
                          <th>Agents</th>
                          <th>Share of agents</th>
                          <th>Listings</th>
                          <th>Share of listings</th>
                          <th>Enquired before</th>
                          <th>Contacted</th>
                          <th>Phone on file</th>
                        </tr>
                      </thead>
                      <tbody>
                        {view.tiers.map((t) => (
                          <tr key={t.key}>
                            <td>
                              <strong>{t.label}</strong> <span className="muted small">{t.range}</span>
                            </td>
                            <td>{int(t.agents)}</td>
                            <td>
                              <ShareBar v={t.agents / Math.max(1, agents.length)} />
                            </td>
                            <td>{int(t.listings)}</td>
                            <td>
                              <ShareBar v={t.listings / Math.max(1, view.listings)} />
                            </td>
                            <td>
                              {int(t.warm)} <span className="muted small">({pct(t.warm / Math.max(1, t.agents), 1)})</span>
                            </td>
                            <td>
                              {int(t.contacted)} <span className="muted small">({pct(t.contacted / Math.max(1, t.agents))})</span>
                            </td>
                            <td>{int(t.withPhone)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {tab === "agencies" && (
              <div className="tab-panel">
                <div className="chart-card">
                  <div className="chart-card-title">Agencies — size, supply and productivity</div>
                  <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                    Top 20 agencies by active listings{home ? `, plus ${shortAgency(home.agency)} (highlighted)` : ""}. Rank = by
                    active listings among all {int(allAgencies.length)} agencies.
                  </p>
                  <ul className="muted small column-notes">
                    <li>
                      <strong>All agents</strong> and <strong>Share of all agents</strong> — every registered agent, whether
                      or not they have a listing.
                    </li>
                    <li>
                      <strong>Agents with listings</strong> — agents with at least 1 active listing, and their % of the
                      agency.
                    </li>
                    <li>
                      <strong>Listings per agent with listings</strong>, <strong>Median</strong> and <strong>To blast</strong>{" "}
                      are measured on <em>agents with listings only</em>, so idle registrations don&apos;t drag an agency down.
                      To blast = groups B–E (3+ listings).
                    </li>
                  </ul>
                  {home && (
                    <div className="answer-card" style={{ marginBottom: "1rem" }}>
                      <div className="answer-title">Where {shortAgency(home.agency)} stands</div>
                      <ul className="answer-list">
                        <li>
                          <strong>#{home.rank}</strong> of {int(home.total)} agencies by active listings (top{" "}
                          {pct(home.topPct, home.topPct < 0.1 ? 1 : 0)}) — {int(home.listings)} listings, {pct(home.listingShare, 2)} of
                          the market.
                        </li>
                        <li>
                          <strong>#{home.rankAgents}</strong> by number of agents — {int(home.agents)} agents, of whom{" "}
                          {int(home.active)} ({pct(home.activePct)}) have at least 1 active listing.
                        </li>
                        <li>
                          <strong>#{home.rankAvg}</strong> of {int(home.peers)} agencies with 5+ agents with listings, by listings
                          per agent with listings — {home.avg.toFixed(1)} each (median: {home.box.median}).
                        </li>
                      </ul>
                    </div>
                  )}
                  <div className="table-wrap table-scroll">
                    <table className="scorecard-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Agency</th>
                          <th>All agents</th>
                          <th>Share of all agents</th>
                          <th>Agents with listings</th>
                          <th>Listings</th>
                          <th>Share of listings</th>
                          <th>Listings per agent with listings</th>
                          <th>Median (agents with listings)</th>
                          <th>To blast</th>
                          <th>Not yet contacted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          ...view.agencies.slice(0, 20),
                          ...view.agencies.filter((g, i) => i >= 20 && HOME_AGENCY.test(g.agency)),
                        ].map((g) => (
                          <tr
                            key={g.agency}
                            className={`clickable-row ${HOME_AGENCY.test(g.agency) ? "home-row" : ""}`}
                            onClick={() => setAgencyFilter(g.agency)}
                            title="Filter to this agency"
                          >
                            <td className="muted">#{rankOf[g.agency]}</td>
                            <td>
                              <strong>{shortAgency(g.agency)}</strong>
                            </td>
                            <td>{int(g.agents)}</td>
                            <td>
                              <ShareBar v={g.agentShare} />
                            </td>
                            <td>
                              {int(g.active)} <span className="muted small">({pct(g.activePct)})</span>
                            </td>
                            <td>{int(g.listings)}</td>
                            <td>
                              <ShareBar v={g.listingShare} />
                            </td>
                            <td>{g.avg.toFixed(1)}</td>
                            <td>{g.box.median}</td>
                            <td>
                              {int(g.target)} <span className="muted small">({pct(g.targetPct)})</span>
                            </td>
                            <td>
                              <strong>{int(g.uncontactedTarget)}</strong>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="chart-card">
                  <div className="chart-card-title">Listings per agent, by agency</div>
                  <p className="muted small" style={{ marginBottom: "0.5rem" }}>
                    Agencies with 30+ agents with listings; agents with 0 listings left out. Box = middle 50% of agents, white
                    line = median, ◆ = mean, whiskers = typical
                    range (1.5× IQR); agents above the whisker are counted on the right. A box further right means the typical
                    agent there holds more listings.
                  </p>
                  <BoxPlot
                    valueLabel="listings"
                    rows={view.agencies
                      .filter((g) => g.active >= 30)
                      .sort((a, b) => b.box.median - a.box.median || b.box.q3 - a.box.q3)
                      .slice(0, 10)
                      .map((g) => ({ label: `${shortAgency(g.agency)} (${int(g.active)})`, box: g.box }))}
                  />
                </div>
              </div>
            )}

            {tab === "blast" && (
              <div className="tab-panel">
                <div className="chart-card">
                  <div className="chart-card-title">Groups — agents not yet contacted</div>
                  <div className="priority-chips">
                    {BLAST_ORDER.map((k) => GROUPS.find((g) => g.key === k)).map((p) => (
                      <button
                        type="button"
                        key={p.key}
                        className={`priority-chip ${tierFilter === p.key ? "priority-chip-on" : ""}`}
                        onClick={() => setTierFilter(tierFilter === p.key ? "all" : p.key)}
                      >
                        <span className="priority-chip-value">{int(view.prioOpen[p.key] || 0)}</span>
                        <span className="priority-chip-label">Group {p.label}</span>
                        <span className="muted small">{p.range}</span>
                        {(() => {
                          const t = view.tiers.find((x) => x.key === p.key);
                          return t ? (
                            <span className="muted small">
                              {pct(t.warm / Math.max(1, t.agents), 1)} enquired before ({int(t.warm)})
                            </span>
                          ) : null;
                        })()}
                      </button>
                    ))}
                  </div>
                  <p className="muted small" style={{ marginTop: "0.6rem" }}>
                    "Contacted" = anything in the sheet's Assigned To or Status column. Click a group to list only that group; group A (0–2 listings) is left out.
                  </p>
                </div>

                <div className="chart-card">
                  <div className="chart-card-title" style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
                    <span>
                      Next blast batch ({int(batch.length)}
                      {tierFilter !== "all" ? ` · group ${tierFilter}` : ""})
                    </span>
                    <span style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                      <span className="muted small nowrap">Batch size</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        className="batch-input"
                        value={batchSize}
                        onChange={(e) => setBatchSize(e.target.value === "" ? "" : Math.max(1, Math.floor(Number(e.target.value)) || 1))}
                        onBlur={() => batchSize === "" && setBatchSize(200)}
                        aria-label="Batch size"
                      />
                      <button type="button" className="nowrap" onClick={downloadCsv} disabled={!batch.length}>
                        ⬇ Download CSV
                      </button>
                    </span>
                  </div>
                  <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                    Not yet contacted, most active listings first (group E, then D, C, B). The CSV has name, agency, listings, phone,
                    profile link and CEA licence — ready to assign. Phones are only in the sheet for agents already looked up; use
                    the profile link for the rest.
                  </p>
                  {batch.length ? (
                    <div className="table-wrap table-scroll">
                      <table>
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Group</th>
                            <th>Agent</th>
                            <th>Agency</th>
                            <th>Listings</th>
                            <th>Contact</th>
                            <th>Enquired before</th>
                          </tr>
                        </thead>
                        <tbody>
                          {batch.map((a, i) => (
                            <tr key={a.id}>
                              <td className="muted">{i + 1}</td>
                              <td>
                                <span className="flag-chip flag-low">{a.group}</span>
                              </td>
                              <td>
                                {a.name}
                                <div className="muted small">{a.cea}</div>
                              </td>
                              <td>{shortAgency(a.agency)}</td>
                              <td>{a.listings}</td>
                              <td>
                                {whatsapp(a.phone) ? (
                                  <a href={whatsapp(a.phone)} target="_blank" rel="noopener noreferrer" className="inline-link">
                                    WhatsApp ↗
                                  </a>
                                ) : null}
                                {a.link && (
                                  <a href={a.link} target="_blank" rel="noopener noreferrer" className="inline-link">
                                    Profile ↗
                                  </a>
                                )}
                              </td>
                              <td>
                                {a.warm ? (
                                  <>
                                    {a.warm.count}× · last {formatDate(a.warm.last)}
                                    <div className="muted small">{a.warm.properties.slice(0, 2).join(", ")}</div>
                                  </>
                                ) : (
                                  <span className="muted">—</span>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="muted small">Everyone in this group has been contacted.</p>
                  )}
                </div>

                <div className="chart-card">
                  <div className="chart-card-title">Agents who enquired on Javier's listings ({int(view.warm.length)})</div>
                  <p className="muted small" style={{ marginBottom: "0.75rem" }}>
                    {int(view.warm.length)} of {int(agents.length)} agent profiles ({pct(view.warm.length / Math.max(1, agents.length), 1)})
                    have enquired. Matching uses <strong>phone OR name</strong>: phone (last 8 digits) is a sure match; a name
                    counts when only one profile has it, ignoring case, word order and bracketed names. Overall,{" "}
                    {int(enquirers.matched)} of the {int(enquirers.distinct)} different agents in your lead sheet matched a
                    profile ({int(enquirers.byPhone)} by phone, {int(enquirers.byNameOnly)} by name only) — as you add phone
                    numbers to Agent_profile, more will match by phone. Check name-only matches before messaging.
                  </p>
                  <div className="table-wrap table-scroll">
                    <table>
                      <thead>
                        <tr>
                          <th>Agent</th>
                          <th>Agency</th>
                          <th>Listings</th>
                          <th>Enquiries</th>
                          <th>Properties enquired</th>
                          <th>Last enquiry</th>
                          <th>Matched by</th>
                          <th>Contacted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...view.warm]
                          .sort((a, b) => (b.warm.last || "").localeCompare(a.warm.last || ""))
                          .map((a) => (
                            <tr key={a.id}>
                              <td>
                                {a.link ? (
                                  <a href={a.link} target="_blank" rel="noopener noreferrer">
                                    {a.name}
                                  </a>
                                ) : (
                                  a.name
                                )}
                              </td>
                              <td>{shortAgency(a.agency)}</td>
                              <td>{a.listings}</td>
                              <td>{a.warm.count}</td>
                              <td>{a.warm.properties.join(", ")}</td>
                              <td className="nowrap">{formatDate(a.warm.last)}</td>
                              <td>{a.warm.by}</td>
                              <td>{a.contacted ? a.assignedTo || a.status : <span className="muted">no</span>}</td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// Inline bar for a share (0–1) inside a table cell.
function ShareBar({ v }) {
  return (
    <span className="share-bar">
      <span className="share-bar-track">
        <span className="share-bar-fill" style={{ width: `${Math.max(0, Math.min(1, v)) * 100}%` }} />
      </span>
      <span className="share-bar-num">{(v * 100).toFixed(1)}%</span>
    </span>
  );
}
