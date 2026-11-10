import { describe, expect, it } from "vitest";
import { extractAuthority, extractDockets } from "./authority";
import { carryForward } from "./carry-forward";
import { classifyForm, MotusInsuranceSource, normalizePolicyRow, parseDate } from "./motus";
import { QcMobileProvider } from "./qcmobile";
import type { CarrierSnapshot } from "./types";

const carrier = { dotNumber: 1, legalName: "Acme", allowedToOperate: "Y" };
const auth = (...rows: Array<[string, string, string]>) => ({
  content: rows.map(([c, k, b]) => ({
    carrierAuthority: { commonAuthorityStatus: c, contractAuthorityStatus: k, brokerAuthorityStatus: b },
  })),
});
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status });

describe("authority endpoint", () => {
  it("merges dockets, best status wins", () => {
    expect(extractAuthority(auth(["I", "N", "N"], ["A", "N", "A"]))).toEqual({ common: "A", contract: "N", broker: "A" });
  });
  it("returns null when no statuses (unknown, not none)", () => {
    expect(extractAuthority({ content: [] })).toBeNull();
    expect(extractAuthority(null)).toBeNull();
  });
  it("parses dockets", () => {
    expect(extractDockets({ content: [{ docketNumber: { prefix: "MC", docketNumber: "000123" } }] })).toEqual(["MC123"]);
  });
  it("provider merges authority and fails soft", async () => {
    const warns: string[] = [];
    const ok = (async (u: string) =>
      String(u).includes("/authority") ? json(auth(["A", "N", "N"])) : json({ content: { carrier } })) as unknown as typeof fetch;
    expect((await new QcMobileProvider("k", ok).getCarrierByDot("1"))?.commonAuthority).toBe("A");

    const bad = (async (u: string) =>
      String(u).includes("/authority") ? new Response("", { status: 500 }) : json({ content: { carrier } })) as unknown as typeof fetch;
    const s = await new QcMobileProvider("k", bad, null, (m) => warns.push(m)).getCarrierByDot("1");
    expect(s?.commonAuthority).toBeNull();
    expect(warns[0]).toMatch(/authority lookup failed/);
  });
  it("insurance failure leaves policies unknown", async () => {
    const f = (async (u: string) =>
      String(u).includes("/docket-numbers") ? json({ content: [{ docketNumber: { docketNumber: "5" } }] }) : json({ content: { carrier } })) as unknown as typeof fetch;
    const src = { getPolicies: async () => { throw new Error("boom"); } };
    const s = await new QcMobileProvider("k", f, src, () => {}).getCarrierByDot("1");
    expect(s?.policies).toBeUndefined();
  });
});

describe("motus", () => {
  it("parses dates", () => {
    expect(parseDate("20261104")).toBe("2026-11-04");
    expect(parseDate("11/4/2026")).toBe("2026-11-04");
    expect(parseDate("2026-11-04T00:00:00.000")).toBe("2026-11-04");
    expect(parseDate("20261340")).toBeNull();
  });
  it("classifies forms", () => {
    expect(classifyForm("BMC-91X")).toBe("liability");
    expect(classifyForm("BMC 34")).toBe("cargo");
    expect(classifyForm("BMC-84")).toBe("bond");
    expect(classifyForm(null)).toBe("other");
  });
  it("normalizes rows and drops empties", () => {
    expect(normalizePolicyRow({})).toBeNull();
    expect(normalizePolicyRow({ insurance_company_name: "Acme Ins", form_type: "BMC-91", effective_date: "20260101", cancel_effective_date: "20261201" }))
      .toMatchObject({ insurer: "ACME INS", kind: "liability", effectiveDate: "2026-01-01", cancelDate: "2026-12-01" });
  });
  it("queries safely and filters already-cancelled policies", async () => {
    let url = "";
    const f = (async (u: string) => {
      url = u;
      return json([
        { insurer_name: "A", form_type: "BMC-91", effective_date: "20250101", cancel_effective_date: "20260101" },
        { insurer_name: "B", form_type: "BMC-91", effective_date: "20260201" },
      ]);
    }) as unknown as typeof fetch;
    const src = new MotusInsuranceSource({ fetchImpl: f, now: () => new Date("2026-11-04T00:00:00Z") });
    const p = await src.getPolicies(["MC1'; drop"]);
    expect(p.map((x) => x.insurer)).toEqual(["B"]);
    expect(decodeURIComponent(url)).toContain("'MC1drop'");
  });
  it("throws on HTTP errors", async () => {
    const f = (async () => new Response("", { status: 403 })) as unknown as typeof fetch;
    await expect(new MotusInsuranceSource({ fetchImpl: f }).getPolicies(["MC1"])).rejects.toThrow("Motus 403");
  });
});

describe("carryForward", () => {
  const base = { dotNumber: "1", legalName: "A", commonAuthority: "A", bipdOnFile: 1000000, policies: [] } as unknown as CarrierSnapshot;
  it("keeps yesterday's value for missing fields only", () => {
    const curr = { ...base, commonAuthority: null, bipdOnFile: 0, policies: undefined } as unknown as CarrierSnapshot;
    const r = carryForward(base, curr);
    expect(r.commonAuthority).toBe("A");
    expect(r.bipdOnFile).toBe(0);
    expect(r.policies).toEqual([]);
  });
});
