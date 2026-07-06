import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/supabase-server";
import { QUESTIONS } from "@/lib/onboarding/questions";

/**
 * Per-step autosave of raw onboarding answers. Raw answers are the research
 * source of truth (telemetry hypotheses need them); the engine payload is
 * compiled from them at submit.
 */

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  const { data } = await db
    .from("onboarding_answers")
    .select("code, value_num, value_text, value_list")
    .eq("user_id", user.id);

  const answers: Record<string, unknown> = {};
  for (const r of data ?? []) {
    answers[r.code] = r.value_list ?? r.value_text ?? r.value_num;
  }
  return NextResponse.json({ answers });
}

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  let body: { answers?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const entries = Object.entries(body.answers ?? {});
  if (!entries.length) return NextResponse.json({ ok: true, saved: 0 });

  const rows = [];
  for (const [code, value] of entries) {
    if (!QUESTIONS[code]) continue; // only known question codes
    const row: Record<string, unknown> = {
      user_id: user.id, code, value_num: null, value_text: null, value_list: null,
      answered_at: new Date().toISOString(),
    };
    if (typeof value === "number" && Number.isFinite(value)) row.value_num = Math.round(value);
    else if (typeof value === "string") row.value_text = value.slice(0, 2000);
    else if (Array.isArray(value)) row.value_list = value;
    else continue;
    rows.push(row);
  }
  if (rows.length) {
    const { error } = await db.from("onboarding_answers").upsert(rows);
    if (error) return NextResponse.json({ error: "persist failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, saved: rows.length });
}
