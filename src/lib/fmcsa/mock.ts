import type { CarrierSnapshot, FmcsaProvider } from "./types";

const base = (over: Partial<CarrierSnapshot>): CarrierSnapshot => ({
  dotNumber: "0",
  legalName: "",
  dbaName: null,
  address: "",
  allowedToOperate: true,
  commonAuthority: "A",
  contractAuthority: "A",
  brokerAuthority: "N",
  bipdOnFile: 1_000_000,
  bipdRequired: 750_000,
  cargoOnFile: true,
  outOfServiceDate: null,
  powerUnits: 10,
  totalDrivers: 12,
  fetchedAt: new Date().toISOString(),
  ...over,
});

/** Fixture carriers for local development. Fictional data. */
export const FIXTURES: Record<string, CarrierSnapshot> = {
  "1000001": base({
    dotNumber: "1000001",
    legalName: "ACME HAULING LLC",
    address: "100 MAIN ST, ATLANTA, GA 30301",
  }),
  "1000002": base({
    dotNumber: "1000002",
    legalName: "BLUE RIDGE FREIGHT INC",
    address: "22 OAK AVE, CHATTANOOGA, TN 37402",
    powerUnits: 40,
  }),
};

export class MockProvider implements FmcsaProvider {
  constructor(private data: Record<string, CarrierSnapshot> = FIXTURES) {}

  async getCarrierByDot(dotNumber: string) {
    const c = this.data[dotNumber];
    return c ? { ...c, fetchedAt: new Date().toISOString() } : null;
  }

  async resolveMcToDot(mcNumber: string) {
    // Fixture convention: MC 123 -> DOT 1000001 etc. Only for local dev.
    const map: Record<string, string> = { "100001": "1000001", "100002": "1000002" };
    return map[mcNumber.replace(/\D/g, "")] ?? null;
  }

  /** Test helper: mutate a fixture to simulate a change between fetches. */
  set(dotNumber: string, patch: Partial<CarrierSnapshot>) {
    this.data[dotNumber] = { ...this.data[dotNumber], ...patch };
  }
}
