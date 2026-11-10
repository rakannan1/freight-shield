import { NextResponse } from "next/server";
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

  const result = await runSnapshotJob({
    store: new SupabaseStore(serviceClient()),
    provider: getProvider(),
  });
  return NextResponse.json(result);
}
