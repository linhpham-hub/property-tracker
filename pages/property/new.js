import { useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useProfile } from "../../lib/useProfile";
import Navbar from "../../components/Navbar";

const FIELDS = [
  ["property_name", "Property name", true],
  ["address", "Address"],
  ["area", "Area"],
  ["district", "District"],
  ["property_owner", "Owner name"],
  ["owner_number", "Owner number"],
  ["property_type", "Property type"],
  ["property_status", "Status"],
  ["price_or_rent", "Price / rent"],
  ["beds", "Beds"],
  ["baths", "Baths"],
  ["size_sqft", "Size (sqft)"],
  ["psf", "PSF"],
  ["tenure", "Tenure"],
  ["top_year", "TOP"],
  ["furnishing", "Furnishing"],
  ["nearest_mrt", "Nearest MRT"],
  ["listing_id", "Listing ID"],
  ["property_link", "Listing link"],
  ["tag_list", "Tag list"],
];

export default function NewProperty() {
  const router = useRouter();
  const { profile, loading } = useProfile();
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);

  if (!loading && profile && profile.role === "viewer") {
    router.replace("/");
    return null;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    const { data, error } = await supabase.from("properties").insert(form).select().single();
    setSaving(false);
    if (!error) {
      // Best-effort: add this property to the Google Sheet too. If it fails
      // (e.g. Sheets sync isn't set up), the property is still saved in the
      // app — this just means it won't show up in the sheet automatically.
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        await fetch("/api/sheets/append", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ propertyId: data.id }),
        });
      } catch (e) {
        // Sheet sync not configured or failed — ignore, property is already saved
      }
      router.push(`/property/${data.id}`);
    }
  }

  if (loading) return <div className="loading-screen">Loading…</div>;

  return (
    <div>
      <Navbar profile={profile} />
      <main className="page narrow">
        <button className="back-link" onClick={() => router.push("/")}>
          &larr; All properties
        </button>
        <h1>Add a property</h1>
        <form onSubmit={handleSubmit} className="field-grid">
          {FIELDS.map(([key, label, required]) => (
            <div key={key} className="field">
              <label>
                {label}
                {required && " *"}
              </label>
              <input
                required={required}
                value={form[key] || ""}
                onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              />
            </div>
          ))}
          <button type="submit" disabled={saving} className="submit-btn">
            {saving ? "Saving…" : "Save property"}
          </button>
        </form>
      </main>
    </div>
  );
}
