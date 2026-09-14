import { useState } from "react";
import { supabase } from "../lib/supabaseClient";

export default function Login() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(e) {
    e.preventDefault();
    setError("");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: typeof window !== "undefined" ? window.location.origin : undefined,
      },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <h1>Property Tracker</h1>
        <p className="subtitle">Sign in with your email — no password needed.</p>

        {sent ? (
          <p className="success">Check your inbox for a sign-in link, then come back here.</p>
        ) : (
          <form onSubmit={handleLogin}>
            <input
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button type="submit">Send sign-in link</button>
          </form>
        )}

        {error && <p className="error">{error}</p>}
        <p className="muted small">
          New here? The same box signs you up automatically — you'll start as a viewer until
          the owner upgrades your access.
        </p>
      </div>
    </div>
  );
}
