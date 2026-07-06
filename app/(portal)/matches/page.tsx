import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase-server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { computeMatches, computeSpace } from "@/lib/matching";
import type { MatchBreakdown } from "@/lib/engine/scoring";
import { MatchBadge, Card } from "@/components/ds";
import { DeleteAccountButton } from "@/components/portal/DeleteAccountButton";
import SpaceGraph from "@/components/portal/SpaceGraph";

export const dynamic = "force-dynamic";

const COMPONENT_LABELS: Array<[keyof MatchBreakdown, string]> = [
  ["values_alignment", "Wartości"],
  ["personality_alignment", "Osobowość"],
  ["goals_alignment", "Cele życiowe"],
  ["spiritual_alignment", "Duchowość"],
  ["dynamic_alignment", "Zgodność w interakcji"],
];

export default async function MatchesPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/matches");
  const db = getSupabaseAdmin();
  if (!db) redirect("/");

  const { data: profile } = await db
    .from("profiles")
    .select("display_name, onboarding_completed_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!profile) redirect("/register");
  if (!profile.onboarding_completed_at) redirect("/onboarding");

  // one scoring pass: top-20 for cards, full map feeds constellation hover %
  const all = await computeMatches(db, user.id, 500);
  const matches = all.slice(0, 20);
  const space = await computeSpace(
    db, user.id,
    Object.fromEntries(all.map((m) => [m.user_id, Math.round(m.match_score * 100)]))
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
      <div>
        <h1 style={{ margin: "0 0 8px", fontFamily: "var(--font-serif-display)", fontSize: "clamp(28px, 5vw, 40px)", fontWeight: 600 }}>
          Twoje dopasowania
        </h1>
        <p style={{ margin: 0, font: "var(--type-body)", color: "var(--text-secondary)" }}>
          Osoby najbliższe Twoim wartościom — bez zdjęć i imion. Tożsamość odsłania się
          dopiero wtedy, gdy oboje tego chcecie. Procent to zgodność wartości, nie wyglądu.
        </p>
      </div>

      {space && (
        <Card padding="var(--space-4)">
          <h2 style={{ margin: "4px 8px 2px", fontFamily: "var(--font-serif-display)", fontSize: "clamp(20px, 3.5vw, 26px)", fontWeight: 600 }}>
            Przestrzeń wartości
          </h2>
          <p style={{ margin: "0 8px 6px", font: "var(--type-caption)", color: "var(--text-secondary)" }}>
            Każdy punkt to prawdziwy profil wartości. Im bliżej Ciebie, tym większa zgodność.
            Przeciągnij, by obrócić; najedź na punkt, by zobaczyć dopasowanie.
          </p>
          <SpaceGraph people={space.people} sims={space.sims} />
        </Card>
      )}

      {matches.length === 0 ? (
        <Card>
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <p style={{ font: "var(--type-body-lg)", fontFamily: "var(--font-serif-display)", margin: "0 0 8px" }}>
              Jesteś wśród pierwszych osób w Lovli 🌱
            </p>
            <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", margin: 0 }}>
              Twój profil wartości jest gotowy i czeka w przestrzeni dopasowań.
              Gdy tylko dołączą kolejne osoby, zobaczysz je tutaj.
            </p>
          </div>
        </Card>
      ) : (
        matches.map((m) => (
          <Card key={m.user_id}>
            <div style={{ display: "flex", gap: "20px", alignItems: "flex-start", flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "10px", minWidth: "96px" }}>
                <div style={{
                  width: "64px", height: "64px", borderRadius: "50%",
                  background: "var(--grad-veil, var(--surface-veil))",
                  border: "1px solid var(--border-hairline)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: "var(--font-serif-display)", fontSize: "20px", color: "var(--text-secondary)",
                  filter: "blur(0.3px)",
                }}>
                  {m.initials}
                </div>
                <MatchBadge score={Math.round(m.match_score * 100)} size="sm" />
              </div>
              <div style={{ flex: 1, minWidth: "240px", display: "flex", flexDirection: "column", gap: "8px" }}>
                {COMPONENT_LABELS.map(([key, label]) => {
                  const v = m.components[key];
                  if (v === null || v === undefined) return null;
                  const pct = Math.round((v as number) * 100);
                  return (
                    <div key={key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)", width: "150px" }}>{label}</span>
                      <div style={{ flex: 1, height: "5px", borderRadius: "var(--radius-pill)", background: "var(--surface-veil)" }}>
                        <div style={{
                          width: `${pct}%`, height: "100%", borderRadius: "var(--radius-pill)",
                          background: pct >= 80 ? "var(--accent-success)" : "var(--accent-value)",
                        }} />
                      </div>
                      <span style={{ font: "var(--type-caption)", color: "var(--text-muted)", width: "36px", textAlign: "right" }}>{pct}%</span>
                    </div>
                  );
                })}
                {m.shared_passions.length > 0 && (
                  <p style={{ margin: "6px 0 0", font: "var(--type-caption)", color: "var(--text-secondary)" }}>
                    Wspólne pasje: {m.shared_passions.join(" · ")}
                  </p>
                )}
              </div>
            </div>
          </Card>
        ))
      )}

      <p style={{ font: "var(--type-micro)", color: "var(--text-muted)", textAlign: "center" }}>
        Rozmowy i stopniowe odsłanianie (gra FLIRT) — wkrótce. Dopasowania odświeżają się,
        gdy dołączają nowe osoby.
      </p>
      <div style={{ textAlign: "center" }}>
        <DeleteAccountButton />
      </div>
    </div>
  );
}
