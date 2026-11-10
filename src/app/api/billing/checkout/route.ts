import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { billingEnabled, siteUrl, stripeClient } from "@/lib/billing";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Starts a Stripe Checkout session for the signed-in user and redirects to it. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.redirect(new URL("/login", siteUrl()), 303);
  if (!billingEnabled()) return NextResponse.json({ error: "Billing is not configured." }, { status: 400 });

  const stripe = stripeClient();
  const db = serviceClient();

  // Reuse the user's Stripe customer so repeat checkouts stay on one billing record.
  const { data: existing } = await db
    .from("subscriptions")
    .select("stripe_customer_id,status")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existing && (existing.status === "active" || existing.status === "trialing")) {
    return NextResponse.redirect(new URL("/dashboard", siteUrl()), 303);
  }

  let customerId = existing?.stripe_customer_id as string | null | undefined;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { user_id: user.id },
    });
    customerId = customer.id;
    const { error } = await db
      .from("subscriptions")
      .upsert({ user_id: user.id, stripe_customer_id: customerId }, { onConflict: "user_id" });
    if (error) throw error;
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: user.id,
    line_items: [{ price: process.env.STRIPE_PRICE_ID!, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id } },
    allow_promotion_codes: true,
    success_url: `${siteUrl()}/dashboard?billing=success`,
    cancel_url: `${siteUrl()}/dashboard?billing=cancelled`,
  });

  if (!session.url) return NextResponse.json({ error: "Could not start checkout." }, { status: 502 });
  return NextResponse.redirect(session.url, 303);
}
