import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Keep-alive for the Lovli Supabase project (free tier).
 *
 * Free-tier projects auto-pause after ~7 days with no data-plane activity.
 * If that happens while we wait for Trek2Summit to call the vectorization
 * webhook, their callback would fail at the worst moment. A trivial daily
 * query (driven by Vercel Cron — see vercel.json) keeps the project ACTIVE
 * for free. Remove the cron once real traffic keeps the DB warm on its own.
 */
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json(
      { ok: false, reason: "database not configured" },
      { status: 503 },
    );
  }

  const { error } = await supabase
    .from("vectorization_callbacks")
    .select("id")
    .limit(1);

  if (error) {
    return Response.json(
      { ok: false, reason: "query failed", detail: error.message },
      { status: 500 },
    );
  }

  return Response.json({ ok: true, pinged: true, ts: new Date().toISOString() });
}
