import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { PortraitView } from "@/components/portal/PortraitView";
import type { Portrait } from "@/lib/portrait";

export const dynamic = "force-dynamic";

export default async function PoznajSiebiePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/poznaj-siebie");
  const db = getSupabaseAdmin();
  if (!db) redirect("/");

  const { data: profile } = await db
    .from("profiles").select("onboarding_completed_at").eq("user_id", user.id).maybeSingle();
  if (!profile) redirect("/register");
  if (!profile.onboarding_completed_at) redirect("/onboarding");

  const { data: row } = await db
    .from("portraits").select("content").eq("user_id", user.id).maybeSingle();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-serif-display)", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 600 }}>
          Poznaj siebie
        </h1>
        <p style={{ margin: 0, font: "var(--type-body)", color: "var(--text-secondary)" }}>
          Twój portret wartości — napisany na podstawie wszystkich odpowiedzi z onboardingu.
          Zanim poznasz innych, poznaj siebie.
        </p>
      </div>
      <PortraitView initial={(row?.content as Portrait) ?? null} />
    </div>
  );
}
