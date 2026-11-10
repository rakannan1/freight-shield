"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { parseList } from "@/lib/identifiers";
import { chunk, extractIdentifiers, parseCsv } from "@/lib/import-parse";

/** Carriers per request. Keeps each request well inside the server's time limit. */
const BATCH = 20;
const MAX_TOTAL = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

interface Risk {
  severity: string;
  title: string;
  detail: string;
}

interface Result {
  added: { dotNumber: string; legalName: string; risks?: Risk[] }[];
  notFound: string[];
  invalid: string[];
  failed: { input: string; message: string }[];
}

const emptyResult = (): Result => ({ added: [], notFound: [], invalid: [], failed: [] });

/** "a, b, c and 92 more", so a large upload doesn't print hundreds of names. */
const short = (items: string[], max = 8) =>
  items.length <= max ? items.join(", ") : `${items.slice(0, max).join(", ")} and ${items.length - max} more`;

export default function AddCarriers({ locked }: { locked: boolean }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [result, setResult] = useState<Result | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // lets the same file be chosen again
    if (!file) return;
    setError("");
    setNote("");
    setResult(null);

    const name = file.name.toLowerCase();
    if (file.size > MAX_FILE_BYTES) return setError("That file is over 2 MB. Remove extra columns or split it.");
    if (name.endsWith(".xls")) {
      return setError("Old .xls files aren't supported. In Excel, choose Save As, then .xlsx or CSV.");
    }
    if (!/\.(xlsx|csv|txt)$/.test(name)) return setError("Use an Excel (.xlsx) or CSV file.");

    try {
      let rows: unknown[][];
      if (name.endsWith(".xlsx")) {
        const { readSheet } = await import("read-excel-file/browser");
        rows = await readSheet(file); // first sheet
      } else {
        rows = parseCsv(await file.text());
      }

      const found = extractIdentifiers(rows);
      if (!found.lines.length) {
        return setError("No MC or DOT numbers found. Put them in a column headed MC or DOT.");
      }
      const unique = parseList(found.lines.join("\n")).ids.length;
      setText((prev) => [prev.trim(), found.lines.join("\n")].filter(Boolean).join("\n"));
      setNote(
        `Loaded ${unique} carrier${unique === 1 ? "" : "s"} from ${file.name}` +
          (found.skipped ? `, skipped ${found.skipped} row${found.skipped === 1 ? "" : "s"} with no readable number` : "") +
          ". Review the list, then click Add.",
      );
    } catch {
      setError("Couldn't read that file. Check that it's a valid .xlsx or CSV.");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const { ids, invalid } = parseList(text);
    setError("");
    setNote("");
    setResult(null);

    if (ids.length === 0) {
      if (invalid.length) setResult({ ...emptyResult(), invalid });
      return;
    }
    if (ids.length > MAX_TOTAL) {
      return setError(`Up to ${MAX_TOTAL} carriers at a time. Split the list and add it in parts.`);
    }

    const lines = ids.map((i) => (i.kind === "mc" ? `MC-${i.value}` : `DOT ${i.value}`));
    const batches = chunk(lines, BATCH);
    const total: Result = { ...emptyResult(), invalid };
    let completed = 0;
    let stopped = false;

    setBusy(true);
    try {
      for (const batch of batches) {
        setProgress({ done: completed * BATCH, total: lines.length });
        const res = await fetch("/api/carriers", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: batch.join("\n") }),
        });
        const body = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(body.error ?? "Something went wrong. Try again.");
          stopped = true;
          break;
        }
        const r = body as Result;
        total.added.push(...r.added);
        total.notFound.push(...r.notFound);
        total.invalid.push(...r.invalid);
        total.failed.push(...r.failed);
        completed++;
      }
    } catch {
      setError("Network error. Try again.");
      stopped = true;
    } finally {
      setBusy(false);
      setProgress(null);
    }

    // On a stop, keep only what wasn't processed so a retry doesn't repeat finished work.
    setText(stopped ? lines.slice(completed * BATCH).join("\n") : "");
    setResult(total);
    router.refresh();
  }

  const count = parseList(text).ids.length;
  const flagged = (result?.added ?? []).filter((a) => (a.risks?.length ?? 0) > 0);

  return (
    <form onSubmit={onSubmit} className="stack">
      <label htmlFor="carriers" className="label">
        MC or DOT numbers, one per line or separated by commas
      </label>
      <textarea
        id="carriers"
        rows={5}
        className="input mono"
        placeholder={"MC-123456\nDOT 1234567"}
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={locked || busy}
      />

      <div className="stack" style={{ gap: 6 }}>
        <label htmlFor="carrier-file" className="label">
          Or upload a spreadsheet
        </label>
        <input
          id="carrier-file"
          type="file"
          accept=".xlsx,.csv,.txt"
          className="input"
          onChange={onFile}
          disabled={locked || busy}
        />
        <p className="small muted">
          Excel (.xlsx) or CSV, with MC or DOT numbers in columns headed MC or DOT. The file is read in your browser; only
          the numbers are sent.{" "}
          <a href="/carrier-template.csv" download>
            Download a CSV template
          </a>
          .
        </p>
      </div>

      <div className="row">
        <button type="submit" className="btn primary" disabled={busy || locked || !text.trim()}>
          {busy
            ? progress
              ? `Adding ${progress.done} of ${progress.total}...`
              : "Adding..."
            : count > 1
              ? `Add ${count} carriers`
              : "Add to watchlist"}
        </button>
        {locked ? <span className="muted">Start your subscription to add carriers.</span> : null}
      </div>

      {note ? (
        <p role="status" className="small">
          {note}
        </p>
      ) : null}
      {error ? (
        <p role="alert" className="error">
          {error}
        </p>
      ) : null}

      {result ? (
        <div role="status" className="result">
          {result.added.length ? (
            <p>
              Added {result.added.length}: {short(result.added.map((a) => a.legalName || `DOT ${a.dotNumber}`))}
            </p>
          ) : null}
          {flagged.length ? (
            <div className="risk-block">
              <p className="strong">Review before tendering loads ({flagged.length}):</p>
              <ul className="risk-list">
                {flagged.map((a) => (
                  <li key={a.dotNumber}>
                    <span className="strong">{a.legalName || `DOT ${a.dotNumber}`}</span>
                    <ul className="risk-items">
                      {(a.risks ?? []).map((r, i) => (
                        <li key={i}>
                          <span className={`chip ${r.severity === "critical" ? "critical" : r.severity === "warning" ? "warning" : "info"}`}>
                            {r.severity === "critical" ? "Critical" : r.severity === "warning" ? "Warning" : "Note"}
                          </span>{" "}
                          {r.detail}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {result.added.length - flagged.length > 0 ? (
            <p className="muted">
              {result.added.length - flagged.length} added with no issues found in today&apos;s FMCSA record. This is a
              snapshot, not a guarantee.
            </p>
          ) : null}
          {result.notFound.length ? (
            <p>
              Not found at FMCSA ({result.notFound.length}): {short(result.notFound)}
            </p>
          ) : null}
          {result.invalid.length ? (
            <p>
              Couldn&apos;t read ({result.invalid.length}): {short(result.invalid)}
            </p>
          ) : null}
          {result.failed.length ? (
            <p>
              Failed to add ({result.failed.length}): {short(result.failed.map((f) => `${f.input} (${f.message})`))}
            </p>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}
