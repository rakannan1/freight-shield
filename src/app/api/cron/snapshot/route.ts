import { NextResponse } from "next/server";
import { runDigests } from "@/lib/alerts/digest";
import { getProvider } from "@/lib/fmcsa";
import { runSnapshotJob } from "@/lib/job/snapshot-job";
import { SupabaseStore } from "@/lib/job/supabase-store";
import { serviceClient } from "@/lib/supabase";

export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const store = new SupabaseStore(serviceClient());
  const result = await runSnapshotJob({ store, provider: getProvider() });
  // Digests run after the snapshots so today's changes are included. A digest problem must not hide the job result.
  const digests = await runDigests(store).catch((e) => ({ recipients: 0, sent: 0, errors: [(e as Error).message] }));
  return NextResponse.json({ ...result, digests });
}
