import { createClient } from "@supabase/supabase-js";
import { syncLeadsFromSheet } from "../../../lib/leadsSync";

// Called once a day by Vercel Cron (see vercel.json). There's no signed-in
// user for a cron trigger, so this route checks the CRON_SECRET Vercel
// sends automatically, and writes with the Supabase SERVICE ROLE key
// (bypasses RLS). Keep SUPABASE_SERVICE_ROLE_KEY server-side only — never
// expose it with the NEXT_PUBLIC_ prefix.
export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return res.status(500).json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY environment variable." });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceKey);

  try {
    const result = await syncLeadsFromSheet(supabase);
    return res.status(200).json(result);
  } catch (e) {
    return res.status(500).json({ error: "Could not sync leads: " + e.message });
  }
}
