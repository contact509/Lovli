export const dynamic = "force-dynamic";

export async function GET() {
  return Response.json({
    ok: true,
    service: "lovli",
    supabase_configured: Boolean(
      process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY,
    ),
    token_configured: Boolean(process.env.LOVLI_WEBHOOK_TOKEN),
    ts: new Date().toISOString(),
  });
}
