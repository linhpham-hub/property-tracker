import { createServerSupabaseClient, requireEditor } from "../../../lib/supabaseServer";
import { syncLeadsFromSheet } from "../../../lib/leadsSync";

// Manual "Refresh data" button on the dashboard. Owner/editor only — same
// gate as the Property_master sync routes.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  const supabase = createServerSupabaseClient(token);
  const auth = await requireEditor(req, res, supabase, token);
  if (!auth) return;

  try {
    const result = await syncLeadsFromSheet(supabase);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: "Could not sync leads: " + e.message });
  }
}
