import { describe, expect, it } from "vitest";
import { FIXTURES } from "@/lib/fmcsa/mock";
import { buildDashboard, changesFor, type AlertRow } from "./model";

const snap1 = FIXTURES["1000001"];
const snap2 = FIXTURES["1000002"];

const watches = [
  { dot_number: "1000001", carriers: { legal_name: "ACME HAULING LLC", mc_number: null } },
  { dot_number: "1000002", carriers: { legal_name: "BLUE RIDGE FREIGHT INC", mc_number: null } },
];
const snapshots = [
  { dot_number: "1000001", data: snap1, fetched_at: "2026-10-22T11:00:00Z" },
  { dot_number: "1000002", data: snap2, fetched_at: "2026-10-22T11:01:00Z" },
];

const alert = (over: Partial<AlertRow>): AlertRow => ({
  id: "a1",
  dot_number: "1000001",
  rule: "insurance_dropped",
  severity: "critical",
  title: "Liability insurance dropped off for ACME HAULING LLC",
  detail: "Liability insurance on file went from $1,000,000 to $0.",
  before_value: 1_000_000,
  after_value: 0,
  created_at: "2026-10-22T11:02:00Z",
  ...over,
});

const base = { watches, snapshots, alerts: [], deliveries: [], reviewedAlertIds: [] };

describe("buildDashboard", () => {
  it("shows a clean watchlist when there are no alerts", () => {
    const m = buildDashboard(base);
    expect(m.stats).toEqual({ watched: 2, openAlerts: 0, critical: 0, lastCheckAt: "2026-10-22T11:01:00Z" });
    expect(m.groups).toEqual([]);
    expect(m.rows.every((r) => r.status === "ok" && r.lastChangeAt === null)).toBe(true);
    expect(m.rows[0]).toMatchObject({ authority: "Common, Contract", insurance: "$1,000,000" });
  });

  it("groups findings from the same run into one card and uses the worst severity", () => {
    const alerts = [
      alert({ id: "a1", rule: "address_changed", severity: "warning", title: "Address changed", before_value: "A", after_value: "B" }),
      alert({ id: "a2" }),
    ];
    const deliveries = [
      { alert_id: "a1", summary: "Same run summary" },
      { alert_id: "a2", summary: "Same run summary" },
    ];
    const m = buildDashboard({ ...base, alerts, deliveries });
    expect(m.groups).toHaveLength(1);
    expect(m.groups[0]).toMatchObject({
      severity: "critical",
      summary: "Same run summary",
      alertIds: ["a2", "a1"],
    });
    expect(m.groups[0].title).toMatch(/\(\+1 more\)$/);
    expect(m.groups[0].changes.map((c) => c.label)).toEqual(["Liability insurance on file", "Address"]);
  });

  it("keeps separate runs as separate cards", () => {
    const alerts = [
      alert({ id: "a1" }),
      alert({ id: "a2", created_at: "2026-10-23T11:02:00Z" }),
    ];
    const deliveries = [
      { alert_id: "a1", summary: "run one" },
      { alert_id: "a2", summary: "run two" },
    ];
    expect(buildDashboard({ ...base, alerts, deliveries }).groups).toHaveLength(2);
  });

  it("counts open and critical alerts and marks table rows", () => {
    const alerts = [
      alert({ id: "a1" }),
      alert({ id: "a2", dot_number: "1000002", rule: "address_changed", severity: "warning", title: "Address changed", before_value: "A", after_value: "B" }),
    ];
    const m = buildDashboard({ ...base, alerts });
    expect(m.stats).toMatchObject({ openAlerts: 2, critical: 1 });
    expect(m.rows.map((r) => [r.dot, r.status])).toEqual([
      ["1000001", "critical"],
      ["1000002", "warning"],
    ]);
  });

  it("moves reviewed alerts out of the open count and row status but keeps last change", () => {
    const m = buildDashboard({ ...base, alerts: [alert({ id: "a1" })], reviewedAlertIds: ["a1"] });
    expect(m.stats).toMatchObject({ openAlerts: 0, critical: 0 });
    expect(m.groups[0].reviewed).toBe(true);
    const row = m.rows.find((r) => r.dot === "1000001")!;
    expect(row.status).toBe("ok");
    expect(row.lastChangeAt).toBe("2026-10-22T11:02:00Z");
  });

  it("ignores alerts for carriers the user no longer watches", () => {
    const m = buildDashboard({ ...base, alerts: [alert({ dot_number: "9999999" })] });
    expect(m.groups).toEqual([]);
  });

  it("falls back to the finding detail when no email summary was stored", () => {
    const m = buildDashboard({ ...base, alerts: [alert({})] });
    expect(m.groups[0].summary).toBe("Liability insurance on file went from $1,000,000 to $0.");
  });

  it("sorts critical groups before warnings", () => {
    const alerts = [
      alert({ id: "w", dot_number: "1000002", severity: "warning", rule: "address_changed", before_value: "A", after_value: "B", created_at: "2026-10-23T00:00:00Z" }),
      alert({ id: "c" }),
    ];
    expect(buildDashboard({ ...base, alerts }).groups.map((g) => g.severity)).toEqual(["critical", "warning"]);
  });
});

describe("changesFor", () => {
  it("splits an identity change into name and address", () => {
    const c = changesFor(
      alert({
        rule: "identity_change",
        before_value: { legalName: "OLD LLC", address: "1 A ST" },
        after_value: { legalName: "NEW LLC", address: "2 B ST" },
      }),
    );
    expect(c).toEqual([
      { label: "Legal name", before: "OLD LLC", after: "NEW LLC" },
      { label: "Address", before: "1 A ST", after: "2 B ST" },
    ]);
  });

  it("formats insurance as dollars, authority codes as words and nulls as none", () => {
    expect(changesFor(alert({}))[0]).toMatchObject({ before: "$1,000,000", after: "$0" });
    expect(
      changesFor(alert({ rule: "authority_lost", before_value: "A", after_value: "I" }))[0],
    ).toMatchObject({ before: "Active", after: "Inactive" });
    expect(
      changesFor(alert({ rule: "out_of_service", before_value: null, after_value: "2026-10-01" }))[0],
    ).toMatchObject({ before: "none", after: "2026-10-01" });
  });
});
