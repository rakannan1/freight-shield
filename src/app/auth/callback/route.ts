import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase-user";

export const dynamic = "force-dynamic";

/** Completes the magic-link sign-in: swaps the one-time code for a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=1", url.origin));

  const { error } = await (await userClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=1", url.origin));
  return NextResponse.redirect(new URL("/dashboard", url.origin));
}
