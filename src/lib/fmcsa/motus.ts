import columns from "./motus-columns.json";
import type { InsurancePolicy, InsuranceSource, PolicyKind } from "./types";

/** "Motus Insur - All With History". The daily-difference set (x96h-evps) only holds one day of rows. */
export const DEFAULT_INSUR_DATASET = "c5y8-a4uz";
const HOST = "https://data.transportation.gov";
const MAX_POLICIES = 20;

type Row = Record<string, unknown>;

const text = (v: unknown): string | null => {
  if (v === null || v === undefined) return null;
  const s = String(v).replace(/\s+/g, " ").trim();
  return s === "" ? null : s;
};

const pick = (row: Row, names: string[]): string | null => {
  for (const n of names) {
    const v = text(row[n]);
    if (v !== null) return v;
  }
  return null;
};

/** Accepts YYYYMMDD, YYYY-MM-DD (with or without a time) and M/D/YYYY. Returns YYYY-MM-DD, or null if it is not a real date. */
export function parseDate(v: unknown): string | null {
  const s = text(v);
  if (!s) return null;
  let y: number, m: number, d: number;
  let hit: RegExpMatchArray | null;
  if ((hit = s.match(/^(\d{4})(\d{2})(\d{2})$/)) || (hit = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) {
    [y, m, d] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  } else if ((hit = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/))) {
    [m, d, y] = [Number(hit[1]), Number(hit[2]), Number(hit[3])];
  } else {
    return null;
  }
  const t = new Date(Date.UTC(y, m - 1, d));
  if (t.getUTCFullYear() !== y || t.getUTCMonth() !== m - 1 || t.getUTCDate() !== d) return null;
  return t.toISOString().slice(0, 10);
}

/** BMC-91 and BMC-91X are liability (BI&PD) filings, BMC-34 is cargo, BMC-84 and BMC-85 are bonds. */
export function classifyForm(form: string | null): PolicyKind {
  const s = (form ?? "").toUpperCase().replace(/[^A-Z0-9&]/g, "");
  if (/BMC91/.test(s) || /BIPD|BI&PD|LIABILITY/.test(s)) return "liability";
  if (/BMC34/.test(s) || /CARGO/.test(s)) return "cargo";
  if (/BMC8[45]/.test(s) || /BOND|SURETY|TRUST/.test(s)) return "bond";
  return "other";
}

export function normalizePolicyRow(row: Row): InsurancePolicy | null {
  const insurer = pick(row, columns.insurer);
  const policyNumber = pick(row, columns.policy);
  const form = pick(row, columns.form);
  const effectiveDate = parseDate(pick(row, columns.effective));
  const cancelDate = parseDate(pick(row, columns.cancel));
  if (!insurer && !policyNumber && !effectiveDate) return null;
  return {
    insurer: insurer ? insurer.toUpperCase() : null,
    policyNumber,
    form,
    kind: classifyForm(form),
    effectiveDate,
    cancelDate,
  };
}

/**
 * Reads policy filings from FMCSA's Motus open data (Socrata). Only policies that have not already been
 * cancelled are returned, so the history set does not flood the snapshot.
 * Throws on a non-OK response. Callers treat that as "unknown", never as "no insurance".
 */
export class MotusInsuranceSource implements InsuranceSource {
  constructor(
    private opts: { datasetId?: string; appToken?: string; fetchImpl?: typeof fetch; now?: () => Date } = {},
  ) {}

  async getPolicies(dockets: string[]): Promise<InsurancePolicy[]> {
    // Dockets are interpolated into a query, so only letters and digits are allowed through.
    const safe = [...new Set(dockets.map((d) => d.replace(/[^A-Za-z0-9]/g, "")).filter(Boolean))];
    if (!safe.length) return [];

    const where = `${columns.docket} in (${safe.map((d) => `'${d}'`).join(",")})`;
    const id = this.opts.datasetId ?? DEFAULT_INSUR_DATASET;
    const url = `${HOST}/resource/${id}.json?$where=${encodeURIComponent(where)}&$limit=1000`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.opts.appToken) headers["X-App-Token"] = this.opts.appToken;

    const res = await (this.opts.fetchImpl ?? fetch)(url, { headers });
    if (!res.ok) throw new Error(`Motus ${res.status}`);
    const rows = (await res.json()) as Row[];
    if (!Array.isArray(rows)) throw new Error("Motus returned an unexpected response");

    const today = (this.opts.now?.() ?? new Date()).toISOString().slice(0, 10);
    return rows
      .map(normalizePolicyRow)
      .filter((p): p is InsurancePolicy => p !== null)
      .filter((p) => p.cancelDate === null || p.cancelDate > today)
      .sort((a, b) => (b.effectiveDate ?? "").localeCompare(a.effectiveDate ?? ""))
      .slice(0, MAX_POLICIES);
  }
}
