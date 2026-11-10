import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { periodEndOf, subscriptionRow, syncSubscription, type SubLike } from "./stripe-sync";

const sub = (over: Partial<SubLike> = {}): SubLike => ({
  id: "sub_1",
  status: "active",
  customer: "cus_1",
  items: { data: [{ current_period_end: 1_795_000_000 }] },
  metadata: { user_id: "user-1" },
  ...over,
});

function fakeDb(existing: { user_id: string; stripe_customer_id: string }[] = [], upsertError: Error | null = null) {
  const upserts: Record<string, unknown>[] = [];
  const db = {
    from: () => ({
      select: () => ({
        eq: (_col: string, value: string) => ({
          maybeSingle: async () => ({ data: existing.find((r) => r.stripe_customer_id === value) ?? null }),
        }),
      }),
      upsert: async (row: Record<string, unknown>) => {
        upserts.push(row);
        return { error: upsertError };
      },
    }),
  } as unknown as SupabaseClient;
  return { db, upserts };
}

describe("subscriptionRow", () => {
  it("maps status, ids and the period end", () => {
    expect(subscriptionRow(sub())).toEqual({
      stripe_customer_id: "cus_1",
      stripe_subscription_id: "sub_1",
      status: "active",
      current_period_end: new Date(1_795_000_000 * 1000).toISOString(),
    });
  });

  it("accepts an expanded customer object and keeps canceled status", () => {
    const row = subscriptionRow(sub({ customer: { id: "cus_9" }, status: "canceled" }));
    expect(row).toMatchObject({ stripe_customer_id: "cus_9", status: "canceled" });
  });
});

describe("periodEndOf", () => {
  it("uses the latest item end, and null when there are none", () => {
    const s = sub({ items: { data: [{ current_period_end: 100 }, { current_period_end: 300 }, { current_period_end: null }] } });
    expect(periodEndOf(s)).toBe(new Date(300_000).toISOString());
    expect(periodEndOf(sub({ items: { data: [] } }))).toBeNull();
    expect(periodEndOf(sub({ items: undefined }))).toBeNull();
  });
});

describe("syncSubscription", () => {
  it("writes the row for the user named in the metadata", async () => {
    const { db, upserts } = fakeDb();
    expect(await syncSubscription(db, sub())).toBe(true);
    expect(upserts).toHaveLength(1);
    expect(upserts[0]).toMatchObject({ user_id: "user-1", status: "active", stripe_customer_id: "cus_1" });
  });

  it("falls back to the hint, then to a row already linked to the customer", async () => {
    const hinted = fakeDb();
    expect(await syncSubscription(hinted.db, sub({ metadata: {} }), "user-2")).toBe(true);
    expect(hinted.upserts[0]).toMatchObject({ user_id: "user-2" });

    const linked = fakeDb([{ user_id: "user-3", stripe_customer_id: "cus_1" }]);
    expect(await syncSubscription(linked.db, sub({ metadata: null }))).toBe(true);
    expect(linked.upserts[0]).toMatchObject({ user_id: "user-3" });
  });

  it("returns false and writes nothing when no user can be found", async () => {
    const { db, upserts } = fakeDb();
    expect(await syncSubscription(db, sub({ metadata: {} }))).toBe(false);
    expect(upserts).toHaveLength(0);
  });

  it("throws when the database write fails so Stripe retries the webhook", async () => {
    const { db } = fakeDb([], new Error("db down"));
    await expect(syncSubscription(db, sub())).rejects.toThrow("db down");
  });
});
