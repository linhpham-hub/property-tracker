import { createServerSupabaseClient, requireEditor } from "../../../lib/supabaseServer";
import { appendSheetRow } from "../../../lib/googleSheets";

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

  try {
    await appendSheetRow(property);
  } catch (e) {
    return res.status(500).json({ error: "Could not append to the sheet: " + e.message });
  }

  return res.status(200).json({ success: true });
}
