import Link from "next/link";
import { supabase } from "../lib/supabaseClient";

export default function Navbar({ profile }) {
  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  const canEdit = profile?.role === "owner" || profile?.role === "editor";

  return (
    <nav className="navbar">
      <Link href="/" className="brand">
        Property Tracker
      </Link>
      <div className="nav-links">
        <Link href="/dashboard">Dashboard</Link>
        {canEdit && <Link href="/property/new">+ Add property</Link>}
        {canEdit && <Link href="/import">Import CSV</Link>}
        <span className={`role-pill role-${profile?.role}`}>{profile?.role}</span>
        <button onClick={signOut} className="link-btn">
          Sign out
        </button>
      </div>
    </nav>
  );
}
