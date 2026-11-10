import { normalizePhone } from "@/lib/phone";
import { applyAuthority, extractAuthority, extractDockets } from "./authority";
import type { CarrierSnapshot, FmcsaProvider, InsuranceSource } from "./types";

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
 * NOTE: FMCSA's published element list and its observed responses do not always use the same
 * spellings (for example allowToOperate vs allowedToOperate, phyZip vs phyZipcode), so both are
 * accepted. Authority comes from /authority, and policy filings from the optional insurance source.
 * Run `node scripts/check-fmcsa.mjs <DOT>` with your web key to see which fields your responses really have.
 */
export function normalizeCarrier(raw: any, now = new Date()): CarrierSnapshot {
  const street = norm(raw.phyStreet);
  const city = norm(raw.phyCity);
  const state = norm(raw.phyState);
  const zip = norm(raw.phyZipcode ?? raw.phyZip);
  const address = [street, [city, [state, zip].filter(Boolean).join(" ")].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(", ");

  return {
    dotNumber: String(raw.dotNumber),
    legalName: norm(raw.legalName),
    dbaName: norm(raw.dbaName) || null,
    address,
    phone: normalizePhone(raw.telephone),
    allowedToOperate: raw.allowedToOperate === "Y" || raw.allowToOperate === "Y",
    commonAuthority: raw.commonAuthorityStatus ?? null,
    contractAuthority: raw.contractAuthorityStatus ?? null,
    brokerAuthority: raw.brokerAuthorityStatus ?? null,
    // QCMobile reports insurance in thousands of dollars.
    bipdOnFile: num(raw.bipdInsuranceOnFile) === null ? null : num(raw.bipdInsuranceOnFile)! * 1000,
    bipdRequired: num(raw.bipdRequiredAmount) === null ? null : num(raw.bipdRequiredAmount)! * 1000,
    cargoOnFile: yes(raw.cargoInsuranceOnFile) ?? (num(raw.cargoInsuranceOnFile) === null ? null : num(raw.cargoInsuranceOnFile)! > 0),
    outOfServiceDate: raw.oosDate ?? raw.outOfServiceDate ? String(raw.oosDate ?? raw.outOfServiceDate) : null,
    powerUnits: num(raw.totalPowerUnits),
    totalDrivers: num(raw.totalDrivers),
    fetchedAt: now.toISOString(),
  };
}

export class QcMobileProvider implements FmcsaProvider {
  constructor(
    private webKey: string,
    private fetchImpl: typeof fetch = fetch,
    private insurance: InsuranceSource | null = null,
    private onWarn: (msg: string) => void = (m) => console.warn(m),
  ) {
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
    if (!carrier) return null;
    let snap = normalizeCarrier(carrier);
    const dot = encodeURIComponent(dotNumber);

    // Authority and dockets are optional lookups. A failure leaves the fields unknown (null), and the
    // snapshot job carries yesterday's values forward, so an outage cannot look like a change.
    try {
      snap = applyAuthority(snap, extractAuthority(await this.get(`/carriers/${dot}/authority`)));
    } catch (e) {
      this.onWarn(`authority lookup failed for DOT ${dotNumber}: ${(e as Error).message}`);
    }

    if (this.insurance) {
      try {
        let dockets: string[] = [];
        try {
          dockets = extractDockets(await this.get(`/carriers/${dot}/docket-numbers`));
        } catch (e) {
          this.onWarn(`docket lookup failed for DOT ${dotNumber}: ${(e as Error).message}`);
        }
        if (dockets.length) {
          snap = { ...snap, mcNumber: dockets[0], policies: await this.insurance.getPolicies(dockets) };
        }
      } catch (e) {
        this.onWarn(`insurance lookup failed for DOT ${dotNumber}: ${(e as Error).message}`);
      }
    }
    return snap;
  }

  async resolveMcToDot(mcNumber: string): Promise<string | null> {
    const mc = mcNumber.replace(/\D/g, "");
    const body = await this.get(`/carriers/docket-number/${encodeURIComponent(mc)}`);
    const first = Array.isArray(body?.content) ? body.content[0] : body?.content;
    const dot = first?.carrier?.dotNumber ?? first?.dotNumber;
    return dot ? String(dot) : null;
  }
}
