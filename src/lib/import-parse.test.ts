import { describe, expect, it } from "vitest";
import { chunk, extractIdentifiers, parseCsv } from "./import-parse";

describe("parseCsv", () => {
  it("parses simple rows, CRLF and a trailing newline", () => {
    expect(parseCsv("MC,DOT\r\n123,456\r\n")).toEqual([
      ["MC", "DOT"],
      ["123", "456"],
    ]);
  });

  it("handles quoted commas, escaped quotes and embedded newlines", () => {
    expect(parseCsv('name,mc\n"Smith, Jr ""Big""",123\n"two\nlines",456')).toEqual([
      ["name", "mc"],
      ['Smith, Jr "Big"', "123"],
      ["two\nlines", "456"],
    ]);
  });

  it("strips a BOM, keeps empty fields, and returns nothing for empty input", () => {
    expect(parseCsv("﻿a,,c")).toEqual([["a", "", "c"]]);
    expect(parseCsv("")).toEqual([]);
  });
});

describe("extractIdentifiers with a header", () => {
  it("reads bare numbers by column kind and ignores other columns", () => {
    const r = extractIdentifiers([
      ["Carrier", "MC Number", "DOT Number", "Phone"],
      ["Acme", 123456, "", "5551234567"],
      ["Blue Ridge", "", 7654321, "5559876543"],
    ]);
    expect(r).toEqual({ lines: ["MC-123456", "DOT 7654321"], skipped: 0, usedHeader: true });
  });

  it("recognizes common header spellings", () => {
    for (const h of ["MC", "MC#", "mc number", "Docket", "Docket Number"]) {
      expect(extractIdentifiers([[h], ["99"]]).lines).toEqual(["MC-99"]);
    }
    for (const h of ["DOT", "USDOT", "US DOT #", "DOT Number", "dot no"]) {
      expect(extractIdentifiers([[h], ["99"]]).lines).toEqual(["DOT 99"]);
    }
  });

  it("does not mistake a company name column for a DOT column", () => {
    const r = extractIdentifiers([["Dotson Trucking", "MC"], ["Dotson", "55"]]);
    expect(r.lines).toEqual(["MC-55"]);
  });

  it("prefers DOT when a row has both, accepts prefixed values, and counts unreadable rows", () => {
    const r = extractIdentifiers([
      ["MC", "DOT"],
      ["111", "222"],
      ["MC-333", ""],
      ["n/a", ""],
      ["", ""],
    ]);
    expect(r.lines).toEqual(["DOT 222", "MC-333"]);
    expect(r.skipped).toBe(1);
  });

  it("finds a header that is not on the first row", () => {
    const r = extractIdentifiers([["Carrier list"], ["MC"], ["44"]]);
    expect(r).toMatchObject({ lines: ["MC-44"], usedHeader: true });
  });
});

describe("extractIdentifiers without a header", () => {
  it("in a multi-column sheet, trusts only values with an explicit MC or DOT prefix", () => {
    const r = extractIdentifiers([
      ["Acme Hauling", "1234567"],
      ["Blue Ridge", "MC-5555"],
      ["Summit", "oops"],
      ["Peachtree", "DOT 777"],
    ]);
    expect(r).toEqual({ lines: ["MC-5555", "DOT 777"], skipped: 2, usedHeader: false });
  });

  it("never reads zip codes, quantities or phone fragments beside names as carriers", () => {
    const r = extractIdentifiers([
      ["Name", "Zip", "Loads"],
      ["Acme", "30301", 12],
      ["Blue Ridge", "37402", 7],
    ]);
    expect(r).toEqual({ lines: [], skipped: 3, usedHeader: false });
  });

  it("reads a plain single-column list, including Excel numeric cells", () => {
    const r = extractIdentifiers([[1234567], ["DOT 222"], ["MC 5"]]);
    expect(r.lines).toEqual(["DOT 1234567", "DOT 222", "MC-5"]);
  });

  it("returns nothing for an empty sheet", () => {
    expect(extractIdentifiers([])).toEqual({ lines: [], skipped: 0, usedHeader: false });
    expect(extractIdentifiers([[null, ""]])).toEqual({ lines: [], skipped: 0, usedHeader: false });
  });
});

describe("chunk", () => {
  it("splits into groups of the given size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(chunk([], 3)).toEqual([]);
  });
});
