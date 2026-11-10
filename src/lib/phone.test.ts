import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "./phone";
describe("phone", () => {
  it("normalizes and formats", () => {
    expect(normalizePhone("(555) 111-2222")).toBe("5551112222");
    expect(normalizePhone("")).toBeNull();
    expect(formatPhone("5551112222")).toBe("(555) 111-2222");
  });
});
