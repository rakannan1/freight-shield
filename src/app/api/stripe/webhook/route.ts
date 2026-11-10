import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { stripeClient } from "@/lib/billing";
import { syncSubscription } from "@/lib/stripe-sync";
import { serviceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Keeps the subscriptions table in step with Stripe. Configure the endpoint in Stripe with these events:
 * checkout.session.completed, customer.subscription.created, customer.subscription.updated,
 * customer.subscription.deleted.
 */
export async function POST(req: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const signature = req.headers.get("stripe-signature");
  if (!secret || !signature) return NextResponse.json({ error: "not configured" }, { status: 400 });

  const stripe = stripeClient();
  const raw = await req.text(); // the signature covers the exact raw body

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret);
  } catch {
    return NextResponse.json({ error: "invalid signature" }, { status: 400 });
  }

  const db = serviceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const subId = typeof session.subscription === "string" ? session.subscription : session.subscription?.id;
      if (subId) {
        const sub = await stripe.subscriptions.retrieve(subId);
        await syncSubscription(db, sub, session.client_reference_id);
      }
      break;
    }
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      await syncSubscription(db, event.data.object as Stripe.Subscription);
      break;
    }
    default:
      break; // other events are acknowledged and ignored
  }

  return NextResponse.json({ received: true });
}
