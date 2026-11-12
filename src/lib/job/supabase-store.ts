import type { SupabaseClient } from "@supabase/supabase-js";
import { billingEnabled } from "@/lib/billing";
import type { CarrierSnapshot } from "@/lib/fmcsa/types";
import type { Finding } from "@/lib/rules/detect";
import type { DigestAlert, DigestRecipient, DigestStore } from "@/lib/alerts/digest";
import { fromRow } from "@/lib/alerts/settings";
import type { Store, Watcher } from "./snapshot-job";

export class SupabaseStore implements Store, DigestStore {
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

    const settings = await this.settingsFor(rows.map((r) => r.user_id));
    const out: Watcher[] = [];
    for (const row of rows) {
      const { data: u } = await this.db.auth.admin.getUserById(row.user_id);
      if (u?.user?.email) {
        out.push({ userId: row.user_id, email: u.user.email, settings: fromRow(settings.get(row.user_id)) });
      }
    }
    return out;
  }

  private async settingsFor(userIds: string[]): Promise<Map<string, Record<string, unknown>>> {
    const map = new Map<string, Record<string, unknown>>();
    if (!userIds.length) return map;
    const { data, error } = await this.db.from("alert_settings").select("*").in("user_id", userIds);
    if (error) throw error;
    for (const row of data ?? []) map.set(row.user_id as string, row);
    return map;
  }

  async digestRecipients(): Promise<DigestRecipient[]> {
    const ids = [...new Set((await this.activeWatches()).map((r) => r.user_id))];
    const settings = await this.settingsFor(ids);
    const out: DigestRecipient[] = [];
    for (const id of ids) {
      const { data: u } = await this.db.auth.admin.getUserById(id);
      if (!u?.user?.email) continue;
      const row = settings.get(id);
      out.push({
        userId: id,
        email: u.user.email,
        settings: fromRow(row),
        lastDigestAt: (row?.last_digest_at as string) ?? null,
      });
    }
    return out;
  }

  async alertsForUser(userId: string, sinceIso: string): Promise<DigestAlert[]> {
    const dots = (await this.activeWatches()).filter((r) => r.user_id === userId).map((r) => r.dot_number);
    if (!dots.length) return [];
    const [alerts, carriers] = await Promise.all([
      this.db
        .from("alerts")
        .select("dot_number,severity,title,detail,created_at")
        .in("dot_number", dots)
        .gt("created_at", sinceIso)
        .order("created_at", { ascending: false })
        .limit(500),
      this.db.from("carriers").select("dot_number,legal_name").in("dot_number", dots),
    ]);
    if (alerts.error) throw alerts.error;
    if (carriers.error) throw carriers.error;
    const names = new Map((carriers.data ?? []).map((c) => [c.dot_number as string, (c.legal_name as string) || ""]));
    return (alerts.data ?? []).map((a) => ({
      dotNumber: a.dot_number as string,
      carrierName: names.get(a.dot_number as string) || `DOT ${a.dot_number}`,
      severity: a.severity as DigestAlert["severity"],
      title: a.title as string,
      detail: a.detail as string,
      createdAt: a.created_at as string,
    }));
  }

  async markDigestSent(userId: string, atIso: string): Promise<void> {
    const { error } = await this.db
      .from("alert_settings")
      .upsert({ user_id: userId, last_digest_at: atIso }, { onConflict: "user_id" });
    if (error) throw error;
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
