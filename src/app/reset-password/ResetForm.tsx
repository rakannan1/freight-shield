"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

export default function ResetForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return setError("Use at least 8 characters for your password.");
    setBusy(true);
    setError("");
    const { error: err } = await browserClient().auth.updateUser({ password });
    setBusy(false);
    if (err) {
      setError(
        /session/i.test(err.message)
          ? "This reset link has expired or was already used. Request a new one from the sign-in page."
          : err.message,
      );
      return;
    }
    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <div className="stack-lg">
      <div>
        <h1 className="mk-auth-title">Choose a new password</h1>
        <p className="muted">Pick something you don&apos;t use anywhere else.</p>
      </div>
      <form onSubmit={onSubmit} className="stack">
        <label htmlFor="password" className="label">
          New password
        </label>
        <div className="mk-pw">
          <input
            id="password"
            type={show ? "text" : "password"}
            required
            minLength={8}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input"
            placeholder="At least 8 characters"
          />
          <button type="button" className="mk-show" onClick={() => setShow((s) => !s)} aria-pressed={show}>
            {show ? "Hide" : "Show"}
          </button>
        </div>
        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={busy} className="btn primary mk-submit">
          {busy ? "Saving..." : "Save password"}
        </button>
      </form>
      <a href="/login" className="small">
        Back to sign in
      </a>
    </div>
  );
}
