import { redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { fromRow } from "@/lib/alerts/settings";
import { smsConfigured } from "@/lib/alerts/sms";
import { billingEnabled, getSubscription, isActiveStatus } from "@/lib/billing";
import { userClient } from "@/lib/supabase-user";
import SettingsForm from "./SettingsForm";

export const metadata = { title: "Alert settings | FreightShield" };
export const dynamic = "force-dynamic";

function billingLine(status: string, periodEnd: string | null): string {
  if (!billingEnabled()) return "Billing isn't switched on for this site yet.";
  if (status === "trialing" && periodEnd) {
    const days = Math.max(0, Math.ceil((Date.parse(periodEnd) - Date.now()) / 86_400_000));
    return `Trial ends in ${days} day${days === 1 ? "" : "s"}, then $25/month. Cancel anytime.`;
  }
  if (isActiveStatus(status)) return "Subscription active: $25/month. Cancel anytime.";
  return "No active subscription. Subscribe to keep monitoring and alerts running.";
}

export default async function SettingsPage() {
  const db = await userClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: row }, sub] = await Promise.all([
    db.from("alert_settings").select("*").eq("user_id", user.id).maybeSingle(),
    getSubscription(db, user.id),
  ]);

  return (
    <div className="shell">
      <AppHeader email={user.email} active="settings" />
      <main className="wrap page">
        <SettingsForm
          initial={fromRow(row)}
          smsAvailable={smsConfigured()}
          billing={{
            line: billingLine(sub.status, sub.currentPeriodEnd),
            enforced: billingEnabled(),
            subscribed: isActiveStatus(sub.status),
            hasCustomer: sub.hasCustomer,
          }}
        />
      </main>
    </div>
  );
}
