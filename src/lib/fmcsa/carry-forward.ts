import type { CarrierSnapshot } from "./types";

/**
 * Fields that come from optional lookups (the authority endpoint, insurance filings) or that FMCSA sometimes
 * leaves out. When one of them is missing today but we knew it yesterday, we keep yesterday's value.
 *
 * Without this, a one-day outage of an optional lookup would store a snapshot with nothing in it, and a real
 * change made that day (authority revoked, say) could never be detected afterwards.
 */
const FIELDS = [
  "commonAuthority",
  "contractAuthority",
  "brokerAuthority",
  "bipdOnFile",
  "bipdRequired",
  "cargoOnFile",
  "cargoRequired",
  "policies",
  "powerUnits",
  "totalDrivers",
  "mcNumber",
] as const;

const missing = (v: unknown) => v === null || v === undefined;

export function carryForward(prev: CarrierSnapshot | null, curr: CarrierSnapshot): CarrierSnapshot {
  if (!prev) return curr;
  const next = { ...curr } as unknown as Record<string, unknown>;
  for (const f of FIELDS) {
    if (missing(curr[f]) && !missing(prev[f])) next[f] = prev[f];
  }
  return next as unknown as CarrierSnapshot;
}
