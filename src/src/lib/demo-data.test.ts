import { describe, expect, it } from "vitest";
import { DEMO_CARRIERS, findDemoCarrier } from "./demo-data";

describe("demo data", () => {
  it("finds samples by MC or DOT in common formats", () => {
    expect(findDemoCarrier("MC 900001")?.name).toBe("Prairie Line Freight LLC");
    expect(findDemoCarrier("mc-900002")?.mc).toBe("900002");
    expect(findDemoCarrier("9000003")?.name).toBe("Summit Cargo Express");
  });
  it("returns null for real or empty input", () => {
    expect(findDemoCarrier("123456")).toBeNull();
    expect(findDemoCarrier("")).toBeNull();
  });
  it("every finding names its source, time and next step", () => {
    for (const c of DEMO_CARRIERS) for (const f of c.findings) {
      expect(f.source && f.checked && f.next).toBeTruthy();
    }
  });
});
