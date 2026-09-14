import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import { supabase } from "../../lib/supabaseClient";
import { useProfile } from "../../lib/useProfile";
import Navbar from "../../components/Navbar";

const FIELDS = [
  ["address", "Address"],
  ["area", "Area"],
  ["district", "District"],
  ["property_owner", "Owner name"],
  ["owner_number", "Owner number"],
  ["property_type", "Property type"],
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

// Common statuses shown in the quick-change dropdown. If a property has a
// status outside this list (e.g. imported from your sheet), it's kept as
// an extra option so nothing gets silently changed on load.
const STATUS_OPTIONS = ["Active", "Expired", "Sold", "Rented", "Pending", "Withdrawn"];

export default function PropertyDetail() {
  const router = useRouter();
  const { id } = router.query;
  const { profile, loading } = useProfile();
  const [property, setProperty] = useState(null);
  const [media, setMedia] = useState([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [noteDraft, setNoteDraft] = useState("");
  const [welcomeDrafts, setWelcomeDrafts] = useState(["", "", ""]);
  const [welcomeCount, setWelcomeCount] = useState(1);
  const [uploading, setUploading] = useState(false);
  const [editingKey, setEditingKey] = useState(null);
  const [fieldDraft, setFieldDraft] = useState("");
  const [statusSaving, setStatusSaving] = useState(false);
  const [sheetSyncing, setSheetSyncing] = useState(false);
  const [sheetSyncMessage, setSheetSyncMessage] = useState("");

  async function syncToSheet() {
    setSheetSyncing(true);
    setSheetSyncMessage("");
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/sheets/push", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ propertyId: id }),
      });
      const result = await res.json();
      setSheetSyncMessage(res.ok ? "Synced to sheet ✓" : `Failed: ${result.error}`);
    } catch (e) {
      setSheetSyncMessage("Failed — check your connection and try again.");
    }
    setSheetSyncing(false);
  }

  const canEdit = profile?.role === "owner" || profile?.role === "editor";
  const canDelete = profile?.role === "owner";

  useEffect(() => {
    if (!id) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function load() {
    const { data: prop } = await supabase.from("properties").select("*").eq("id", id).single();
    const { data: med } = await supabase
      .from("property_media")
      .select("*")
      .eq("property_id", id)
      .order("uploaded_at", { ascending: false });
    setProperty(prop);
    setForm(prop || {});
    setNoteDraft(prop?.notes || "");
    const drafts = [
      prop?.welcome_note_1 || "",
      prop?.welcome_note_2 || "",
      prop?.welcome_note_3 || "",
    ];
    setWelcomeDrafts(drafts);
    let lastFilled = 0;
    drafts.forEach((d, i) => {
      if (d) lastFilled = i + 1;
    });
    setWelcomeCount(Math.max(1, lastFilled));
    setMedia(med || []);
  }

  async function saveFields() {
    const { error } = await supabase.from("properties").update(form).eq("id", id);
    if (!error) {
      setEditing(false);
      load();
    }
  }

  function startFieldEdit(key) {
    setEditingKey(key);
    setFieldDraft(property[key] || "");
  }

  function cancelFieldEdit() {
    setEditingKey(null);
  }

  async function saveField(key) {
    const { error } = await supabase.from("properties").update({ [key]: fieldDraft }).eq("id", id);
    if (!error) {
      setEditingKey(null);
      load();
    }
  }

  async function changeStatus(newStatus) {
    setStatusSaving(true);
    const { error } = await supabase
      .from("properties")
      .update({ property_status: newStatus })
      .eq("id", id);
    setStatusSaving(false);
    if (!error) load();
  }

  async function saveNote() {
    const { error } = await supabase
      .from("properties")
      .update({ notes: noteDraft, notes_updated_at: new Date().toISOString() })
      .eq("id", id);
    if (!error) load();
  }

  async function saveWelcomeNotes() {
    const { error } = await supabase
      .from("properties")
      .update({
        welcome_note_1: welcomeDrafts[0] || null,
        welcome_note_2: welcomeDrafts[1] || null,
        welcome_note_3: welcomeDrafts[2] || null,
      })
      .eq("id", id);
    if (!error) load();
  }

  function updateWelcomeDraft(index, value) {
    setWelcomeDrafts((prev) => {
      const next = [...prev];
      next[index] = value;
      return next;
    });
  }

  async function copyToClipboard(text) {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
    } catch (e) {
      // Clipboard API can fail on non-HTTPS/localhost edge cases — silently ignore
    }
  }

  async function handleUpload(e, type) {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    const path = `${id}/${Date.now()}-${file.name}`;
    const { error: upErr } = await supabase.storage.from("property-media").upload(path, file);
    if (!upErr) {
      const { data: pub } = supabase.storage.from("property-media").getPublicUrl(path);
      await supabase.from("property_media").insert({
        property_id: id,
        media_type: type,
        url: pub.publicUrl,
      });
      load();
    }
    setUploading(false);
  }

  async function deleteMedia(mediaId) {
    await supabase.from("property_media").delete().eq("id", mediaId);
    load();
  }

  async function deleteProperty() {
    if (!confirm("Delete this property permanently? This cannot be undone.")) return;
    await supabase.from("properties").delete().eq("id", id);
    router.push("/");
  }

  if (loading || !property) return <div className="loading-screen">Loading…</div>;

  const photos = media.filter((m) => m.media_type === "photo");
  const videos = media.filter((m) => m.media_type === "video");
  const statusOptions = STATUS_OPTIONS.includes(property.property_status)
    ? STATUS_OPTIONS
    : [property.property_status || "Active", ...STATUS_OPTIONS];

  return (
    <div>
      <Navbar profile={profile} />
      <main className="page narrow">
        <button className="back-link" onClick={() => router.push("/")}>
          &larr; All properties
        </button>

        <div className="detail-header">
          <h1>{property.property_name}</h1>
          <div className="detail-actions">
            {canEdit && !editing && <button onClick={() => setEditing(true)}>Edit all details</button>}
            {canEdit && editing && <button onClick={saveFields}>Save changes</button>}
            {canDelete && (
              <button className="danger" onClick={deleteProperty}>
                Delete
              </button>
            )}
          </div>
        </div>

        <div className="status-hero">
          <span className="status-hero-label">Status</span>
          {canEdit ? (
            <select
              className={`status-hero-select status-${(property.property_status || "").toLowerCase()}`}
              value={property.property_status || ""}
              onChange={(e) => changeStatus(e.target.value)}
              disabled={statusSaving}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          ) : (
            <span className={`status-hero-badge status-${(property.property_status || "").toLowerCase()}`}>
              {property.property_status || "—"}
            </span>
          )}
        </div>

        <section className="field-grid">
          {FIELDS.map(([key, label]) => (
            <div key={key} className="field">
              <label>{label}</label>
              {editing ? (
                <input value={form[key] || ""} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
              ) : editingKey === key ? (
                <div className="field-inline-edit">
                  <input
                    value={fieldDraft}
                    onChange={(e) => setFieldDraft(e.target.value)}
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveField(key);
                      if (e.key === "Escape") cancelFieldEdit();
                    }}
                  />
                  <div className="field-inline-actions">
                    <button onClick={() => saveField(key)}>Save</button>
                    <button className="link-btn" onClick={cancelFieldEdit}>
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="field-view-row">
                  <p>{property[key] || "—"}</p>
                  {canEdit && (
                    <button
                      type="button"
                      className="field-edit-icon"
                      onClick={() => startFieldEdit(key)}
                      aria-label={`Edit ${label}`}
                      title={`Edit ${label}`}
                    >
                      ✎
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </section>

        <section className="notes-section">
          <div className="section-header">
            <h2>Notes</h2>
            {property.notes_updated_at && (
              <span className="muted small">
                Last updated {new Date(property.notes_updated_at).toLocaleString()}
              </span>
            )}
          </div>
          <textarea
            rows={5}
            placeholder="Add a note about this property — viewing feedback, negotiation status, follow-ups…"
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            disabled={!canEdit}
          />
          {canEdit && <button onClick={saveNote}>Save note</button>}
        </section>

        <section className="notes-section">
          <div className="section-header">
            <h2>Welcome notes</h2>
            <span className="muted small">Up to 3 — ready to copy and send</span>
          </div>
          {Array.from({ length: welcomeCount }).map((_, i) => (
            <div key={i} className="welcome-note-box">
              <div className="welcome-note-label">
                <label>Welcome note {i + 1}</label>
                {welcomeDrafts[i] && (
                  <button
                    type="button"
                    className="copy-btn"
                    onClick={() => copyToClipboard(welcomeDrafts[i])}
                  >
                    Copy
                  </button>
                )}
              </div>
              <textarea
                rows={4}
                placeholder={`Welcome message variant ${i + 1}…`}
                value={welcomeDrafts[i]}
                onChange={(e) => updateWelcomeDraft(i, e.target.value)}
                disabled={!canEdit}
              />
            </div>
          ))}
          {canEdit && (
            <div className="welcome-note-actions">
              {welcomeCount < 3 && (
                <button
                  type="button"
                  className="link-btn-outline"
                  onClick={() => setWelcomeCount((c) => Math.min(3, c + 1))}
                >
                  + Add another welcome note
                </button>
              )}
              <button onClick={saveWelcomeNotes}>Save welcome notes</button>
            </div>
          )}
          {canEdit && (
            <div className="sheet-sync-row">
              <button type="button" onClick={syncToSheet} disabled={sheetSyncing}>
                {sheetSyncing ? "Syncing…" : "↑ Sync Tag list & Notes to Sheet"}
              </button>
              {sheetSyncMessage && <span className="muted small">{sheetSyncMessage}</span>}
            </div>
          )}
        </section>

        <section className="media-section">
          <div className="section-header">
            <h2>Photos</h2>
            {canEdit && (
              <label className="upload-btn">
                {uploading ? "Uploading…" : "+ Add photo"}
                <input type="file" accept="image/*" hidden onChange={(e) => handleUpload(e, "photo")} />
              </label>
            )}
          </div>
          {photos.length === 0 ? (
            <p className="muted">No photos yet.</p>
          ) : (
            <div className="media-grid">
              {photos.map((m) => (
                <div key={m.id} className="media-item">
                  <img src={m.url} alt="" />
                  {canEdit && (
                    <button className="remove-btn" onClick={() => deleteMedia(m.id)}>
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="media-section">
          <div className="section-header">
            <h2>Videos</h2>
            {canEdit && (
              <label className="upload-btn">
                {uploading ? "Uploading…" : "+ Add video"}
                <input type="file" accept="video/*" hidden onChange={(e) => handleUpload(e, "video")} />
              </label>
            )}
          </div>
          {videos.length === 0 ? (
            <p className="muted">No videos yet.</p>
          ) : (
            <div className="media-grid">
              {videos.map((m) => (
                <div key={m.id} className="media-item">
                  <video src={m.url} controls />
                  {canEdit && (
                    <button className="remove-btn" onClick={() => deleteMedia(m.id)}>
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
