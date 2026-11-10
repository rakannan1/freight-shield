import type { User } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { userClient } from "@/lib/supabase-user";

/** Resolves the caller from a Bearer token (API clients) or the cookie session (the web app). */
export async function getRequestUser(req: Request): Promise<User | null> {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (token) {
    const { data, error } = await serviceClient().auth.getUser(token);
    return error ? null : data.user;
  }
  const { data } = await (await userClient()).auth.getUser();
  return data.user;
}
