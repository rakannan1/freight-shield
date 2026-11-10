import { parseIdentifier } from "@/lib/identifiers";

/** Parses CSV text into rows of strings. Handles quotes, escaped quotes, embedded commas and newlines, CRLF and a BOM. */
export function parseCsv(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      quoted = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const cellText = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "";
  if (typeof v === "string") return v.trim();
  return ""; // booleans and dates are never carrier identifiers
};

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const isDotHeader = (s: string) => /^(usdot|dot)(number|no|num|nbr|id)?$/.test(squash(s));
const isMcHeader = (s: string) => /^(mc|mcnumber|mcno|mcnum|mcnbr|docket|docketnumber|docketno)$/.test(squash(s));

export interface ExtractResult {
  /** Normalized identifiers, one per carrier row, like "MC-123456" or "DOT 1234567". May contain duplicates. */
  lines: string[];
  /** Rows that had content but no readable MC or DOT number. */
  skipped: number;
  /** True when a header row with MC or DOT columns was found. */
  usedHeader: boolean;
}

const formatId = (p: { kind: "dot" | "mc"; value: string }) => (p.kind === "mc" ? `MC-${p.value}` : `DOT ${p.value}`);

/**
 * Finds MC and DOT numbers in spreadsheet rows.
 *
 * With a header row naming an MC or DOT column, a bare number in that column is read as that kind.
 * Without a header, a one-column sheet is a plain list (bare numbers are DOT numbers). A sheet with several
 * columns only yields values that carry an explicit "MC" or "DOT" prefix, never bare numbers.
 * If a row has both an MC and a DOT number, the DOT number wins because it identifies the carrier directly.
 */
export function extractIdentifiers(rawRows: unknown[][]): ExtractResult {
  const rows = rawRows
    .map((r) => r.map(cellText))
    .filter((r) => r.some((c) => c !== ""));

  const headerAt = rows.slice(0, 5).findIndex((r) => r.some((c) => isDotHeader(c) || isMcHeader(c)));

  if (headerAt >= 0) {
    const head = rows[headerAt];
    const dotCols = head.flatMap((c, i) => (isDotHeader(c) ? [i] : []));
    const mcCols = head.flatMap((c, i) => (isMcHeader(c) ? [i] : []));
    const lines: string[] = [];
    let skipped = 0;

    for (const r of rows.slice(headerAt + 1)) {
      const first = (cols: number[]) => cols.map((i) => r[i] ?? "").find((v) => v !== "") ?? "";
      const dotV = first(dotCols);
      const mcV = first(mcCols);
      const dot = dotV ? parseIdentifier(dotV) : null;
      const mc = mcV ? parseIdentifier(/^\d+$/.test(mcV) ? `MC-${mcV}` : mcV) : null;
      const pick = dot ?? mc;
      if (pick) lines.push(formatId(pick));
      else skipped++;
    }
    return { lines, skipped, usedHeader: true };
  }

  const width = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const filledCols = Array.from({ length: width }, (_, c) => c).filter((c) => rows.some((r) => r[c]));
  const lines: string[] = [];
  let skipped = 0;

  if (filledCols.length <= 1) {
    // A plain one-column list: bare numbers are DOT numbers.
    const col = filledCols[0] ?? 0;
    for (const r of rows) {
      const p = r[col] ? parseIdentifier(r[col]) : null;
      if (p) lines.push(formatId(p));
      else skipped++;
    }
  } else {
    // Several columns and no MC or DOT header. A bare number here could be a zip code, a quantity or part of a
    // phone number, and guessing would add unrelated real carriers, so only values with an explicit prefix count.
    for (const r of rows) {
      const hit = r.map((c) => (c && /[a-z]/i.test(c) ? parseIdentifier(c) : null)).find((p) => p !== null) ?? null;
      if (hit) lines.push(formatId(hit));
      else skipped++;
    }
  }
  return { lines, skipped, usedHeader: false };
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
