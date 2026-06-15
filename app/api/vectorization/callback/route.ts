import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

/**
 * Return webhook for Trek2Summit (API_CONTRACT.md §3).
 * They POST here after indexing/updating a user vector; we persist the
 * confirmation. Auth: shared secret in the X-Lovli-Token header.
 *
 * Body: { user_id, vector_id, status: "indexed"|"updated"|"error", indexed_at?, error? }
 */
export async function POST(req: Request) {
  const expected = process.env.LOVLI_WEBHOOK_TOKEN;
  if (!expected) {
    return Response.json({ error: "server not configured" }, { status: 503 });
  }
  if (req.headers.get("x-lovli-token") !== expected) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  const userId = body.user_id;
  if (typeof userId !== "string" || !userId) {
    return Response.json({ error: "user_id required" }, { status: 422 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "database not configured" }, { status: 503 });
  }

  const { error } = await supabase.from("vectorization_callbacks").insert({
    user_id: userId,
    vector_id: typeof body.vector_id === "string" ? body.vector_id : null,
    status: typeof body.status === "string" ? body.status : "unknown",
    indexed_at: typeof body.indexed_at === "string" ? body.indexed_at : null,
    error: body.error ?? null,
    raw: body,
  });

  if (error) {
    return Response.json({ error: "persist failed", detail: error.message }, { status: 500 });
  }
  return Response.json({ ack: true });
}
