import { createServerSupabaseClient, requireEditor } from "../../../lib/supabaseServer";
import { readSheetRows, updateSheetRowCells } from "../../../lib/googleSheets";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const { propertyId } = req.body || {};
  if (!propertyId) return res.status(400).json({ error: "Missing propertyId" });

  const supabase = createServerSupabaseClient(token);
  const auth = await requireEditor(req, res, supabase, token);
  if (!auth) return;

  const { data: property, error: propErr } = await supabase
    .from("properties")
    .select("*")
    .eq("id", propertyId)
    .single();

  if (propErr || !property) return res.status(404).json({ error: "Property not found" });

  let rows;
  try {
    rows = await readSheetRows();
  } catch (e) {
    return res.status(500).json({ error: "Could not read the Google Sheet: " + e.message });
  }

  let match = null;
  if (property.listing_id) {
    match = rows.find((r) => r.listing_id === property.listing_id);
  }
  if (!match) {
    match = rows.find((r) => r.property_name === property.property_name);
  }

  if (!match) {
    return res.status(404).json({
      error:
        "No matching row found in the sheet for this property (checked Listing ID and name). Try 'Sync from Sheet' first if this property was created in the app.",
    });
  }

  try {
    await updateSheetRowCells(match.rowNumber, {
      tag_list: property.tag_list,
      welcome_note_1: property.welcome_note_1,
      welcome_note_2: property.welcome_note_2,
      welcome_note_3: property.welcome_note_3,
      notes: property.notes,
    });
  } catch (e) {
    return res.status(500).json({ error: "Could not write to the sheet: " + e.message });
  }

  return res.status(200).json({ success: true, row: match.rowNumber });
}
