"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { parseSettingsForm, toRow } from "@/lib/alerts/settings";
import { userClient } from "@/lib/supabase-user";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function requireUser() {
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  return { db, user };
}

/** Marks a card's findings as reviewed for the signed-in user. */
export async function markReviewed(formData: FormData): Promise<void> {
  const { db, user } = await requireUser();
  const ids = String(formData.get("ids") ?? "")
    .split(",")
    .filter((id) => UUID.test(id));
  if (ids.length) {
    await db
      .from("alert_reviews")
      .upsert(ids.map((alert_id) => ({ user_id: user.id, alert_id })), { onConflict: "user_id,alert_id" });
  }
  revalidatePath("/dashboard");
}

/** Stops watching a carrier. Past alerts stay in history but no longer show for this user. */
export async function removeCarrier(formData: FormData): Promise<void> {
  const { db, user } = await requireUser();
  const dot = String(formData.get("dot") ?? "");
  if (/^\d{1,8}$/.test(dot)) {
    await db.from("watches").delete().eq("user_id", user.id).eq("dot_number", dot);
  }
  revalidatePath("/dashboard");
}

export type SettingsState = { ok: boolean; message: string };

/** Saves the signed-in user's alert settings. Row-level security limits the write to their own row. */
export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { db, user } = await requireUser();
  const parsed = parseSettingsForm(formData, user.email);
  if (!parsed.ok) return { ok: false, message: parsed.error };
  const { error } = await db
    .from("alert_settings")
    .upsert({ user_id: user.id, ...toRow(parsed.settings), updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) return { ok: false, message: "Couldn't save your settings. Please try again." };
  revalidatePath("/dashboard/settings");
  return { ok: true, message: "Settings saved." };
}
