import { NextResponse } from "next/server";
import { userClient } from "@/lib/supabase-user";

export const dynamic = "force-dynamic";

/** Completes magic-link, email-confirmation and password-reset sign-ins: swaps the one-time code for a session cookie. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=1", url.origin));

  const { error } = await (await userClient()).auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=1", url.origin));
  // `next` is only honoured for same-site paths, so the link cannot be used as an open redirect.
  const next = url.searchParams.get("next");
  const dest = next && /^\/(?!\/|\\)/.test(next) ? next : "/dashboard";
  return NextResponse.redirect(new URL(dest, url.origin));
}
