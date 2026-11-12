import { describe, expect, it } from "vitest";
import { digestDue, renderDigest, runDigests, type DigestAlert, type DigestStore } from "./digest";
import { DEFAULT_SETTINGS } from "./settings";

const FRI = new Date("2026-11-13T11:00:00Z");
const SAT = new Date("2026-11-14T11:00:00Z");
const alert = (o: Partial<DigestAlert> = {}): DigestAlert => ({ dotNumber: "1", carrierName: "ACME", severity: "warning", title: "Phone changed", detail: "d", createdAt: "2026-11-12T00:00:00Z", ...o });

describe("digestDue", () => {
  it("weekly goes out on Fridays only, once", () => {
    expect(digestDue("weekly", null, FRI)).toBe(true);
    expect(digestDue("weekly", null, SAT)).toBe(false);
    expect(digestDue("weekly", FRI.toISOString(), new Date(FRI.getTime() + 3600_000))).toBe(false);
  });
  it("daily goes out each run but not twice in a day", () => {
    expect(digestDue("daily", null, SAT)).toBe(true);
    expect(digestDue("daily", new Date(SAT.getTime() - 24 * 3600_000).toISOString(), SAT)).toBe(true);
    expect(digestDue("daily", new Date(SAT.getTime() - 3600_000).toISOString(), SAT)).toBe(false);
  });
});

describe("renderDigest", () => {
  it("puts critical first and counts carriers", () => {
    const m = renderDigest([alert(), alert({ dotNumber: "2", carrierName: "ZED", severity: "critical", title: "Authority lost" })], "weekly");
    expect(m.subject).toBe("FreightShield weekly digest: 2 changes across 2 carriers (1 critical)");
    expect(m.text.indexOf("Authority lost")).toBeLessThan(m.text.indexOf("Phone changed"));
  });
  it("escapes html", () => {
    expect(renderDigest([alert({ title: "<b>x</b>" })], "daily").html).not.toContain("<b>x</b>");
  });
});

function store(alerts: DigestAlert[], last: string | null = null) {
  const marked: string[] = [];
  const s: DigestStore = {
    digestRecipients: async () => [{ userId: "u1", email: "me@x.com", settings: { ...DEFAULT_SETTINGS, extraRecipients: ["t@x.com"] }, lastDigestAt: last }],
    alertsForUser: async () => alerts,
    markDigestSent: async (u) => { marked.push(u); },
  };
  return { s, marked };
}

describe("runDigests", () => {
  it("sends to the user and extras, then marks sent", async () => {
    const sent: string[] = [];
    const { s, marked } = store([alert()]);
    const r = await runDigests(s, FRI, async (m) => { sent.push(m.to); return true; });
    expect(sent).toEqual(["me@x.com", "t@x.com"]);
    expect(r.sent).toBe(2);
    expect(marked).toEqual(["u1"]);
  });
  it("does not mark sent when the main email fails, so the next run retries", async () => {
    const { s, marked } = store([alert()]);
    await runDigests(s, FRI, async () => false);
    expect(marked).toEqual([]);
  });
  it("advances the window without emailing when nothing changed", async () => {
    const sent: string[] = [];
    const { s, marked } = store([]);
    await runDigests(s, FRI, async (m) => { sent.push(m.to); return true; });
    expect(sent).toEqual([]);
    expect(marked).toEqual(["u1"]);
  });
  it("skips users who are not due", async () => {
    const { s, marked } = store([alert()]);
    const r = await runDigests(s, SAT, async () => true);
    expect(r.recipients).toBe(0);
    expect(marked).toEqual([]);
  });
});
