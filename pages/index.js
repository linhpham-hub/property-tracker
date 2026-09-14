import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "../lib/supabaseClient";
import { useProfile } from "../lib/useProfile";
import Navbar from "../components/Navbar";

// Preferred order for grouping sections — anything not listed here is
// appended afterward, alphabetically.
const TYPE_PRIORITY = ["Residential Sale", "Residential Rent", "Commercial Sale", "Commercial Rent"];

const STORAGE_KEY = "property-tracker-dashboard-state";

function loadSavedState() {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

export default function Dashboard() {
  const { profile, loading } = useProfile();
  const [properties, setProperties] = useState([]);
  const [fetching, setFetching] = useState(true);
  const saved = useMemo(loadSavedState, []);
  const [query, setQuery] = useState(saved.query || "");
  const [typeFilter, setTypeFilter] = useState(saved.typeFilter || "All");
  const [statusFilter, setStatusFilter] = useState(saved.statusFilter || "All");
  const [districtFilter, setDistrictFilter] = useState(saved.districtFilter || "All");
  const [bedsFilter, setBedsFilter] = useState(saved.bedsFilter || "All");
  const [minPrice, setMinPrice] = useState(saved.minPrice || "");
  const [maxPrice, setMaxPrice] = useState(saved.maxPrice || "");
  const [viewMode, setViewMode] = useState(saved.viewMode || "grid"); // "grid" | "list"
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState("");

  // Remember view mode + filters across navigation (e.g. going to a
  // property's page and back) — cleared when the browser tab closes.
  useEffect(() => {
    if (typeof window === "undefined") return;
    sessionStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        query,
        typeFilter,
        statusFilter,
        districtFilter,
        bedsFilter,
        minPrice,
        maxPrice,
        viewMode,
      })
    );
  }, [query, typeFilter, statusFilter, districtFilter, bedsFilter, minPrice, maxPrice, viewMode]);

  async function syncFromSheet() {
    setSyncing(true);
    setSyncMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/sheets/pull", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
      });
      const result = await res.json();
      if (!res.ok) {
        setSyncMessage(`Sync failed: ${result.error}`);
      } else {
        setSyncMessage(`Synced: ${result.created} added, ${result.updated} updated${result.skipped ? `, ${result.skipped} skipped` : ""}.`);
        const { data } = await supabase
          .from("properties")
          .select("*, property_media(count)")
          .order("created_at", { ascending: false });
        setProperties(data || []);
      }
    } catch (e) {
      setSyncMessage("Sync failed — check your connection and try again.");
    }
    setSyncing(false);
  }

  useEffect(() => {
    if (!profile) return;
    async function load() {
      const { data } = await supabase
        .from("properties")
        .select("*, property_media(count)")
        .order("created_at", { ascending: false });
      setProperties(data || []);
      setFetching(false);
    }
    load();
  }, [profile]);

  const types = useMemo(
    () => ["All", ...new Set(properties.map((p) => p.property_type).filter(Boolean))],
    [properties]
  );
  const statuses = useMemo(
    () => ["All", ...new Set(properties.map((p) => p.property_status).filter(Boolean))],
    [properties]
  );
  const districts = useMemo(
    () => ["All", ...new Set(properties.map((p) => p.district).filter(Boolean))].sort(),
    [properties]
  );
  const bedsOptions = useMemo(
    () => ["All", ...new Set(properties.map((p) => p.beds).filter(Boolean))],
    [properties]
  );

  // Best-effort: pull the first number out of a price/rent string like
  // "3,500,000" or "S$ 950,000" or "950/mo" so range filtering works
  // even though the field is stored as free text.
  function parsePrice(value) {
    if (!value) return null;
    const match = String(value).replace(/,/g, "").match(/\d+(\.\d+)?/);
    return match ? parseFloat(match[0]) : null;
  }

  const filtered = properties.filter((p) => {
    const q = query.toLowerCase();
    const matchesQuery =
      q === "" ||
      p.property_name?.toLowerCase().includes(q) ||
      p.address?.toLowerCase().includes(q) ||
      p.area?.toLowerCase().includes(q) ||
      p.listing_id?.toLowerCase().includes(q) ||
      p.property_link?.toLowerCase().includes(q);
    const matchesType = typeFilter === "All" || p.property_type === typeFilter;
    const matchesStatus = statusFilter === "All" || p.property_status === statusFilter;
    const matchesDistrict = districtFilter === "All" || p.district === districtFilter;
    const matchesBeds = bedsFilter === "All" || p.beds === bedsFilter;
    const price = parsePrice(p.price_or_rent);
    const matchesMin = minPrice === "" || (price !== null && price >= parseFloat(minPrice));
    const matchesMax = maxPrice === "" || (price !== null && price <= parseFloat(maxPrice));
    return (
      matchesQuery &&
      matchesType &&
      matchesStatus &&
      matchesDistrict &&
      matchesBeds &&
      matchesMin &&
      matchesMax
    );
  });

  // Group the filtered list into sections by property type
  const grouped = useMemo(() => {
    const map = new Map();
    filtered.forEach((p) => {
      const key = p.property_type || "Uncategorised";
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    const keys = Array.from(map.keys());
    keys.sort((a, b) => {
      const ai = TYPE_PRIORITY.indexOf(a);
      const bi = TYPE_PRIORITY.indexOf(b);
      if (ai !== -1 && bi !== -1) return ai - bi;
      if (ai !== -1) return -1;
      if (bi !== -1) return 1;
      return a.localeCompare(b);
    });
    return keys.map((k) => ({ type: k, items: map.get(k) }));
  }, [filtered]);

  if (loading || fetching) return <div className="loading-screen">Loading…</div>;

  return (
    <div>
      <Navbar profile={profile} />
      <main className="page">
        <div className="page-header">
          <h1>Properties</h1>
          <div className="page-header-right">
            <span className="count">
              {filtered.length} of {properties.length}
            </span>
            <div className="view-toggle">
              <button
                type="button"
                className={viewMode === "grid" ? "active" : ""}
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
              >
                ▦ Grid
              </button>
              <button
                type="button"
                className={viewMode === "list" ? "active" : ""}
                onClick={() => setViewMode("list")}
                aria-label="List view"
              >
                ☰ List
              </button>
            </div>
            {(profile?.role === "owner" || profile?.role === "editor") && (
              <button type="button" onClick={syncFromSheet} disabled={syncing}>
                {syncing ? "Syncing…" : "↓ Sync from Sheet"}
              </button>
            )}
          </div>
        </div>

        {syncMessage && <p className="sync-message muted small">{syncMessage}</p>}

        <div className="search-row">
          <div className="search-wrap">
            <input
              className="search"
              placeholder="Search by name, address, area, listing ID or link…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                type="button"
                className="search-clear"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                ×
              </button>
            )}
          </div>
        </div>

        <div className="filters">
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            {types.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            {statuses.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <select value={districtFilter} onChange={(e) => setDistrictFilter(e.target.value)}>
            {districts.map((d) => (
              <option key={d} value={d}>
                {d === "All" ? "All districts" : d}
              </option>
            ))}
          </select>
          <select value={bedsFilter} onChange={(e) => setBedsFilter(e.target.value)}>
            {bedsOptions.map((b) => (
              <option key={b} value={b}>
                {b === "All" ? "All beds" : `${b} bed`}
              </option>
            ))}
          </select>
          <div className="price-range">
            <input
              type="number"
              placeholder="Min $"
              value={minPrice}
              onChange={(e) => setMinPrice(e.target.value)}
            />
            <span>–</span>
            <input
              type="number"
              placeholder="Max $"
              value={maxPrice}
              onChange={(e) => setMaxPrice(e.target.value)}
            />
          </div>
        </div>

        {properties.length === 0 ? (
          <div className="empty-state">
            <p>No properties yet.</p>
            <p className="muted">Import your spreadsheet, or add your first property, to get started.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <p>Nothing matches that search.</p>
          </div>
        ) : (
          grouped.map((group) => (
            <section key={group.type} className="type-section">
              <div className="type-section-header">
                <h2>{group.type}</h2>
                <span className="muted small">{group.items.length}</span>
              </div>

              {viewMode === "grid" ? (
                <div className="grid">
                  {group.items.map((p) => (
                    <Link href={`/property/${p.id}`} key={p.id} className="prop-card">
                      <div className="prop-card-top">
                        <span className={`status status-${(p.property_status || "").toLowerCase()}`}>
                          {p.property_status || "—"}
                        </span>
                        <span className="media-count">{p.property_media?.[0]?.count || 0} media</span>
                      </div>
                      <h3>{p.property_name}</h3>
                      <p className="muted">{p.tag_list || "—"}</p>
                      <div className="prop-card-meta">
                        <span>{p.property_type || "—"}</span>
                        <span>{p.price_or_rent ? `S$ ${p.price_or_rent}` : "—"}</span>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="list-rows">
                  {group.items.map((p) => (
                    <Link href={`/property/${p.id}`} key={p.id} className="list-row">
                      <span className={`status status-${(p.property_status || "").toLowerCase()}`}>
                        {p.property_status || "—"}
                      </span>
                      <span className="list-row-name">{p.property_name}</span>
                      <span className="list-row-tag muted">{p.tag_list || "—"}</span>
                      <span className="list-row-price">{p.price_or_rent ? `S$ ${p.price_or_rent}` : "—"}</span>
                      <span className="list-row-media muted small">
                        {p.property_media?.[0]?.count || 0} media
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </section>
          ))
        )}
      </main>
    </div>
  );
}
