import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/supabase-server";
import { QUESTIONS } from "@/lib/onboarding/questions";
import { buildUserPayload, type Answers } from "@/lib/onboarding/payload";
import { getEngine, getMirrorEngine } from "@/lib/engine";

/**
 * Final onboarding submit: raw answers → engine payload (exact ENGINE_SPEC
 * format) → vector store (our engine) → optional mirror to Trek2Summit.
 * Open questions (OPQ_01/02) stay in onboarding_answers only.
 */
export async function POST() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  const { data: rows } = await db
    .from("onboarding_answers")
    .select("code, value_num, value_text, value_list")
    .eq("user_id", user.id);

  const answers: Answers = {};
  for (const r of rows ?? []) {
    answers[r.code] = (r.value_list ?? r.value_text ?? r.value_num) as Answers[string];
  }

  // Completeness: every non-conditional slider/choice answered (conditional
  // GOAL_07 + free text excluded). Open questions required by design — they
  // feed "Poznaj siebie", not the engine.
  const missing: string[] = [];
  for (const q of Object.values(QUESTIONS)) {
    if (q.code === "PAS_TEXT") continue;
    if (q.showIf?.in) {
      const gate = answers[q.showIf.code];
      if (typeof gate !== "number" || !q.showIf.in.includes(gate)) continue;
    }
    const v = answers[q.code];
    if (v === undefined || v === null || (typeof v === "string" && !v.trim())) missing.push(q.code);
  }
  if (missing.length) {
    return NextResponse.json({ error: "incomplete", missing }, { status: 422 });
  }

  const payload = buildUserPayload(user.id, answers, new Date().toISOString());

  try {
    await getEngine(db).upsertProfile(payload);
  } catch {
    return NextResponse.json({ error: "vector persist failed" }, { status: 500 });
  }

  await db
    .from("profiles")
    .update({ onboarding_completed_at: new Date().toISOString() })
    .eq("user_id", user.id);

  // Mirror to Trek2Summit when their endpoints exist (env-gated); never blocks.
  const mirror = getMirrorEngine();
  if (mirror) {
    mirror.upsertProfile(payload).catch(() => {});
  }

  await db.from("telemetry_events").insert({
    user_id: user.id, event: "onboarding_completed", screen: "onboarding",
    props: { questions: Object.keys(answers).length },
  });

  return NextResponse.json({ ok: true });
}
