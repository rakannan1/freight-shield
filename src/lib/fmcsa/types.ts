/** Normalized carrier record we store and diff. Independent of FMCSA's raw field names. */
export interface CarrierSnapshot {
  dotNumber: string;
  legalName: string;
  dbaName: string | null;
  /** Single normalized line: "street, city, ST zip" (upper-cased, whitespace collapsed). */
  address: string;
  allowedToOperate: boolean;
  /** FMCSA authority status codes: "A" active, "I" inactive, "N" none. */
  commonAuthority: string | null;
  contractAuthority: string | null;
  brokerAuthority: string | null;
  /** Liability (BIPD) insurance on file and required, in US dollars. */
  bipdOnFile: number | null;
  bipdRequired: number | null;
  cargoOnFile: boolean | null;
  outOfServiceDate: string | null;
  powerUnits: number | null;
  totalDrivers: number | null;
  fetchedAt: string;
}

export interface FmcsaProvider {
  /** Returns null when the DOT number is unknown to FMCSA. Throws on transport errors. */
  getCarrierByDot(dotNumber: string): Promise<CarrierSnapshot | null>;
  /** Resolve an MC/docket number to a DOT number, or null if not found. */
  resolveMcToDot(mcNumber: string): Promise<string | null>;
}
