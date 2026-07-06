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

// ---------------------------------------------------------------------------
// Constellation ("chmura/graf jak Obsidian") — the whole visible pool as a
// 3D value space, fed by REAL vectors. Layout similarity = normalized
// weighted-Euclidean on the flat vectors; hover % = real match_score.

export type SpacePerson = {
  name: string;
  man: boolean;
  you: boolean;
  /** real match_score vs "you" (cross-gender only), 0–100 */
  matchPct: number | null;
};
export type SpaceData = { people: SpacePerson[]; sims: number[][] };

// Cap keeps the sims matrix payload sane (~150² ≈ 22k floats). Past that,
// switch to shipping flat vectors and computing sims client-side.
const SPACE_CAP = 150;

export async function computeSpace(
  db: SupabaseClient,
  userId: string,
  scoreByUserId: Record<string, number>
): Promise<SpaceData | null> {
  const { data: me } = await db
    .from("profiles").select("gender, is_test").eq("user_id", userId).single();
  if (!me) return null;

  const { data: rows } = await db
    .from("profiles")
    .select("user_id, display_name, gender, user_vectors!inner(flat)")
    .eq("is_test", me.is_test)
    .not("onboarding_completed_at", "is", null)
    .limit(SPACE_CAP);
  if (!rows || rows.length < 3) return null;

  const flats: number[][] = [];
  const people: SpacePerson[] = [];
  const withMe = [...rows].sort((a, b) =>
    a.user_id === userId ? -1 : b.user_id === userId ? 1 : 0
  );
  for (const r of withMe) {
    const uv = r.user_vectors as unknown as { flat: { v: number[] } } | { flat: { v: number[] } }[];
    const flat = Array.isArray(uv) ? uv[0]?.flat : uv?.flat;
    if (!flat?.v) continue;
    flats.push(flat.v);
    people.push({
      name: (r.display_name as string).split(/\s+/)[0],
      man: r.gender === "male",
      you: r.user_id === userId,
      matchPct: scoreByUserId[r.user_id as string] ?? null,
    });
  }
  if (!people[0]?.you) return null; // requester must be in the pool

  const n = flats.length;
  const dist: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  let dmax = 1;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      const a = flats[i], b = flats[j];
      const len = Math.min(a.length, b.length);
      for (let k = 0; k < len; k++) { const d = a[k] - b[k]; s += d * d; }
      const d = Math.sqrt(s);
      dist[i][j] = dist[j][i] = d;
      if (d > dmax) dmax = d;
    }
  }
  const sims = dist.map((row) => row.map((d) => Math.round((1 - d / dmax) * 1000) / 1000));
  return { people, sims };
}
