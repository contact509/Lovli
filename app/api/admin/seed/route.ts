import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEngine } from "@/lib/engine";
import type { EnginePayload } from "@/lib/onboarding/payload";

/**
 * Admin: bulk-upsert synthetic research personas (profiles + engine payloads).
 * Same X-Lovli-Token shared secret as the vectorization callback. Personas are
 * ALWAYS stored with is_test=true — the engine's mutual filter keeps them
 * invisible to real users (test matches test, real matches real).
 *
 * Goes through LocalEngine.upsertProfile — the exact code path real
 * onboarding submissions take, so seeded vectors are format-identical.
 */
export async function POST(req: Request) {
  const token = req.headers.get("x-lovli-token");
  if (!token || token !== process.env.LOVLI_WEBHOOK_TOKEN) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  let body: {
    users?: Array<{
      profile: { display_name: string; gender: "male" | "female"; seeking: "male" | "female"; birth_year?: number };
      payload: EnginePayload;
    }>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const users = (body.users ?? []).slice(0, 200);
  const engine = getEngine(db);
  let done = 0;
  for (const u of users) {
    if (!u?.payload?.user_id || !u?.profile?.gender) continue;
    const { error } = await db.from("profiles").upsert({
      user_id: u.payload.user_id,
      display_name: u.profile.display_name ?? "Persona",
      gender: u.profile.gender,
      seeking: u.profile.seeking,
      birth_year: u.profile.birth_year ?? null,
      is_test: true,
      onboarding_completed_at: new Date().toISOString(),
    });
    if (error) return NextResponse.json({ error: error.message, done }, { status: 500 });
    await engine.upsertProfile(u.payload);
    done++;
  }
  return NextResponse.json({ ok: true, seeded: done });
}
