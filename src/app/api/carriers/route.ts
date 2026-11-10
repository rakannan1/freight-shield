import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { canUseProduct } from "@/lib/billing";
import { getProvider } from "@/lib/fmcsa";
import { parseList } from "@/lib/identifiers";
import { serviceClient } from "@/lib/supabase";

export const maxDuration = 60;

const MAX_PER_REQUEST = 200;

/**
 * Add carriers to the signed-in user's watchlist.
 * Auth: the web app's cookie session, or `Authorization: Bearer <Supabase access token>`.
 * Body: { text: "MC-123456\nDOT 1234567, ..." }
 */
export async function POST(req: Request) {
  const user = await getRequestUser(req);
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = serviceClient();
  if (!(await canUseProduct(db, user.id))) {
    return NextResponse.json(
      { error: "An active subscription is required to add carriers.", code: "subscription_required" },
      { status: 402 },
    );
  }

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  if (!body?.text) return NextResponse.json({ error: "text is required" }, { status: 400 });

  const { ids, invalid } = parseList(body.text);
  if (ids.length > MAX_PER_REQUEST) {
    return NextResponse.json({ error: `max ${MAX_PER_REQUEST} carriers per request` }, { status: 400 });
  }

  const provider = getProvider();
  const added: { dotNumber: string; legalName: string }[] = [];
  const notFound: string[] = [];
  const failed: { input: string; message: string }[] = [];

  for (const id of ids) {
    const label = id.kind === "mc" ? `MC ${id.value}` : `DOT ${id.value}`;
    try {
      const dot = id.kind === "mc" ? await provider.resolveMcToDot(id.value) : id.value;
      const snap = dot ? await provider.getCarrierByDot(dot) : null;
      if (!dot || !snap) {
        notFound.push(label);
        continue;
      }

      await db.from("carriers").upsert(
        { dot_number: dot, mc_number: id.kind === "mc" ? id.value : null, legal_name: snap.legalName },
        { onConflict: "dot_number" },
      );
      await db
        .from("watches")
        .upsert({ user_id: user.id, dot_number: dot, active: true }, { onConflict: "user_id,dot_number" });

      // Baseline snapshot, so the first daily run can already detect changes.
      const { data: existing } = await db
        .from("snapshots")
        .select("id")
        .eq("dot_number", dot)
        .limit(1)
        .maybeSingle();
      if (!existing) await db.from("snapshots").insert({ dot_number: dot, data: snap });

      added.push({ dotNumber: dot, legalName: snap.legalName });
    } catch (e) {
      failed.push({ input: label, message: (e as Error).message });
    }
  }

  return NextResponse.json({ added, notFound, invalid, failed });
}
