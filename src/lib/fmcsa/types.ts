/** Normalized carrier record we store and diff. Independent of FMCSA's raw field names. */
export interface CarrierSnapshot {
  dotNumber: string;
  legalName: string;
  dbaName: string | null;
  /** Single normalized line: "street, city, ST zip" (upper-cased, whitespace collapsed). */
  address: string;
  /** Digits only. Optional because snapshots stored before this field existed do not have it. */
  phone?: string | null;
  allowedToOperate: boolean;
  /** FMCSA authority status codes: "A" active, "I" inactive, "N" none. */
  commonAuthority: string | null;
  contractAuthority: string | null;
  brokerAuthority: string | null;
  /** Liability (BIPD) insurance on file and required, in US dollars. */
  bipdOnFile: number | null;
  bipdRequired: number | null;
  cargoOnFile: boolean | null;
  /** Cargo insurance is only required of household-goods carriers, so "not on file" is often normal. */
  cargoRequired?: boolean | null;
  /** MC/MX docket, when known. */
  mcNumber?: string | null;
  /**
   * Insurance filings from the optional insurance source.
   * undefined/null = source not used or unavailable (unknown). [] = source answered, nothing on file.
   */
  policies?: InsurancePolicy[] | null;
  outOfServiceDate: string | null;
  powerUnits: number | null;
  totalDrivers: number | null;
  fetchedAt: string;
}

export type PolicyKind = "liability" | "cargo" | "bond" | "other";

export interface InsurancePolicy {
  insurer: string | null;
  policyNumber: string | null;
  form: string | null;
  kind: PolicyKind;
  /** YYYY-MM-DD */
  effectiveDate: string | null;
  /** YYYY-MM-DD. A date here means a cancellation notice is on file. */
  cancelDate: string | null;
}

export interface InsuranceSource {
  /** Throws on failure. Callers must treat a failure as "unknown", never "no insurance". */
  getPolicies(dockets: string[]): Promise<InsurancePolicy[]>;
}

export interface FmcsaProvider {
  /** Returns null when the DOT number is unknown to FMCSA. Throws on transport errors. */
  getCarrierByDot(dotNumber: string): Promise<CarrierSnapshot | null>;
  /** Resolve an MC/docket number to a DOT number, or null if not found. */
  resolveMcToDot(mcNumber: string): Promise<string | null>;
}
