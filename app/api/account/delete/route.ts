import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/supabase-server";
import { getEngine, getMirrorEngine } from "@/lib/engine";

/**
 * RODO — right to be forgotten (core project principle: data sovereignty).
 * Deletes vectors (ours + Trek2Summit mirror), answers, profile, telemetry
 * link, consents, and the auth account itself.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  try {
    await getEngine(db).deleteProfile(user.id);
  } catch {}
  const mirror = getMirrorEngine();
  if (mirror) await mirror.deleteProfile(user.id).catch(() => {});

  await db.from("onboarding_answers").delete().eq("user_id", user.id);
  await db.from("consents").delete().eq("user_id", user.id);
  // telemetry: keep events but sever the person (anonymize), per data minimization
  await db.from("telemetry_events").update({ user_id: null }).eq("user_id", user.id);
  await db.from("profiles").delete().eq("user_id", user.id);
  await db.auth.admin.deleteUser(user.id).catch(() => {});

  return NextResponse.json({ ok: true });
}
