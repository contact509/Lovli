import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSessionUser } from "@/lib/supabase-server";

/**
 * Research telemetry (good-way.org: retention, screen times, reveal moments,
 * drop-offs). Fire-and-forget from the client; anonymous events allowed.
 */
export async function POST(req: Request) {
  const db = getSupabaseAdmin();
  if (!db) return NextResponse.json({ error: "database not configured" }, { status: 503 });

  let body: { events?: Array<{ event?: string; screen?: string; session_id?: string; props?: unknown }> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  const events = (body.events ?? []).slice(0, 50);
  if (!events.length) return NextResponse.json({ ok: true });

  const user = await getSessionUser();
  const rows = events
    .filter((e) => typeof e.event === "string" && e.event.length <= 64)
    .map((e) => ({
      user_id: user?.id ?? null,
      session_id: typeof e.session_id === "string" ? e.session_id.slice(0, 64) : null,
      event: e.event as string,
      screen: typeof e.screen === "string" ? e.screen.slice(0, 64) : null,
      props: e.props ?? null,
    }));
  if (rows.length) await db.from("telemetry_events").insert(rows);
  return NextResponse.json({ ok: true });
}
