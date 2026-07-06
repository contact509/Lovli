import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnginePayload } from "./onboarding/payload";
import { getEngine } from "./engine";
import { matchScore, DEFAULT_CONFIG, type MatchConfig, type MatchBreakdown } from "./engine/scoring";
import { PASSION_OPTIONS } from "./onboarding/questions";

/**
 * Retrieve-then-rank: candidates from the vector engine (weighted retrieval),
 * final match_score + breakdown computed here — Lovli-side, live-tunable via
 * weights_config (D-02/D-05/N-02).
 */

export async function loadMatchConfig(db: SupabaseClient): Promise<MatchConfig> {
  const { data } = await db.from("weights_config").select("key, value");
  if (!data?.length) return DEFAULT_CONFIG;
  const cfg = Object.fromEntries(data.map((r) => [r.key, r.value]));
  return {
    component_weights: cfg.component_weights ?? DEFAULT_CONFIG.component_weights,
    critical_multipliers: cfg.critical_multipliers ?? DEFAULT_CONFIG.critical_multipliers,
    religion_distance: cfg.religion_distance ?? DEFAULT_CONFIG.religion_distance,
    passion_bonus: cfg.passion_bonus ?? DEFAULT_CONFIG.passion_bonus,
  };
}

export type Match = {
  user_id: string;
  /** Anonymity by design: initials only until reveal (photos/names come later, via FLIRT). */
  initials: string;
  match_score: number;
  components: MatchBreakdown;
  shared_passions: string[];
};

export async function computeMatches(
  db: SupabaseClient,
  userId: string,
  limit = 20
): Promise<Match[]> {
  const cfg = await loadMatchConfig(db);
  const engine = getEngine(db);
  const candidates = await engine.getCandidates(userId, Math.max(limit * 5, 100));
  if (!candidates.length) return [];

  const { data: meRow } = await db
    .from("user_vectors").select("payload").eq("user_id", userId).single();
  if (!meRow) return [];
  const me = meRow.payload as EnginePayload;

  const ids = candidates.map((c) => c.user_id);
  const [{ data: vecs }, { data: profs }] = await Promise.all([
    db.from("user_vectors").select("user_id, payload").in("user_id", ids),
    db.from("profiles").select("user_id, display_name").in("user_id", ids),
  ]);
  const names = Object.fromEntries((profs ?? []).map((p) => [p.user_id, p.display_name as string]));

  const scored: Match[] = (vecs ?? []).map((v) => {
    const r = matchScore(me, v.payload as EnginePayload, cfg);
    const name = names[v.user_id] ?? "?";
    return {
      user_id: v.user_id as string,
      initials: name
        .split(/\s+/)
        .map((p: string) => (p[0] ?? "").toUpperCase() + ".")
        .join(" "),
      match_score: r.match_score,
      components: r.components,
      shared_passions: r.shared_passions.map((p) => PASSION_OPTIONS[p] ?? String(p)),
    };
  });

  // No system threshold (D-07) — rank by match_score, user decides.
  scored.sort((a, b) => b.match_score - a.match_score);
  return scored.slice(0, limit);
}
