import type { SupabaseClient } from "@supabase/supabase-js";
import { billingEnabled } from "@/lib/billing";
import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import type { Finding } from "@/lib/rules/detect";
import type { Store, Watcher } from "./snapshot-job";

export class SupabaseStore implements Store {
  constructor(private db: SupabaseClient) {}

  /** User ids with an active or trialing subscription, or null when billing is not enforced. */
  private async paidUserIds(): Promise<Set<string> | null> {
    if (!billingEnabled()) return null;
    const { data, error } = await this.db
      .from("subscriptions")
      .select("user_id")
      .in("status", ["active", "trialing"]);
    if (error) throw error;
    return new Set((data ?? []).map((r) => r.user_id as string));
  }

  private async activeWatches(): Promise<{ user_id: string; dot_number: string }[]> {
    const { data, error } = await this.db.from("watches").select("user_id,dot_number").eq("active", true);
    if (error) throw error;
    const paid = await this.paidUserIds();
    const rows = (data ?? []) as { user_id: string; dot_number: string }[];
    return paid ? rows.filter((r) => paid.has(r.user_id)) : rows;
  }

  async listWatchedDotNumbers(): Promise<string[]> {
    return [...new Set((await this.activeWatches()).map((r) => r.dot_number))];
  }

  async latestSnapshot(dotNumber: string): Promise<CarrierSnapshot | null> {
    const { data, error } = await this.db
      .from("snapshots")
      .select("data")
      .eq("dot_number", dotNumber)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;
    return (data?.data as CarrierSnapshot) ?? null;
  }

  async saveSnapshot(dotNumber: string, snapshot: CarrierSnapshot): Promise<void> {
    const { error } = await this.db.from("snapshots").insert({ dot_number: dotNumber, data: snapshot });
    if (error) throw error;
  }

  async saveAlert(dotNumber: string, f: Finding): Promise<string> {
    const { data, error } = await this.db
      .from("alerts")
      .insert({
        dot_number: dotNumber,
        rule: f.rule,
        severity: f.severity,
        title: f.title,
        detail: f.detail,
        before_value: f.before ?? null,
        after_value: f.after ?? null,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  }

  async watchersOf(dotNumber: string): Promise<Watcher[]> {
    const rows = (await this.activeWatches()).filter((r) => r.dot_number === dotNumber);

    const out: Watcher[] = [];
    for (const row of rows) {
      const { data: u } = await this.db.auth.admin.getUserById(row.user_id);
      if (u?.user?.email) out.push({ userId: row.user_id, email: u.user.email });
    }
    return out;
  }

  async recordDelivery(alertId: string, userId: string, emailed: boolean, summary: string): Promise<void> {
    const { error } = await this.db.from("alert_deliveries").upsert(
      {
        alert_id: alertId,
        user_id: userId,
        emailed_at: emailed ? new Date().toISOString() : null,
        summary,
      },
      { onConflict: "alert_id,user_id" },
    );
    if (error) throw error;
  }
}
