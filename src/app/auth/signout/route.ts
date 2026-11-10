import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase-user";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  await (await userClient()).auth.signOut();
  return NextResponse.redirect(new URL("/", req.url), 303);
}
