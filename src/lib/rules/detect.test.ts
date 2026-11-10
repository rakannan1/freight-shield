import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/lib/fmcsa/mock";
import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import { bySeverity, detectChanges } from "./detect";

const prev: CarrierSnapshot = FIXTURES["1000001"];
const next = (patch: Partial<CarrierSnapshot>): CarrierSnapshot => ({ ...prev, ...patch });
const rules = (c: CarrierSnapshot) => detectChanges(prev, c).map((f) => f.rule);

describe("detectChanges", () => {
  it("returns nothing when nothing changed", () => {
    expect(detectChanges(prev, next({}))).toEqual([]);
  });

  it("ignores a changed fetchedAt timestamp", () => {
    expect(detectChanges(prev, next({ fetchedAt: "2030-01-01T00:00:00.000Z" }))).toEqual([]);
  });

  it("flags a carrier that is no longer allowed to operate", () => {
    const f = detectChanges(prev, next({ allowedToOperate: false }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "not_allowed_to_operate", severity: "critical" });
  });

  it("flags lost authority per authority type", () => {
    const f = detectChanges(prev, next({ commonAuthority: "I", contractAuthority: "I" }));
    expect(f.map((x) => x.rule)).toEqual(["authority_lost", "authority_lost"]);
    expect(f.every((x) => x.severity === "critical")).toBe(true);
  });

  it("does not flag authority that was already inactive", () => {
    const inactive = next({ brokerAuthority: "N" });
    expect(detectChanges(inactive, next({ brokerAuthority: "I" }))).toEqual([]);
  });

  it("flags liability insurance dropping to zero as critical", () => {
    const f = detectChanges(prev, next({ bipdOnFile: 0 }));
    expect(f.map((x) => x.rule)).toContain("insurance_dropped");
    expect(f.map((x) => x.rule)).toContain("insurance_below_required");
  });

  it("flags a reduction in insurance as a warning", () => {
    const f = detectChanges(prev, next({ bipdOnFile: 800_000 }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "insurance_decreased", severity: "warning" });
  });

  it("flags insurance falling below the required minimum", () => {
    const f = detectChanges(prev, next({ bipdOnFile: 500_000 }));
    expect(f.map((x) => x.rule)).toEqual(
      expect.arrayContaining(["insurance_decreased", "insurance_below_required"]),
    );
  });

  it("does not repeat the below-required alert if it was already below required", () => {
    const already = next({ bipdOnFile: 500_000 });
    const f = detectChanges(already, next({ bipdOnFile: 400_000 }));
    expect(f.map((x) => x.rule)).toEqual(["insurance_decreased"]);
  });

  it("ignores increases in insurance", () => {
    expect(detectChanges(prev, next({ bipdOnFile: 2_000_000 }))).toEqual([]);
  });

  it("flags cargo insurance dropping off", () => {
    expect(rules(next({ cargoOnFile: false }))).toEqual(["cargo_insurance_dropped"]);
  });

  it("flags an address change alone as a warning", () => {
    const f = detectChanges(prev, next({ address: "9 ELM ST, DALLAS, TX 75001" }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "address_changed", severity: "warning" });
  });

  it("flags a name change alone as a warning", () => {
    const f = detectChanges(prev, next({ legalName: "ACME LOGISTICS LLC" }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "name_changed", severity: "warning" });
  });

  it("escalates name plus address change to a single critical identity_change", () => {
    const f = detectChanges(
      prev,
      next({ legalName: "ACME LOGISTICS LLC", address: "9 ELM ST, DALLAS, TX 75001" }),
    );
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "identity_change", severity: "critical" });
  });

  it("does not treat a first-time address (empty before) as a change", () => {
    const blank = next({ address: "" });
    expect(detectChanges(blank, next({ address: "9 ELM ST, DALLAS, TX 75001" }))).toEqual([]);
  });

  it("flags a DBA change as info", () => {
    const f = detectChanges(prev, next({ dbaName: "ACME EXPRESS" }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "dba_changed", severity: "info" });
  });

  it("flags a new out-of-service date", () => {
    const f = detectChanges(prev, next({ outOfServiceDate: "2026-10-01" }));
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ rule: "out_of_service", severity: "critical" });
  });

  it("flags a fleet that more than doubles", () => {
    expect(rules(next({ powerUnits: 25 }))).toEqual(["fleet_size_swing"]);
  });

  it("flags a fleet that falls by half", () => {
    expect(rules(next({ powerUnits: 5 }))).toEqual(["fleet_size_swing"]);
  });

  it("ignores small fleet changes and tiny fleets", () => {
    expect(rules(next({ powerUnits: 12 }))).toEqual([]);
    const tiny = next({ powerUnits: 2 });
    expect(detectChanges(tiny, next({ powerUnits: 6 }))).toEqual([]);
  });

  it("sorts findings critical first", () => {
    const f = detectChanges(
      prev,
      next({ dbaName: "X", allowedToOperate: false, bipdOnFile: 900_000 }),
    ).sort(bySeverity);
    expect(f.map((x) => x.severity)).toEqual(["critical", "warning", "info"]);
  });
});
