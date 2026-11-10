import { describe, expect, it } from "vitest";
import { normalizeCarrier, QcMobileProvider } from "./qcmobile";

const raw = {
  dotNumber: 1234567,
  legalName: "  Acme   Hauling LLC ",
  dbaName: "",
  phyStreet: "100 main st",
  phyCity: "Atlanta",
  phyState: "ga",
  phyZipcode: "30301",
  allowedToOperate: "Y",
  commonAuthorityStatus: "A",
  contractAuthorityStatus: "N",
  brokerAuthorityStatus: "N",
  bipdInsuranceOnFile: "1000",
  bipdRequiredAmount: "750",
  cargoInsuranceOnFile: "Y",
  totalPowerUnits: 10,
  totalDrivers: "12",
};

describe("normalizeCarrier", () => {
  it("normalizes names, address and numeric fields", () => {
    const s = normalizeCarrier(raw, new Date("2026-10-21T00:00:00Z"));
    expect(s).toMatchObject({
      dotNumber: "1234567",
      legalName: "ACME HAULING LLC",
      dbaName: null,
      address: "100 MAIN ST, ATLANTA, GA 30301",
      allowedToOperate: true,
      commonAuthority: "A",
      bipdOnFile: 1_000_000,
      bipdRequired: 750_000,
      cargoOnFile: true,
      powerUnits: 10,
      totalDrivers: 12,
      fetchedAt: "2026-10-21T00:00:00.000Z",
    });
  });

  it("treats missing values as null instead of zero", () => {
    const s = normalizeCarrier({ dotNumber: 1, legalName: "X" });
    expect(s.bipdOnFile).toBeNull();
    expect(s.powerUnits).toBeNull();
    expect(s.allowedToOperate).toBe(false);
  });
});

describe("QcMobileProvider", () => {
  it("requires a web key", () => {
    expect(() => new QcMobileProvider("")).toThrow();
  });

  it("returns null on 404 and throws on other errors", async () => {
    const f404 = (async () => new Response("", { status: 404 })) as typeof fetch;
    const f500 = (async () => new Response("", { status: 500 })) as typeof fetch;
    expect(await new QcMobileProvider("k", f404).getCarrierByDot("1")).toBeNull();
    await expect(new QcMobileProvider("k", f500).getCarrierByDot("1")).rejects.toThrow("FMCSA 500");
  });

  it("parses a carrier response", async () => {
    const f = (async () =>
      new Response(JSON.stringify({ content: { carrier: raw } }), { status: 200 })) as typeof fetch;
    const s = await new QcMobileProvider("k", f).getCarrierByDot("1234567");
    expect(s?.legalName).toBe("ACME HAULING LLC");
  });

  it("resolves an MC number to a DOT number", async () => {
    const f = (async () =>
      new Response(JSON.stringify({ content: [{ carrier: { dotNumber: 1234567 } }] }), {
        status: 200,
      })) as typeof fetch;
    expect(await new QcMobileProvider("k", f).resolveMcToDot("MC-98")).toBe("1234567");
  });
});
