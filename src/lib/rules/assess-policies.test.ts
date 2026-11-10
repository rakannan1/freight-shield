import { describe, expect, it } from "vitest";
import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import { assessCarrier } from "./assess";
import { detectChanges } from "./detect";

const snap = (o: Partial<CarrierSnapshot> = {}): CarrierSnapshot => ({
  dotNumber: "1", legalName: "ACME", dbaName: null, address: "1 MAIN", phone: null, allowedToOperate: true,
  commonAuthority: "A", contractAuthority: null, brokerAuthority: null, bipdOnFile: 1_000_000, bipdRequired: 750_000,
  cargoOnFile: null, outOfServiceDate: null, powerUnits: 5, totalDrivers: 5, fetchedAt: "2026-11-04T12:00:00Z", ...o,
});
const rules = (f: { rule: string }[]) => f.map((x) => x.rule);
const pol = (cancelDate: string | null, n = "P1") => ({
  insurer: "X", policyNumber: n, form: "BMC-91", kind: "liability" as const, effectiveDate: "2026-01-01", cancelDate,
});

describe("assessCarrier", () => {
  it("is quiet when data is missing", () => {
    expect(assessCarrier(snap({ bipdOnFile: null, bipdRequired: null, commonAuthority: null }))).toEqual([]);
  });
  it("flags $0 insurance for a for-hire carrier", () => {
    expect(rules(assessCarrier(snap({ bipdOnFile: 0 })))).toContain("no_insurance");
  });
  it("does not flag $0 for a carrier with no requirement and no authority", () => {
    expect(rules(assessCarrier(snap({ bipdOnFile: 0, bipdRequired: 0, commonAuthority: "N" })))).not.toContain("no_insurance");
  });
  it("flags cargo only when required", () => {
    expect(rules(assessCarrier(snap({ cargoOnFile: false })))).not.toContain("no_cargo_insurance");
    expect(rules(assessCarrier(snap({ cargoOnFile: false, cargoRequired: true })))).toContain("no_cargo_insurance");
  });
  it("flags a cancellation notice, critical when it is the only policy and soon", () => {
    const f = assessCarrier(snap({ policies: [pol("2026-11-10")] })).find((x) => x.rule === "insurance_cancellation_notice");
    expect(f?.severity).toBe("critical");
  });
  it("warns only when another policy is in force", () => {
    const f = assessCarrier(snap({ policies: [pol("2026-11-10"), pol(null, "P2")] })).find((x) => x.rule === "insurance_cancellation_notice");
    expect(f?.severity).toBe("warning");
  });
  it("flags no filing only when the source answered empty", () => {
    expect(rules(assessCarrier(snap({ bipdOnFile: null, policies: [] })))).toContain("no_insurance");
    expect(rules(assessCarrier(snap({ bipdOnFile: null, policies: undefined })))).not.toContain("no_insurance");
  });
});

describe("detectChanges: authority and policies", () => {
  it("does not treat unknown authority as lost or activated", () => {
    expect(detectChanges(snap(), snap({ commonAuthority: null }))).toEqual([]);
    expect(detectChanges(snap({ commonAuthority: null }), snap())).toEqual([]);
  });
  it("detects lost and reactivated authority", () => {
    expect(rules(detectChanges(snap(), snap({ commonAuthority: "I" })))).toContain("authority_lost");
    expect(rules(detectChanges(snap({ commonAuthority: "I" }), snap()))).toContain("authority_activated");
  });
  it("detects a phone change", () => {
    expect(rules(detectChanges(snap({ phone: "5551112222" }), snap({ phone: "5553334444" })))).toContain("phone_changed");
  });
  it("alerts once on a new cancellation notice", () => {
    const prev = snap({ policies: [pol(null)] });
    const curr = snap({ policies: [pol("2026-11-20")] });
    expect(rules(detectChanges(prev, curr))).toContain("insurance_cancellation_notice");
    expect(detectChanges(curr, curr).map((x) => x.rule)).not.toContain("insurance_cancellation_notice");
  });
});
