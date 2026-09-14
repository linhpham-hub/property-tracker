import { createClient } from "@supabase/supabase-js";

// Used only inside pages/api routes. Runs every query as the signed-in user
// (via their access token), so the same owner/editor/viewer permissions
// that apply in the browser apply here too — nothing bypasses RLS.
export function createServerSupabaseClient(accessToken) {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}

// Confirms the request carries a valid session belonging to an owner or
// editor. Returns { user, profile } on success, or sends a 401/403 and
// returns null — callers should check for null and stop.
export async function requireEditor(req, res, supabase, accessToken) {
  const {
    data: { user },
  } = await supabase.auth.getUser(accessToken);

  if (!user) {
    res.status(401).json({ error: "Invalid or expired session — please sign in again." });
    return null;
  }

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();

  if (!profile || !["owner", "editor"].includes(profile.role)) {
    res.status(403).json({ error: "Only owners and editors can do this." });
    return null;
  }

  return { user, profile };
}
