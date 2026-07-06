import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/supabase-server";

/**
 * POST /api/profile — create the Lovli-side profile after auth signup.
 * Gender/seeking/birth year NEVER enter the engine payload — they are portal
 * data used for mutual-preference filtering. Research consent is required
 * (the app is a research instrument — good-way.org hypotheses).
 */
export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  let body: {
    display_name?: string; gender?: string; seeking?: string;
    birth_year?: number; research_consent?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const display_name = (body.display_name ?? "").trim().slice(0, 60);
  const { gender, seeking } = body;
  if (!display_name) return NextResponse.json({ error: "display_name required" }, { status: 422 });
  if (gender !== "male" && gender !== "female")
    return NextResponse.json({ error: "gender must be male|female" }, { status: 422 });
  if (seeking !== "male" && seeking !== "female")
    return NextResponse.json({ error: "seeking must be male|female" }, { status: 422 });
  if (!body.research_consent)
    return NextResponse.json({ error: "research consent required" }, { status: 422 });
  const birth_year = Number.isInteger(body.birth_year) ? body.birth_year : null;
  if (birth_year !== null && (birth_year! < 1920 || birth_year! > new Date().getFullYear() - 18))
    return NextResponse.json({ error: "you must be 18+" }, { status: 422 });

  const { error } = await db.from("profiles").upsert({
    user_id: user.id, display_name, gender, seeking, birth_year,
  });
  if (error) return NextResponse.json({ error: "persist failed" }, { status: 500 });

  await db.from("consents").upsert({
    user_id: user.id, consent_type: "research", version: "1.0", granted: true,
  });

  return NextResponse.json({ ok: true });
}

/** GET /api/profile — own profile (for routing decisions client-side). */
export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });
  const { data } = await db
    .from("profiles")
    .select("display_name, gender, seeking, birth_year, onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  return NextResponse.json({ profile: data ?? null });
}
