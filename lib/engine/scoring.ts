import type { EnginePayload } from "../onboarding/payload";

/**
 * Lovli's OWN matching engine — retrieval metric + final match_score.
 *
 * Retrieval metric (scientist review, 2026-06-18, adopted hard):
 *   weighted EUCLIDEAN distance on raw 0–100 values — NOT cosine, NO
 *   normalization. Implemented as a deterministic flatten to fixed slots,
 *   each slot pre-scaled by √system_weight, so plain L2 on the flat vector
 *   IS the weighted Euclidean. Missing slots → neutral 50.
 *
 * Final match_score (DEVELOPER_DOCS §5, decisions D-01..D-07):
 *   0.40×values + 0.20×personality + 0.15×goals + 0.10×dynamic + 0.15×spiritual
 *   — component weights, critical multipliers, religion distance table and
 *   passion bonus all live in weights_config (live-tunable, D-02/N-02).
 *   dynamic_alignment is skipped (weight redistributed) until both users have
 *   ≥3 responses per dynamic vector (§5.1). No hard filters (D-01), no
 *   system threshold (D-07).
 */

// ---------------------------------------------------------------------------
// Config (defaults mirror the weights_config seed rows)

export type MatchConfig = {
  component_weights: {
    values: number; personality: number; goals: number; dynamic: number; spiritual: number;
  };
  critical_multipliers: Record<string, number>;
  religion_distance: number[][]; // 11×11, scale 0–4 (D-04); RT 11 → row 8
  passion_bonus: { three_plus: number; one_two: number };
};

export const DEFAULT_CONFIG: MatchConfig = {
  component_weights: { values: 0.4, personality: 0.2, goals: 0.15, dynamic: 0.1, spiritual: 0.15 },
  critical_multipliers: { VAL_32: 3, VAL_33: 3, FUND_05: 3 },
  religion_distance: [
    [0, 1, 2, 3, 2, 3, 3, 3, 2, 3, 4],
    [1, 0, 2, 2, 2, 3, 3, 3, 2, 2, 3],
    [2, 2, 0, 1, 1, 3, 3, 3, 2, 3, 3],
    [3, 2, 1, 0, 2, 3, 3, 3, 2, 3, 3],
    [2, 2, 1, 2, 0, 3, 3, 3, 2, 3, 3],
    [3, 3, 3, 3, 3, 0, 2, 2, 3, 3, 4],
    [3, 3, 3, 3, 3, 2, 0, 2, 3, 3, 4],
    [3, 3, 3, 3, 3, 2, 2, 0, 2, 3, 4],
    [2, 2, 2, 2, 2, 3, 3, 2, 0, 1, 2],
    [3, 2, 3, 3, 3, 3, 3, 3, 1, 0, 1],
    [4, 3, 3, 3, 3, 4, 4, 4, 2, 1, 0],
  ],
  passion_bonus: { three_plus: 0.05, one_two: 0.02 },
};

// ---------------------------------------------------------------------------
// Flatten — fixed slot list shared by every vector (order is the contract)

const pad = (n: number) => String(n).padStart(2, "0");
// The 13 GOAL ids that exist in the question bank (06 CSV)
export const GOAL_IDS = [1, 2, 3, 4, 6, 7, 8, 9, 10, 13, 14, 19, 22].map((g) => `GOAL_${pad(g)}`);

export type FlatVector = { slots: string[]; v: number[] };

