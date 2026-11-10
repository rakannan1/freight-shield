import path from "node:path";
import { readSheet } from "read-excel-file/node";
import { describe, expect, it } from "vitest";
import { parseList } from "./identifiers";
import { extractIdentifiers } from "./import-parse";

const fixture = (name: string) => path.join(__dirname, "fixtures", name);

// These read real .xlsx files written by a spreadsheet library (openpyxl), not hand-built arrays.
describe("importing real .xlsx files", () => {
  it("reads headed MC and DOT columns, ignores other sheets, and prefers DOT when both are present", async () => {
    const rows = await readSheet(fixture("carriers.xlsx")); // first sheet only
    const found = extractIdentifiers(rows as unknown[][]);

    expect(found.usedHeader).toBe(true);
    expect(found.lines).toEqual([
      "MC-123456",
      "DOT 7654321",
      "MC-555123",
      "DOT 2222222",
      "MC-123456", // the duplicate row survives here and is removed by parseList below
    ]);
    expect(found.skipped).toBe(1); // "No Number Inc"
    expect(found.lines).not.toContain("MC-999999"); // from the second sheet

    expect(parseList(found.lines.join("\n")).ids).toHaveLength(4);
  });

  it("reads a plain single-column list with numeric cells", async () => {
    const rows = await readSheet(fixture("plain-list.xlsx"));
    const found = extractIdentifiers(rows as unknown[][]);
    expect(found).toEqual({
      lines: ["DOT 1234567", "DOT 222", "MC-5", "DOT 8765432"],
      skipped: 0,
      usedHeader: false,
    });
  });
});
