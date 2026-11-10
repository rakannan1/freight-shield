export type ParsedId = { kind: "dot" | "mc"; value: string } | null;

/**
 * Parse a pasted carrier identifier. "MC-123456" or "MC 123456" is a docket number;
 * "DOT 1234567" or a bare number is treated as a DOT number.
 */
export function parseIdentifier(raw: string): ParsedId {
  const s = raw.trim().toUpperCase();
  if (!s) return null;
  const mc = s.match(/^MC[\s#:-]*(\d{1,8})$/);
  if (mc) return { kind: "mc", value: String(Number(mc[1])) };
  const dot = s.match(/^(?:USDOT|DOT)?[\s#:-]*(\d{1,8})$/);
  if (dot) return { kind: "dot", value: String(Number(dot[1])) };
  return null;
}

/** Split pasted text (newlines, commas, semicolons) into identifiers, dropping duplicates. */
export function parseList(text: string): { ids: NonNullable<ParsedId>[]; invalid: string[] } {
  const seen = new Set<string>();
  const ids: NonNullable<ParsedId>[] = [];
  const invalid: string[] = [];
  for (const part of text.split(/[\n,;]+/)) {
    if (!part.trim()) continue;
    const p = parseIdentifier(part);
    if (!p) {
      invalid.push(part.trim());
      continue;
    }
    const key = `${p.kind}:${p.value}`;
    if (!seen.has(key)) {
      seen.add(key);
      ids.push(p);
    }
  }
  return { ids, invalid };
}