export function flattenPayload(p: EnginePayload): FlatVector {
  const slots: string[] = [];
  const v: number[] = [];
  const put = (slot: string, value: number | null | undefined, weight: number) => {
    slots.push(slot);
    v.push((value ?? 50) * Math.sqrt(weight)); // missing → neutral 50 (scientist review)
  };

  const byId = <T extends { [k: string]: unknown }>(arr: T[], key: string) =>
    Object.fromEntries(arr.map((x) => [x[key] as string, x]));

  const vals = byId(p.vectors.values, "val_id") as Record<string, { importance: number; practice: number; system_weight: number }>;
  for (let n = 1; n <= 31; n++) {
    const id = `VAL_${pad(n)}`;
    const x = vals[id];
    put(`${id}.i`, x?.importance, x?.system_weight ?? 3);
    put(`${id}.p`, x?.practice, x?.system_weight ?? 3);
  }

  const pers = byId(p.vectors.personality, "q_id") as Record<string, { score: number; system_weight: number }>;
  for (let i = 1; i <= 12; i++) {
    const id = `VB_${pad(i)}`;
    put(id, pers[id]?.score, pers[id]?.system_weight ?? 3);
  }

  const goals = byId(p.vectors.goals, "goal_id") as Record<string, { importance: number; system_weight: number }>;
  for (const id of GOAL_IDS) put(id, goals[id]?.importance, goals[id]?.system_weight ?? 3);

  const ls = byId(p.vectors.lifestyle, "q_id") as Record<string, { score: number; system_weight: number }>;
  for (let i = 1; i <= 4; i++) {
    const id = `LS_${pad(i)}a`;
    put(id, ls[id]?.score, ls[id]?.system_weight ?? 2);
  }

  put("SP.practice", p.vectors.spiritual?.practice_level, p.vectors.spiritual?.system_weight ?? 5);
  put("FUND_05", p.fundamental_answers?.FUND_05, 5);
  put("FUND_06", p.fundamental_answers?.FUND_06, 4);
  put("FUND_07", p.fundamental_answers?.FUND_07, 4);

  return { slots, v };
}

/** Weighted Euclidean distance between two pre-weighted flat vectors. */
export function flatDistance(a: number[], b: number[]): number {
  const n = Math.min(a.length, b.length);
  let s = 0;
  for (let i = 0; i < n; i++) {
    const d = a[i] - b[i];
    s += d * d;
  }
  return Math.sqrt(s);
}

/**
 * Retrieval similarity 0–1, monotonic in weighted-Euclidean distance. Only
 * used to RANK candidates (retrieve-then-rank) — the user-facing % is always
 * match_score. 1000 ≈ typical distance scale for these vectors.
 */
export function flatSimilarity(a: number[], b: number[]): number {
  return 1 / (1 + flatDistance(a, b) / 1000);
}

// ---------------------------------------------------------------------------
// match_score — component alignments (Lovli-side IP)

type Pairwise = { d: number; w: number };

const align = (pairs: Pairwise[]): number | null => {
  let dw = 0, tw = 0;
  for (const { d, w } of pairs) { dw += d * w; tw += w; }
  return tw > 0 ? 1 - dw / tw : null;
};

const critFor = (cfg: MatchConfig, code: string) => cfg.critical_multipliers[code] ?? 1;

// Children answer (CHILDREN_ENUM code) → position on the "wants children" axis.
// Our config, not spec-fixed: yes_definitely / have_children_want_more = 1.0,
// no_definitely = 0.0; have_children_no_more sits near "no more children".
const CHILDREN_AXIS = [1.0, 0.75, 0.5, 0.25, 0.0, 1.0, 0.15];

export type MatchBreakdown = {
  values_alignment: number;
  personality_alignment: number;
  goals_alignment: number;
  spiritual_alignment: number;
  dynamic_alignment: number | null;
};

