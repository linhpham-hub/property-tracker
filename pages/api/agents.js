import { createServerSupabaseClient, requireUser } from "../../lib/supabaseServer";
import { readAgentProfiles } from "../../lib/googleSheets";

// Agent dashboard data, read live from the Agent_profile tab of the Google
// Sheet (no database copy — the tab is the source of truth and is updated
// by hand). Kept in memory for 10 minutes so flipping between pages doesn't
// re-read 10k+ rows each time; ?refresh=1 forces a fresh read.
let cache = { at: 0, payload: null };
const TTL_MS = 10 * 60 * 1000;

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const token = (req.headers.authorization || "").replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Missing auth token" });
  const supabase = createServerSupabaseClient(token);
  const user = await requireUser(req, res, supabase, token);
  if (!user) return;

  try {
    const fresh = req.query.refresh === "1";
    if (fresh || !cache.payload || Date.now() - cache.at > TTL_MS) {
      const { agents, dataAsOf } = await readAgentProfiles();
      // Compact rows (arrays, not objects) to keep the response small.
      cache = {
        at: Date.now(),
        payload: {
          dataAsOf,
          readAt: new Date().toISOString(),
          columns: ["name", "cea", "agency", "listings", "link", "phone", "assignedTo", "status", "notes"],
          rows: agents.map((a) => [a.name, a.cea, a.agency, a.listings, a.link, a.phone, a.assignedTo, a.status, a.notes]),
        },
      };
    }
    return res.status(200).json(cache.payload);
  } catch (e) {
    console.error("agents read failed:", e);
    return res.status(500).json({ error: "Could not read Agent_profile: " + e.message });
  }
}
