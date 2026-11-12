"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { browserClient } from "@/lib/supabase-browser";

type Mode = "login" | "signup" | "forgot";

const COPY: Record<Mode, { title: string; sub: string; cta: string }> = {
  login: { title: "Welcome back", sub: "Sign in to your FreightShield dashboard.", cta: "Sign in" },
  signup: { title: "Start your free trial", sub: "Create your account. It takes a minute.", cta: "Create account" },
  forgot: { title: "Reset your password", sub: "We'll email you a link to choose a new one.", cta: "Send reset link" },
};

export default function AuthForm({ initialMode, initialError = "" }: { initialMode: Mode; initialError?: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(initialError);
  const [notice, setNotice] = useState<{ title: string; body: string } | null>(null);

  const origin = () => window.location.origin;

  function switchMode(m: Mode) {
    setMode(m);
    setError("");
    setNotice(null);
    // Keep the address bar on the right page without a full reload.
    if (m !== "forgot") window.history.replaceState(null, "", m === "signup" ? "/signup" : "/login");
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const supabase = browserClient();
    const addr = email.trim();
    try {
      if (mode === "login") {
        const { error: err } = await supabase.auth.signInWithPassword({ email: addr, password });
        if (err) return setError(err.message);
        router.replace("/dashboard");
        router.refresh();
      } else if (mode === "signup") {
        if (password.length < 8) return setError("Use at least 8 characters for your password.");
        const { data, error: err } = await supabase.auth.signUp({
          email: addr,
          password,
          options: { emailRedirectTo: `${origin()}/auth/callback` },
        });
        if (err) return setError(err.message);
        if (data.session) {
          router.replace("/dashboard");
          router.refresh();
        } else {
          setNotice({ title: "Check your email", body: `We sent a confirmation link to ${addr}. Open it to finish creating your account.` });
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(addr, {
          redirectTo: `${origin()}/auth/callback?next=/reset-password`,
        });
        if (err) return setError(err.message);
        setNotice({ title: "Check your email", body: `If an account exists for ${addr}, a reset link is on its way.` });
      }
    } finally {
      setBusy(false);
    }
  }

  async function magicLink() {
    if (!email.trim()) return setError("Enter your email first.");
    setBusy(true);
    setError("");
    const { error: err } = await browserClient().auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${origin()}/auth/callback` },
    });
    setBusy(false);
    if (err) setError(err.message);
    else setNotice({ title: "Check your email", body: `We sent a sign-in link to ${email.trim()}.` });
  }

  if (notice) {
    return (
      <div className="stack-lg">
        <div className="mk-notice" role="status">
          <strong>{notice.title}</strong>
          <p>{notice.body}</p>
        </div>
        <button type="button" className="mk-textbtn" onClick={() => switchMode("login")}>
          Back to sign in
        </button>
      </div>
    );
  }

  const c = COPY[mode];
  return (
    <div className="stack-lg">
      <div>
        <h1 className="mk-auth-title">{c.title}</h1>
        <p className="muted">{c.sub}</p>
      </div>

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

        {mode !== "forgot" ? (
          <>
            <div className="mk-labelrow">
              <label htmlFor="password" className="label">
                Password
              </label>
              {mode === "login" ? (
                <button type="button" className="mk-textbtn" onClick={() => switchMode("forgot")}>
                  Forgot password?
                </button>
              ) : null}
            </div>
            <div className="mk-pw">
              <input
                id="password"
                type={show ? "text" : "password"}
                required
                minLength={mode === "signup" ? 8 : undefined}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
              />
              <button type="button" className="mk-show" onClick={() => setShow((s) => !s)} aria-pressed={show}>
                {show ? "Hide" : "Show"}
              </button>
            </div>
          </>
        ) : null}

        {error ? (
          <p role="alert" className="error">
            {error}
          </p>
        ) : null}

        <button type="submit" disabled={busy} className="btn primary mk-submit">
          {busy ? "One moment..." : c.cta}
        </button>
      </form>

      {mode !== "forgot" ? (
        <>
          <div className="mk-or">
            <span>or</span>
          </div>
          <button type="button" className="btn" disabled={busy} onClick={magicLink}>
            Email me a sign-in link
          </button>
        </>
      ) : null}

      <p className="muted small mk-switch">
        {mode === "login" ? (
          <>
            New to FreightShield?{" "}
            <button type="button" className="mk-textbtn" onClick={() => switchMode("signup")}>
              Start your free trial
            </button>
          </>
        ) : (
          <>
            {mode === "signup" ? "Already have an account? " : "Remembered it? "}
            <button type="button" className="mk-textbtn" onClick={() => switchMode("login")}>
              Sign in
            </button>
          </>
        )}
      </p>
    </div>
  );
}
