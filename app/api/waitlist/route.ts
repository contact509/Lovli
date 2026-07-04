import { getSupabaseAdmin } from "@/lib/supabase";

export const dynamic = "force-dynamic";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Waitlist signup from the homepage. Body: { email, website? }.
 * `website` is a honeypot — real users never fill it.
 */
export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "invalid json" }, { status: 400 });
  }

  // honeypot: pretend success so bots move on
  if (typeof body.website === "string" && body.website.trim() !== "") {
    return Response.json({ ok: true });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return Response.json({ error: "invalid email" }, { status: 422 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return Response.json({ error: "server not configured" }, { status: 503 });
  }

  const { error } = await supabase.from("waitlist").insert({ email, source: "homepage" });
  // duplicate signup = still a success for the visitor
  if (error && error.code !== "23505") {
    return Response.json({ error: "storage error" }, { status: 500 });
  }
  return Response.json({ ok: true });
}
