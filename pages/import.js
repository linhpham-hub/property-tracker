import { useState } from "react";
import { useRouter } from "next/router";
import Papa from "papaparse";
import { supabase } from "../lib/supabaseClient";
import { useProfile } from "../lib/useProfile";
import Navbar from "../components/Navbar";

// Recognized spreadsheet header names -> our database column names.
// Add more aliases here any time your spreadsheet uses a different header.
const HEADER_MAP = {
  no: "no",
  "no.": "no",
  property_name: "property_name",
  name: "property_name",
  address: "address",
  address_raw: "address",
  area: "area",
  district: "district",
  property_owner: "property_owner",
  owner: "property_owner",
  owner_number: "owner_number",
  property_link: "property_link",
  url: "property_link",
  "propertyguru_listing id": "listing_id",
  listing_id: "listing_id",
  id: "listing_id",
  property_type: "property_type",
  type: "property_type",
  property_status: "property_status",
  status: "property_status",
  price_or_rent: "price_or_rent",
  price: "price_or_rent",
  beds: "beds",
  baths: "baths",
  size_sqft: "size_sqft",
  sqft: "size_sqft",
  psf: "psf",
  tenure: "tenure",
  top: "top_year",
  top_year: "top_year",
  furnishing: "furnishing",
  nearest_mrt: "nearest_mrt",
  "tag list": "tag_list",
  tag_list: "tag_list",
  "welcome 1": "welcome_note_1",
  welcome_note_1: "welcome_note_1",
  "welcome 2": "welcome_note_2",
  welcome_note_2: "welcome_note_2",
  "welcome 3": "welcome_note_3",
  welcome_note_3: "welcome_note_3",
  "note 1": "notes",
  notes: "notes",
};

export default function Import() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [rows, setRows] = useState([]);
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);

  if (!loading && profile && profile.role === "viewer") {
    router.replace("/");
    return null;
  }

  function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const mapped = results.data
          .map((row) => {
            const out = {};
            Object.entries(row).forEach(([key, value]) => {
              const cleanKey = key.trim().toLowerCase();
              const target = HEADER_MAP[cleanKey];
              if (target && value) out[target] = String(value).trim();
            });
            return out;
          })
          .filter((r) => r.property_name);
        setRows(mapped);
      },
    });
  }

  async function handleImport() {
    setImporting(true);
    const { error, data } = await supabase.from("properties").insert(rows).select();
    setImporting(false);
    setResult(error ? { error: error.message } : { count: data.length });
  }

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <div>
      <Navbar profile={profile} />
      <main className="page narrow">
        <button className="back-link" onClick={() => router.push("/")}>
          &larr; All properties
        </button>
        <h1>Import from CSV</h1>
        <p className="muted">
          Upload your tracker spreadsheet (exported as CSV) or the scraper's output file.
          Columns are matched by name automatically — unrecognized columns are ignored,
          nothing is overwritten.
        </p>

        <input type="file" accept=".csv" onChange={handleFile} />
        {fileName && (
          <p className="muted small">
            {fileName} — {rows.length} rows recognized
          </p>
        )}

        {rows.length > 0 && (
          <>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th>Status</th>
                    <th>Price</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 10).map((r, i) => (
                    <tr key={i}>
                      <td>{r.property_name}</td>
                      <td>{r.property_type || "—"}</td>
                      <td>{r.property_status || "—"}</td>
                      <td>{r.price_or_rent || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 10 && <p className="muted small">…and {rows.length - 10} more</p>}
            </div>
            <button onClick={handleImport} disabled={importing}>
              {importing ? "Importing…" : `Import ${rows.length} properties`}
            </button>
          </>
        )}

        {result &&
          (result.error ? (
            <p className="error">Import failed: {result.error}</p>
          ) : (
            <p className="success">
              Imported {result.count} properties. <a href="/">View them</a>.
            </p>
          ))}
      </main>
    </div>
  );
}
