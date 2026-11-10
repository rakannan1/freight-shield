import { describe, expect, it } from "vitest";
import { parseIdentifier, parseList } from "./identifiers";

describe("parseIdentifier", () => {
  it("parses MC numbers in common formats", () => {
    expect(parseIdentifier("MC-123456")).toEqual({ kind: "mc", value: "123456" });
    expect(parseIdentifier("mc 123456")).toEqual({ kind: "mc", value: "123456" });
    expect(parseIdentifier("MC#0098")).toEqual({ kind: "mc", value: "98" });
  });

  it("parses DOT numbers, with or without a prefix", () => {
    expect(parseIdentifier("DOT 1234567")).toEqual({ kind: "dot", value: "1234567" });
    expect(parseIdentifier("USDOT 1234567")).toEqual({ kind: "dot", value: "1234567" });
    expect(parseIdentifier("1234567")).toEqual({ kind: "dot", value: "1234567" });
  });

  it("rejects junk", () => {
    expect(parseIdentifier("")).toBeNull();
    expect(parseIdentifier("hello")).toBeNull();
    expect(parseIdentifier("MC")).toBeNull();
    expect(parseIdentifier("123456789")).toBeNull();
  });
});

describe("parseList", () => {
  it("splits on newlines and commas, dedupes, and reports invalid entries", () => {
    const { ids, invalid } = parseList("MC-1\nDOT 22, 22; foo\n\nMC 1");
    expect(ids).toEqual([
      { kind: "mc", value: "1" },
      { kind: "dot", value: "22" },
    ]);
    expect(invalid).toEqual(["foo"]);
  });
});