export function matchScore(a: EnginePayload, b: EnginePayload, cfg: MatchConfig = DEFAULT_CONFIG) {
  const d01 = (x: number | null | undefined, y: number | null | undefined) =>
    Math.abs((x ?? 50) - (y ?? 50)) / 100;

  // --- values: VAL pairs (importance+practice, §5.2) + FUND sliders (CSV target: values)
  const bVals = Object.fromEntries(b.vectors.values.map((v) => [v.val_id, v]));
  const valuePairs: Pairwise[] = [];
  for (const va of a.vectors.values) {
    const vb = bVals[va.val_id];
    if (!vb) continue;
    const d = (d01(va.importance, vb.importance) + d01(va.practice, vb.practice)) / 2;
    valuePairs.push({ d, w: va.system_weight * critFor(cfg, va.val_id) });
  }
  valuePairs.push({ d: d01(a.fundamental_answers.FUND_05, b.fundamental_answers.FUND_05), w: 5 * critFor(cfg, "FUND_05") });
  valuePairs.push({ d: d01(a.fundamental_answers.FUND_05p, b.fundamental_answers.FUND_05p), w: 4 });
  valuePairs.push({ d: d01(a.fundamental_answers.FUND_06, b.fundamental_answers.FUND_06), w: 4 });
  valuePairs.push({ d: d01(a.fundamental_answers.FUND_07, b.fundamental_answers.FUND_07), w: 4 });
  const values_alignment = align(valuePairs) ?? 0;

  // --- personality: VB + LS sliders (§5.3), passions bonus after (§5.5)
  const bPers = Object.fromEntries(b.vectors.personality.map((v) => [v.q_id, v]));
  const persPairs: Pairwise[] = a.vectors.personality
    .filter((p) => bPers[p.q_id])
    .map((p) => ({ d: d01(p.score, bPers[p.q_id].score), w: p.system_weight }));
  const bLs = Object.fromEntries(b.vectors.lifestyle.map((v) => [v.q_id, v]));
  for (const l of a.vectors.lifestyle) {
    if (bLs[l.q_id]) persPairs.push({ d: d01(l.score, bLs[l.q_id].score), w: l.system_weight });
  }
  let personality_alignment = align(persPairs) ?? 0;
  const shared = a.vectors.passions.filter((p) => b.vectors.passions.includes(p));
  if (shared.length >= 3) personality_alignment += cfg.passion_bonus.three_plus;
  else if (shared.length >= 1) personality_alignment += cfg.passion_bonus.one_two;
  personality_alignment = Math.min(1, personality_alignment);

  // --- goals: GOAL sliders + children (VAL_33 axis + VAL_33p, CSV target: goals)
  const bGoals = Object.fromEntries(b.vectors.goals.map((v) => [v.goal_id, v]));
  const goalPairs: Pairwise[] = a.vectors.goals
    .filter((g) => bGoals[g.goal_id])
    .map((g) => ({ d: d01(g.importance, bGoals[g.goal_id].importance), w: g.system_weight }));
  const childD = Math.abs(
    CHILDREN_AXIS[a.fundamental_answers.VAL_33 ?? 2] - CHILDREN_AXIS[b.fundamental_answers.VAL_33 ?? 2]
  );
  goalPairs.push({ d: childD, w: 5 * critFor(cfg, "VAL_33") });
  goalPairs.push({ d: d01(a.fundamental_answers.VAL_33p, b.fundamental_answers.VAL_33p), w: 5 });
  const goals_alignment = align(goalPairs) ?? 0;

  // --- spiritual: religion distance table (D-04, /4) + practice_level (§5.4, 50/50 mix)
  const rt = (p: EnginePayload) => {
    const r = p.vectors.spiritual?.RT ?? 11;
    return r === 11 ? 8 : Math.min(Math.max(r, 0), 10); // prefer_not_to_say → spirituality row
  };
  const relD = cfg.religion_distance[rt(a)][rt(b)] / 4;
  const practD = d01(a.vectors.spiritual?.practice_level, b.vectors.spiritual?.practice_level);
  const spiritual_alignment = 1 - (0.5 * relD + 0.5 * practD);

  // --- dynamic: only when BOTH users have ≥3 responses per vector (§4.3/§5.1)
  const dynPairs: Pairwise[] = [];
  for (const k of Object.keys(a.dynamic_vectors ?? {})) {
    const da = a.dynamic_vectors[k];
    const db = b.dynamic_vectors?.[k];
    if (da?.value != null && db?.value != null && da.update_count >= 3 && db.update_count >= 3) {
      dynPairs.push({ d: d01(da.value, db.value), w: 1 });
    }
  }
  const dynamic_alignment = align(dynPairs);

  // --- weighted sum; absent dynamic → its 0.10 redistributed proportionally (§5.1)
  const cw = cfg.component_weights;
  const parts: Array<[number, number]> = [
    [values_alignment, cw.values],
    [personality_alignment, cw.personality],
    [goals_alignment, cw.goals],
    [spiritual_alignment, cw.spiritual],
  ];
  if (dynamic_alignment !== null) parts.push([dynamic_alignment, cw.dynamic]);
  const totalW = parts.reduce((s, [, w]) => s + w, 0);
  const score = parts.reduce((s, [v, w]) => s + v * w, 0) / totalW;

  const breakdown: MatchBreakdown = {
    values_alignment, personality_alignment, goals_alignment, spiritual_alignment, dynamic_alignment,
  };
  return { match_score: score, components: breakdown, shared_passions: shared };
}
