import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { User } from "@supabase/supabase-js";

/** Cookie-session Supabase client for Server Components and Route Handlers. */
export async function getSupabaseServer() {
  const store = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => store.getAll(),
        setAll: (all) => {
          try {
            all.forEach(({ name, value, options }) => store.set(name, value, options));
          } catch {
            // Server Components can't set cookies — middleware refreshes the session
          }
        },
      },
    }
  );
}

/** Authenticated user from the request cookies, or null. */
export async function getSessionUser(): Promise<User | null> {
  const sb = await getSupabaseServer();
  const { data } = await sb.auth.getUser();
  return data.user ?? null;
}
