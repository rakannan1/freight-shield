import type { SupabaseClient } from "@supabase/supabase-js";
import Stripe from "stripe";

export const ACTIVE_STATUSES = ["active", "trialing"] as const;

/** Billing is only enforced once Stripe is configured, so local development works without it. */
export const billingEnabled = () => Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_PRICE_ID);

export const isActiveStatus = (status: string | null | undefined) =>
  ACTIVE_STATUSES.includes(status as (typeof ACTIVE_STATUSES)[number]);

export function stripeClient(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("STRIPE_SECRET_KEY is not set");
  return new Stripe(key);
}

export const siteUrl = () => (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");

export interface SubscriptionInfo {
  status: string;
  currentPeriodEnd: string | null;
  hasCustomer: boolean;
}

/** Reads the subscription row visible to `db` (a user client sees only its own row). */
export async function getSubscription(db: SupabaseClient, userId: string): Promise<SubscriptionInfo> {
  const { data } = await db
    .from("subscriptions")
    .select("status,current_period_end,stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();
  return {
    status: (data?.status as string) ?? "none",
    currentPeriodEnd: (data?.current_period_end as string) ?? null,
    hasCustomer: Boolean(data?.stripe_customer_id),
  };
}

/** True when the user may add carriers and receive alerts. Always true while billing is not configured. */
export async function canUseProduct(db: SupabaseClient, userId: string): Promise<boolean> {
  if (!billingEnabled()) return true;
  return isActiveStatus((await getSubscription(db, userId)).status);
}
