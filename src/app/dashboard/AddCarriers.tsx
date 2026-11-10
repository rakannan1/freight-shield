"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface Result {
  added: { dotNumber: string; legalName: string }[];
  notFound: string[];
  invalid: string[];
  failed: { input: string; message: string }[];
}

export default function AddCarriers({ locked }: { locked: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch("/api/carriers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(body.error ?? "Something went wrong. Try again.");
      } else {
        setResult(body as Result);
        if ((body as Result).added.length) setText("");
        router.refresh();
      }
    } catch {
      setError("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label htmlFor="carriers" className="label">
        MC or DOT numbers, one per line or separated by commas
      </label>
      <textarea
        id="carriers"
        rows={4}
        className="input mono"
        placeholder={"MC-123456\nDOT 1234567"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked}
      />
      <div className="row">
        <button type="submit" className="btn primary" disabled={busy || locked || !text.trim()}>
          {busy ? "Adding..." : "Add to watchlist"}
        </button>
        {locked ? <span className="muted">Start your subscription to add carriers.</span> : null}
      </div>

      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}

      {result ? (
        <div role="status" className="result">
          {result.added.length ? (
            <p>
              Added {result.added.length}: {result.added.map((a) => a.legalName || `DOT ${a.dotNumber}`).join(", ")}
            </p>
          ) : null}
          {result.notFound.length ? <p>Not found at FMCSA: {result.notFound.join(", ")}</p> : null}
          {result.invalid.length ? <p>Couldn&apos;t read: {result.invalid.join(", ")}</p> : null}
          {result.failed.length ? (
            <p>Failed to add: {result.failed.map((f) => `${f.input} (${f.message})`).join(", ")}</p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
