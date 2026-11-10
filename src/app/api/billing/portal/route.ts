import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { billingEnabled, siteUrl, stripeClient } from "@/lib/billing";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/** Sends the signed-in user to the Stripe billing portal to update their card or cancel. */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.redirect(new URL("/login", siteUrl()), 303);
  if (!billingEnabled()) return NextResponse.json({ error: "Billing is not configured." }, { status: 400 });

  const { data } = await serviceClient()
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("user_id", user.id)
    .maybeSingle();
  const customerId = data?.stripe_customer_id as string | undefined;
  if (!customerId) return NextResponse.redirect(new URL("/dashboard", siteUrl()), 303);

  const session = await stripeClient().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${siteUrl()}/dashboard`,
  });
  return NextResponse.redirect(session.url, 303);
}
