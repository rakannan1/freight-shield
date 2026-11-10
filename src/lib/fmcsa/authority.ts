import type { CarrierSnapshot } from "./types";

/* eslint-disable @typescript-eslint/no-explicit-any */

export interface AuthorityStatuses {
  common: string | null;
  contract: string | null;
  broker: string | null;
}

/** Upper-cased status code ("A", "I", "N"), or null when FMCSA gave nothing usable. */
export function cleanStatus(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toUpperCase();
  return s === "" ? null : s;
}

// A carrier can hold several dockets. If any docket has an active authority, the carrier has one.
const rank = (s: string) => (s === "A" ? 3 : s === "I" ? 2 : s === "N" ? 1 : 0);
const best = (values: (string | null)[]): string | null =>
  values.reduce<string | null>((b, v) => (v !== null && (b === null || rank(v) > rank(b)) ? v : b), null);

/**
 * Reads the QCMobile `/carriers/:dot/authority` response.
 * Observed shape: { content: [ { carrierAuthority: { commonAuthorityStatus, contractAuthorityStatus,
 * brokerAuthorityStatus, docketNumber, ... } } ] }, one entry per docket. A few other shapes are tolerated.
 * Returns null when no status is present at all, which callers treat as "unknown", never as "none".
 */
export function extractAuthority(body: any): AuthorityStatuses | null {
  const content = body?.content;
  const entries: any[] = Array.isArray(content) ? content : content ? [content] : [];
  const records = entries
    .map((e) => e?.carrierAuthority ?? (e?.authority && typeof e.authority === "object" ? e.authority : e))
    .filter((r) => r && typeof r === "object");

  const common = best(records.map((r) => cleanStatus(r.commonAuthorityStatus)));
  const contract = best(records.map((r) => cleanStatus(r.contractAuthorityStatus)));
  const broker = best(records.map((r) => cleanStatus(r.brokerAuthorityStatus)));
  if (common === null && contract === null && broker === null) return null;
  return { common, contract, broker };
}

/** The authority endpoint wins where it has a value. Carrier-level values fill any gaps. */
export function applyAuthority(snap: CarrierSnapshot, a: AuthorityStatuses | null): CarrierSnapshot {
  if (!a) return snap;
  return {
    ...snap,
    commonAuthority: a.common ?? snap.commonAuthority,
    contractAuthority: a.contract ?? snap.contractAuthority,
    brokerAuthority: a.broker ?? snap.brokerAuthority,
  };
}

/** Docket numbers like "MC123456" from the QCMobile `/carriers/:dot/docket-numbers` response. */
export function extractDockets(body: any): string[] {
  const content = body?.content;
  const entries: any[] = Array.isArray(content) ? content : content ? [content] : [];
  const out = new Set<string>();
  for (const e of entries) {
    const r = e?.docketNumber && typeof e.docketNumber === "object" ? e.docketNumber : e;
    const digits = String(r?.docketNumber ?? r?.docket_number ?? r?.mcNumber ?? "").replace(/\D/g, "");
    if (!digits) continue;
    const prefix = (cleanStatus(r?.prefix) ?? "MC").replace(/[^A-Z]/g, "") || "MC";
    out.add(`${prefix}${Number(digits)}`);
  }
  return [...out];
}
