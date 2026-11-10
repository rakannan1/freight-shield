import type { SupabaseClient } from "@supabase/supabase-js";

/** The parts of a Stripe subscription we read. A real Stripe.Subscription satisfies this. */
export interface SubLike {
  id: string;
  status: string;
  customer: string | { id: string };
  items?: { data: { current_period_end?: number | null }[] };
  metadata?: Record<string, string> | null;
}

export interface SubscriptionRow {
  stripe_customer_id: string;
  stripe_subscription_id: string;
  status: string;
  current_period_end: string | null;
}

export const customerIdOf = (sub: SubLike): string =>
  typeof sub.customer === "string" ? sub.customer : sub.customer.id;

/** Stripe keeps the period end on each subscription item; use the latest one. */
export function periodEndOf(sub: SubLike): string | null {
  const ends = (sub.items?.data ?? [])
    .map((i) => i.current_period_end)
    .filter((n): n is number => typeof n === "number");
  return ends.length ? new Date(Math.max(...ends) * 1000).toISOString() : null;
}

export function subscriptionRow(sub: SubLike): SubscriptionRow {
  return {
    stripe_customer_id: customerIdOf(sub),
    stripe_subscription_id: sub.id,
    status: sub.status,
    current_period_end: periodEndOf(sub),
  };
}

/**
 * Writes a subscription's state to the subscriptions table (service-role client).
 * The user is found from the subscription metadata we set at checkout, then the hint,
 * then any row already linked to the Stripe customer. Returns false if no user matches.
 */
export async function syncSubscription(
  db: SupabaseClient,
  sub: SubLike,
  userIdHint?: string | null,
): Promise<boolean> {
  const row = subscriptionRow(sub);
  let userId = sub.metadata?.user_id || userIdHint || null;

  if (!userId) {
    const { data } = await db
      .from("subscriptions")
      .select("user_id")
      .eq("stripe_customer_id", row.stripe_customer_id)
      .maybeSingle();
    userId = (data?.user_id as string | undefined) ?? null;
  }
  if (!userId) return false;

  const { error } = await db
    .from("subscriptions")
    .upsert({ user_id: userId, ...row, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  return true;
}
