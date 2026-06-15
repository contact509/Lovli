import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Read collected vectorization confirmations (for testing/monitoring).
 * Auth: same shared secret in X-Lovli-Token. Returns most recent rows.
 * Query: ?limit=50 (max 200), ?user_id=<id> to filter.
 */
export async function GET(req: Request) {
  const expected = process.env.LOVLI_WEBHOOK_TOKEN;
  if (!expected) {
    return Response.json({ error: "server not configured" }, { status: 503 });
  }
  if (req.headers.get("x-lovli-token") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "database not configured" }, { status: 503 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const userId = url.searchParams.get("user_id");

  let query = supabase
    .from("vectorization_callbacks")
    .select("id,user_id,vector_id,status,indexed_at,received_at")
    .order("received_at", { ascending: false })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);

  const { data, error, count } = await query;
  if (error) {
    return Response.json({ error: "query failed", detail: error.message }, { status: 500 });
  }
  return Response.json({ count: count ?? data?.length ?? 0, rows: data ?? [] });
}
