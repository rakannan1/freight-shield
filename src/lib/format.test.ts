import { describe, expect, it } from "vitest";
import { relativeDay, shortDate } from "./format";

const now = new Date("2026-10-22T15:00:00Z");

describe("relativeDay", () => {
  it("handles today, yesterday and recent days", () => {
    expect(relativeDay("2026-10-22T00:01:00Z", now)).toBe("Today");
    expect(relativeDay("2026-10-21T23:59:00Z", now)).toBe("Yesterday");
    expect(relativeDay("2026-10-19T10:00:00Z", now)).toBe("3 days ago");
  });

  it("uses a date after a week, adding the year only when it differs", () => {
    expect(relativeDay("2026-10-14T10:00:00Z", now)).toBe("Oct 14");
    expect(relativeDay("2025-12-30T10:00:00Z", now)).toBe("Dec 30, 2025");
  });

  it("treats a future timestamp as today and missing values as none", () => {
    expect(relativeDay("2026-10-23T01:00:00Z", now)).toBe("Today");
    expect(relativeDay(null, now)).toBe("None yet");
    expect(relativeDay("not a date", now)).toBe("None yet");
  });
});

describe("shortDate", () => {
  it("formats a billing date and tolerates blanks", () => {
    expect(shortDate("2026-11-22T00:00:00Z")).toBe("Nov 22, 2026");
    expect(shortDate(null)).toBe("");
  });
});
