import type { CarrierSnapshot, FmcsaProvider } from "./types";

const BASE = "https://mobile.fmcsa.dot.gov/qc/services";

/* eslint-disable @typescript-eslint/no-explicit-any */

const norm = (s: unknown): string =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().toUpperCase() : "";

const num = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const yes = (v: unknown): boolean | null =>
  v === "Y" ? true : v === "N" ? false : null;

/**
 * Map a raw QCMobile carrier object to our snapshot.
 * NOTE: field names below follow the public QCMobile docs; verify against a live
 * response with your web key before relying on them (see README).
 */
export function normalizeCarrier(raw: any, now = new Date()): CarrierSnapshot {
  const street = norm(raw.phyStreet);
  const city = norm(raw.phyCity);
  const state = norm(raw.phyState);
  const zip = norm(raw.phyZipcode);
  const address = [street, [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");

  return {
    dotNumber: String(raw.dotNumber),
    legalName: norm(raw.legalName),
    dbaName: norm(raw.dbaName) || null,
    address,
    allowedToOperate: raw.allowedToOperate === "Y",
    commonAuthority: raw.commonAuthorityStatus ?? null,
    contractAuthority: raw.contractAuthorityStatus ?? null,
    brokerAuthority: raw.brokerAuthorityStatus ?? null,
    // QCMobile reports insurance in thousands of dollars.
    bipdOnFile: num(raw.bipdInsuranceOnFile) === null ? null : num(raw.bipdInsuranceOnFile)! * 1000,
    bipdRequired: num(raw.bipdRequiredAmount) === null ? null : num(raw.bipdRequiredAmount)! * 1000,
    cargoOnFile: yes(raw.cargoInsuranceOnFile) ?? (num(raw.cargoInsuranceOnFile) === null ? null : num(raw.cargoInsuranceOnFile)! > 0),
    outOfServiceDate: raw.oosDate ? String(raw.oosDate) : null,
    powerUnits: num(raw.totalPowerUnits),
    totalDrivers: num(raw.totalDrivers),
    fetchedAt: now.toISOString(),
  };
}

export class QcMobileProvider implements FmcsaProvider {
  constructor(private webKey: string, private fetchImpl: typeof fetch = fetch) {
    if (!webKey) throw new Error("FMCSA_WEB_KEY is not set");
  }

  private async get(path: string): Promise<any | null> {
    const url = `${BASE}${path}?webKey=${encodeURIComponent(this.webKey)}`;
    const res = await this.fetchImpl(url, { headers: { Accept: "application/json" } });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`FMCSA ${res.status} for ${path}`);
    return res.json();
  }

  async getCarrierByDot(dotNumber: string): Promise<CarrierSnapshot | null> {
    const body = await this.get(`/carriers/${encodeURIComponent(dotNumber)}`);
    const carrier = body?.content?.carrier;
    return carrier ? normalizeCarrier(carrier) : null;
  }

  async resolveMcToDot(mcNumber: string): Promise<string | null> {
    const mc = mcNumber.replace(/\D/g, "");
    const body = await this.get(`/carriers/docket-number/${encodeURIComponent(mc)}`);
    const first = Array.isArray(body?.content) ? body.content[0] : body?.content;
    const dot = first?.carrier?.dotNumber ?? first?.dotNumber;
    return dot ? String(dot) : null;
  }
}
