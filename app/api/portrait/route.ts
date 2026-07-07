import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/supabase-server";
import { getOrGeneratePortrait } from "@/lib/portrait";

// Claude generation can take tens of seconds — raise the function cap.
export const maxDuration = 60;

/** POST /api/portrait — generate (or return cached) "Poznaj siebie" portrait. */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  const { data: profile } = await db
    .from("profiles").select("onboarding_completed_at").eq("user_id", user.id).maybeSingle();
  if (!profile?.onboarding_completed_at) {
    return NextResponse.json({ error: "onboarding not completed" }, { status: 409 });
  }

  try {
    const { portrait, created } = await getOrGeneratePortrait(db, user.id);
    if (created) {
      await db.from("telemetry_events").insert({
        user_id: user.id, event: "portrait_generated", screen: "poznaj-siebie",
      });
    }
    return NextResponse.json({ portrait });
  } catch (e) {
    console.error("portrait generation failed:", e);
    return NextResponse.json({ error: "generation failed" }, { status: 502 });
  }
}
