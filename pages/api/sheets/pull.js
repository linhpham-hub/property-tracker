import { createServerSupabaseClient, requireEditor } from "../../../lib/supabaseServer";
import { readSheetRows } from "../../../lib/googleSheets";

// Only these fields are ever written by a pull — Tag list, Welcome notes,
// and Notes are app-owned and are never touched here, even if the sheet
// has different values in those columns.
function coreFieldsFrom(row) {
  return {
    property_name: row.property_name,
    address: row.address,
    area: row.area,
    property_owner: row.property_owner,
    owner_number: row.owner_number,
    property_link: row.property_link,
    listing_id: row.listing_id,
    property_type: row.property_type,
    property_status: row.property_status,
  };
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const supabase = createServerSupabaseClient(token);
  const auth = await requireEditor(req, res, supabase, token);
  if (!auth) return; // response already sent

  let rows;
  try {
    rows = await readSheetRows();
  } catch (e) {
    return res.status(500).json({ error: "Could not read the Google Sheet: " + e.message });
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    let existingId = null;

    if (row.listing_id) {
      const { data } = await supabase
        .from("properties")
        .select("id")
        .eq("listing_id", row.listing_id)
        .limit(1);
      if (data && data.length) existingId = data[0].id;
    }
    if (!existingId) {
      const { data } = await supabase
        .from("properties")
        .select("id")
        .eq("property_name", row.property_name)
        .limit(1);
      if (data && data.length) existingId = data[0].id;
    }

    const fields = coreFieldsFrom(row);

    if (existingId) {
      const { error } = await supabase.from("properties").update(fields).eq("id", existingId);
      if (error) skipped++;
      else updated++;
    } else {
      const { error } = await supabase.from("properties").insert(fields);
      // A unique-constraint violation here means a matching property_name
      // already exists but wasn't caught above (e.g. race condition) —
      // treat as skipped rather than erroring the whole sync.
      if (error) skipped++;
      else created++;
    }
  }

  return res.status(200).json({ created, updated, skipped, total: rows.length });
}
