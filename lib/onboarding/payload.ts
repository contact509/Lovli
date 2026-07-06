import { QUESTIONS } from "./questions";

/**
 * Builds the engine user-vector JSON — the EXACT format specced for
 * Trek2Summit (trek2summit-handoff/ENGINE_SPEC.md §1) and produced by the
 * reference generator (onboarding-simulator/generate_user_json.py).
 *
 * Fully opaque payload: dimension ids are codes (VAL_01, RT, DYN_01…) and all
 * categorical answers are already stored as enum-index integers in the app
 * (CODEBOOK.md), so no text ever enters this object. Open questions
 * (OPQ_01/02) intentionally never leave Lovli.
 */

export type Answers = Record<string, number | string | number[] | null | undefined>;

export const ONBOARDING_VERSION = "1.0";

const pad = (n: number) => String(n).padStart(2, "0");
export const DYN_CODES = Array.from({ length: 7 }, (_, i) => `DYN_${pad(i + 1)}`);

const num = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? Math.round(v) : null;

export type EnginePayload = ReturnType<typeof buildUserPayload>;

export function buildUserPayload(userId: string, answers: Answers, createdAt: string) {
  const values = [];
  for (let n = 1; n <= 31; n++) {
    const vid = `VAL_${pad(n)}`;
    const a = num(answers[`${vid}a`]);
    if (a === null) continue;
    values.push({
      val_id: vid,
      importance: a,
      practice: num(answers[`${vid}b`]) ?? a,
      system_weight: QUESTIONS[`${vid}a`]?.weight ?? 3,
    });
  }

  const personality = [];
  for (let i = 1; i <= 12; i++) {
    const qid = `VB_${pad(i)}`;
    const v = num(answers[qid]);
    if (v === null) continue;
    personality.push({ q_id: qid, score: v, system_weight: QUESTIONS[qid]?.weight ?? 3 });
  }

  const goals = [];
  for (let g = 1; g <= 24; g++) {
    const gid = `GOAL_${pad(g)}`;
    const v = num(answers[`${gid}a`]);
    if (v === null) continue;
    goals.push({ goal_id: gid, importance: v, system_weight: QUESTIONS[`${gid}a`]?.weight ?? 3 });
  }

  const lifestyle = [];
  for (let i = 1; i <= 4; i++) {
    const qid = `LS_${pad(i)}a`; // q_id keeps the "a" suffix — matches the reference generator
    const v = num(answers[qid]);
    if (v === null) continue;
    lifestyle.push({ q_id: qid, score: v, system_weight: QUESTIONS[qid]?.weight ?? 2 });
  }

  const passions = Array.isArray(answers.PAS_SET)
    ? (answers.PAS_SET as number[]).filter((p) => Number.isInteger(p) && p >= 0 && p <= 28)
    : [];

  return {
    user_id: userId,
    created_at: createdAt,
    onboarding_version: ONBOARDING_VERSION,
    vectors: {
      values,
      personality,
      goals,
      spiritual: {
        RT: num(answers.VAL_32a) ?? 11, // 11 = prefer_not_to_say
        practice_level: num(answers.VAL_32b) ?? 0,
        system_weight: 5,
      },
      lifestyle,
      passions,
    },
    fundamental_answers: {
      VAL_33: num(answers.VAL_33a) ?? 2, // 2 = unsure
      VAL_33p: num(answers.VAL_33b),
      FUND_05: num(answers.FUND_05a),
      FUND_05p: num(answers.FUND_05b),
      FUND_06: num(answers.FUND_06a),
      FUND_07: num(answers.FUND_07a),
    },
    relationship_intent: num(answers.OPQ_03) ?? 3, // 3 = unsure
    dynamic_vectors: Object.fromEntries(
      DYN_CODES.map((k) => [k, { value: null as number | null, update_count: 0 }])
    ),
  };
}
