// Analysis behind the Agent dashboard (co-broke targeting). Pure functions —
// no React, no network — so they can be checked against the real sheet.

export const normName = (s) => String(s || "").toLowerCase().replace(/[^a-z]/g, "");
export const phoneKey = (s) => {
  const d = String(s || "").replace(/\D/g, "");
  return d.length >= 8 ? d.slice(-8) : "";
};
export const isContacted = (a) => !!(a.assignedTo || a.status);

function quantile(sorted, q) {
  if (!sorted.length) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

// Tiers come from the data itself (percentiles of active listings across
// all agents), so they adapt when the sheet is refreshed.
export function computeCutoffs(agents) {
  const s = agents.map((a) => a.listings).sort((a, b) => a - b);
  const p75 = Math.max(2, Math.round(quantile(s, 0.75)));
  const p90 = Math.max(p75 + 1, Math.round(quantile(s, 0.9)));
  return {
    p25: quantile(s, 0.25),
    median: quantile(s, 0.5),
    p75,
    p90,
    p99: quantile(s, 0.99),
    mean: s.length ? s.reduce((x, y) => x + y, 0) / s.length : 0,
    max: s.length ? s[s.length - 1] : 0,
  };
}

// Groups by number of active listings — fixed bands, easy to read and the
// same every time the sheet is refreshed. A = fewest listings, E = most.
// The blast list goes E → D → C → B; group A (0–2 listings) is skipped.
export const GROUPS = [
  { key: "A", label: "A", range: "0–2 listings", lo: 0, hi: 2 },
  { key: "B", label: "B", range: "3–4 listings", lo: 3, hi: 4 },
  { key: "C", label: "C", range: "5–9 listings", lo: 5, hi: 9 },
  { key: "D", label: "D", range: "10–19 listings", lo: 10, hi: 19 },
  { key: "E", label: "E", range: "20+ listings", lo: 20, hi: Infinity },
];
export const BLAST_ORDER = ["E", "D", "C", "B"];
export const isBlastGroup = (key) => BLAST_ORDER.includes(key);
export function groupOf(listings) {
  const g = GROUPS.find((x) => listings >= x.lo && listings <= x.hi);
  return g ? g.key : "A";
}

// Lead-sheet agents → profiles. Phone match wins; otherwise an exact
// (normalised) name match, only when that name is unique among profiles.
export function buildWarmIndex(agentLeads) {
  const byPhone = {};
  const byName = {};
  for (const l of agentLeads) {
    const entry = (map, key) => {
      if (!key) return;
      const e = (map[key] = map[key] || { count: 0, last: null, properties: new Set() });
      e.count++;
      if (l.property_name) e.properties.add(l.property_name.trim());
      if (l.enquiry_date && (!e.last || l.enquiry_date > e.last)) e.last = l.enquiry_date;
    };
    entry(byPhone, phoneKey(l.mobile));
    entry(byName, normName(l.full_name));
  }
  return { byPhone, byName };
}

export function enrichAgents(rawAgents, warmIndex) {
  const nameCounts = {};
  for (const a of rawAgents) {
    const n = normName(a.name);
    nameCounts[n] = (nameCounts[n] || 0) + 1;
  }
  const cutoffs = computeCutoffs(rawAgents);
  const agents = rawAgents.map((a, i) => {
    const pk = phoneKey(a.phone);
    const n = normName(a.name);
    let warm = (pk && warmIndex.byPhone[pk]) || null;
    let warmBy = warm ? "phone" : "";
    if (!warm && nameCounts[n] === 1 && warmIndex.byName[n]) {
      warm = warmIndex.byName[n];
      warmBy = "name";
    }
    return {
      ...a,
      id: i,
      group: groupOf(a.listings),
      warm: warm ? { count: warm.count, last: warm.last, properties: Array.from(warm.properties), by: warmBy } : null,
      contacted: isContacted(a),
    };
  });
  return { agents, cutoffs };
}

// Histogram bins widen to the right because the distribution is heavily
// right-skewed (most agents have a handful of listings, a few have 100+).
// Bin edges line up with the A–E group edges.
export const HIST_BINS = [
  { label: "0", lo: 0, hi: 0 },
  { label: "1", lo: 1, hi: 1 },
  { label: "2", lo: 2, hi: 2 },
  { label: "3–4", lo: 3, hi: 4 },
  { label: "5–9", lo: 5, hi: 9 },
  { label: "10–19", lo: 10, hi: 19 },
  { label: "20–49", lo: 20, hi: 49 },
  { label: "50–99", lo: 50, hi: 99 },
  { label: "100+", lo: 100, hi: Infinity },
];
export function histogram(agents) {
  return HIST_BINS.map((b) => {
    const inBin = agents.filter((a) => a.listings >= b.lo && a.listings <= b.hi);
    return {
      label: b.label,
      value: inBin.length,
      listings: inBin.reduce((s, a) => s + a.listings, 0),
      // emphasis: bins in the blast groups (3+ listings)
      highlight: b.lo >= 3,
    };
  });
}

// Concentration of listings: sort agents high→low, then cumulative share
// of all listings held by the top x% of agents. Gini 0 = everyone holds
// the same; 1 = one agent holds everything.
export function concentration(agents) {
  const s = agents.map((a) => a.listings).sort((a, b) => b - a);
  const n = s.length;
  const total = s.reduce((x, y) => x + y, 0);
  if (!n || !total) return { points: [], gini: 0, total, n, top: {} };
  const cum = [0];
  for (const v of s) cum.push(cum[cum.length - 1] + v);
  const shareAt = (p) => cum[Math.round(n * p)] / total;
  const points = [];
  for (let i = 0; i <= 100; i += 2) points.push({ x: i / 100, y: shareAt(i / 100) });
  // agents needed to reach half / 80% of listings
  const agentsFor = (target) => {
    let k = 0;
    while (k < n && cum[k] / total < target) k++;
    return k / n;
  };
  // Gini on the ascending order
  const asc = [...s].reverse();
  let num = 0;
  for (let i = 0; i < n; i++) num += (2 * (i + 1) - n - 1) * asc[i];
  const gini = num / (n * total);
  return {
    points,
    gini,
    total,
    n,
    top: { p1: shareAt(0.01), p5: shareAt(0.05), p10: shareAt(0.1), p20: shareAt(0.2) },
    half: agentsFor(0.5),
    eighty: agentsFor(0.8),
  };
}

function fiveNumber(values) {
  const s = [...values].sort((a, b) => a - b);
  const q1 = quantile(s, 0.25);
  const q3 = quantile(s, 0.75);
  const iqr = q3 - q1;
  const loFence = q1 - 1.5 * iqr;
  const hiFence = q3 + 1.5 * iqr;
  const inside = s.filter((v) => v >= loFence && v <= hiFence);
  return {
    min: s[0],
    q1,
    median: quantile(s, 0.5),
    q3,
    max: s[s.length - 1],
    whiskerLo: inside.length ? inside[0] : s[0],
    whiskerHi: inside.length ? inside[inside.length - 1] : s[s.length - 1],
    outliers: s.length - inside.length,
    mean: s.reduce((x, y) => x + y, 0) / s.length,
  };
}

export function agencyStats(agents) {
  const total = agents.length;
  const totalListings = agents.reduce((s, a) => s + a.listings, 0);
  const map = {};
  for (const a of agents) {
    const k = a.agency || "(no agency)";
    (map[k] = map[k] || []).push(a);
  }
  return Object.entries(map)
    .map(([agency, list]) => {
      const listings = list.reduce((s, a) => s + a.listings, 0);
      const target = list.filter((a) => isBlastGroup(a.group)).length;
      return {
        agency,
        agents: list.length,
        listings,
        agentShare: total ? list.length / total : 0,
        listingShare: totalListings ? listings / totalListings : 0,
        avg: listings / list.length,
        box: fiveNumber(list.map((a) => a.listings)),
        target,
        targetPct: target / list.length,
        warm: list.filter((a) => a.warm).length,
        contacted: list.filter((a) => a.contacted).length,
        uncontactedTarget: list.filter((a) => isBlastGroup(a.group) && !a.contacted).length,
      };
    })
    .sort((a, b) => b.listings - a.listings);
}

export function groupSummary(agents) {
  return [...GROUPS].reverse().map((t) => {
    const list = agents.filter((a) => a.group === t.key);
    return {
      ...t,
      agents: list.length,
      listings: list.reduce((s, a) => s + a.listings, 0),
      contacted: list.filter((a) => a.contacted).length,
      withPhone: list.filter((a) => a.phone).length,
      warm: list.filter((a) => a.warm).length,
    };
  });
}

// The next agents to message: not yet contacted, in groups E → B (most
// listings first); group A is left out.
export function nextBatch(agents, size) {
  return agents
    .filter((a) => !a.contacted && isBlastGroup(a.group))
    .sort((x, y) => y.listings - x.listings || x.name.localeCompare(y.name))
    .slice(0, size);
}

export function toCsv(rows) {
  const head = ["Group", "Agent Name", "Agency", "Active Listings", "Phone", "Profile Link", "CEA Licence", "Warm (enquired before)"];
  const esc = (v) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [head.join(",")];
  for (const a of rows)
    lines.push(
      [a.group, a.name, a.agency, a.listings, a.phone, a.link, a.cea, a.warm ? `Yes (${a.warm.count}x, last ${a.warm.last || "?"})` : ""]
        .map(esc)
        .join(",")
    );
  return lines.join("\n");
}
