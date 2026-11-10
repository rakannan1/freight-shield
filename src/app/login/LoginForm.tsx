"use client";

import { useState } from "react";
import { browserClient } from "@/lib/supabase-browser";

export default function LoginForm({ initialError }: { initialError: string }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(initialError);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const { error: err } = await browserClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setSent(true);
  }

  if (sent) {
    return (
      <div className="card" role="status">
        <strong>Check your email.</strong>
        <p className="muted" style={{ margin: "6px 0 0" }}>
          We sent a sign-in link to {email.trim()}. It can take a minute to arrive.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label htmlFor="email" className="label">
        Work email
      </label>
      <input
        id="email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="input"
        placeholder="you@brokerage.com"
      />
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}
      <button type="submit" disabled={busy} className="btn primary">
        {busy ? "Sending..." : "Email me a sign-in link"}
      </button>
    </form>
  );
}
