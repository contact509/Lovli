import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { OnboardingQuiz } from "@/components/portal/OnboardingQuiz";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/onboarding");

  const db = getSupabaseAdmin();
  if (db) {
    const { data: profile } = await db
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile) redirect("/register"); // account without portal profile
    if (profile.onboarding_completed_at) redirect("/matches");
  }

  return <OnboardingQuiz />;
}
