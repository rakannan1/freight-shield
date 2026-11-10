import { describe, expect, it, vi } from "vitest";
import type { AlertEmail } from "@/lib/alerts/email";
import { FIXTURES, MockProvider } from "@/lib/fmcsa/mock";
import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import type { Finding } from "@/lib/rules/detect";
import { runSnapshotJob, type Store } from "./snapshot-job";

class MemoryStore implements Store {
  snapshots = new Map<string, CarrierSnapshot[]>();
  alerts: { dot: string; finding: Finding }[] = [];
  deliveries: { alertId: string; userId: string; emailed: boolean }[] = [];
  constructor(
    private dots: string[],
    private watchers = [{ userId: "u1", email: "broker@example.com" }],
  ) {}
  async listWatchedDotNumbers() {
    return this.dots;
  }
  async latestSnapshot(dot: string) {
    return this.snapshots.get(dot)?.at(-1) ?? null;
  }
  async saveSnapshot(dot: string, s: CarrierSnapshot) {
    this.snapshots.set(dot, [...(this.snapshots.get(dot) ?? []), s]);
  }
  async saveAlert(dot: string, finding: Finding) {
    this.alerts.push({ dot, finding });
    return `a${this.alerts.length}`;
  }
  async watchersOf() {
    return this.watchers;
  }
  async recordDelivery(alertId: string, userId: string, emailed: boolean) {
    this.deliveries.push({ alertId, userId, emailed });
  }
}

const fresh = () => new MockProvider(structuredClone(FIXTURES));
const noSummary = async (_n: string, f: Finding[]) => `summary of ${f.length}`;

describe("runSnapshotJob", () => {
  it("stores a baseline on first run and sends no alerts", async () => {
    const store = new MemoryStore(["1000001"]);
    const send = vi.fn(async (_a: AlertEmail) => true);
    const r = await runSnapshotJob({ store, provider: fresh(), summarize: noSummary, send });
    expect(r).toMatchObject({ carriers: 1, alerts: 0, emailsSent: 0 });
    expect(store.snapshots.get("1000001")).toHaveLength(1);
    expect(send).not.toHaveBeenCalled();
  });

  it("alerts and emails the watcher when something changes between runs", async () => {
    const store = new MemoryStore(["1000001"]);
    const provider = fresh();
    const send = vi.fn(async (_a: AlertEmail) => true);
    await runSnapshotJob({ store, provider, summarize: noSummary, send });

    provider.set("1000001", { bipdOnFile: 0, commonAuthority: "I" });
    const r = await runSnapshotJob({ store, provider, summarize: noSummary, send });

    expect(r.alerts).toBeGreaterThanOrEqual(2);
    expect(r.emailsSent).toBe(1);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0]).toMatchObject({ to: "broker@example.com", dotNumber: "1000001" });
    expect(store.alerts.every((a) => a.dot === "1000001")).toBe(true);
    expect(store.deliveries).toHaveLength(r.alerts);
    expect(store.deliveries.every((d) => d.emailed)).toBe(true);
  });

  it("does not alert when nothing changed", async () => {
    const store = new MemoryStore(["1000001"]);
    const provider = fresh();
    const send = vi.fn(async (_a: AlertEmail) => true);
    await runSnapshotJob({ store, provider, summarize: noSummary, send });
    const r = await runSnapshotJob({ store, provider, summarize: noSummary, send });
    expect(r.alerts).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("records unknown carriers and keeps going when one carrier errors", async () => {
    const store = new MemoryStore(["9999999", "1000002", "1000001"]);
    const provider = fresh();
    const original = provider.getCarrierByDot.bind(provider);
    provider.getCarrierByDot = async (dot: string) => {
      if (dot === "1000002") throw new Error("FMCSA 500");
      return original(dot);
    };
    const r = await runSnapshotJob({ store, provider, summarize: noSummary, send: async () => true });
    expect(r.notFound).toEqual(["9999999"]);
    expect(r.errors).toEqual([{ dotNumber: "1000002", message: "FMCSA 500" }]);
    expect(r.carriers).toBe(1);
  });

  it("records a delivery as not emailed when sending is a dry run", async () => {
    const store = new MemoryStore(["1000001"]);
    const provider = fresh();
    await runSnapshotJob({ store, provider, summarize: noSummary, send: async () => false });
    provider.set("1000001", { allowedToOperate: false });
    const r = await runSnapshotJob({ store, provider, summarize: noSummary, send: async () => false });
    expect(r.emailsSent).toBe(0);
    expect(store.deliveries.every((d) => !d.emailed)).toBe(true);
  });
});
