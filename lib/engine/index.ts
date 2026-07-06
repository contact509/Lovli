import type { SupabaseClient } from "@supabase/supabase-js";
import type { EnginePayload } from "../onboarding/payload";
import { flattenPayload, flatSimilarity } from "./scoring";

/**
 * Vector engine behind the SAME interface we specced for Trek2Summit
 * (trek2summit-handoff/API_CONTRACT.md): upsert / get / delete profile +
 * nearest candidates. Two implementations:
 *
 *  - LocalEngine (ACTIVE): Supabase Postgres. Weighted-Euclidean brute force —
 *    per the scientist review this is sub-second up to ~10k+ users; no AWS
 *    needed at this scale.
 *  - Trek2SummitEngine: their AWS engine, activated by env vars
 *    TREK2SUMMIT_API_URL + TREK2SUMMIT_API_KEY when they deliver. Drop-in swap;
 *    while unset, submits are still mirrored nowhere and everything runs local.
 *
 * Final match_score is ALWAYS computed Lovli-side (retrieve-then-rank) — the
 * engine only stores vectors and returns nearest candidates.
 */

export type Candidate = { user_id: string; similarity: number };

export interface VectorEngine {
  upsertProfile(payload: EnginePayload): Promise<void>;
  deleteProfile(userId: string): Promise<void>;
  getCandidates(userId: string, limit: number): Promise<Candidate[]>;
}

// ---------------------------------------------------------------------------

export class LocalEngine implements VectorEngine {
  constructor(private db: SupabaseClient) {}

  async upsertProfile(payload: EnginePayload): Promise<void> {
    const flat = flattenPayload(payload);
    const { error } = await this.db.from("user_vectors").upsert({
      user_id: payload.user_id,
      payload,
      flat,
      onboarding_version: payload.onboarding_version,
      updated_at: new Date().toISOString(),
    });
    if (error) throw new Error(`user_vectors upsert failed: ${error.message}`);
  }

  async deleteProfile(userId: string): Promise<void> {
    const { error } = await this.db.from("user_vectors").delete().eq("user_id", userId);
    if (error) throw new Error(`user_vectors delete failed: ${error.message}`);
  }

  /**
   * Nearest candidates by weighted Euclidean distance, mutual-preference
   * filtered (candidate matches requester's `seeking`, and vice versa).
   * Test personas (is_test) only ever match other test accounts.
   */
  async getCandidates(userId: string, limit: number): Promise<Candidate[]> {
    const { data: me, error: meErr } = await this.db
      .from("profiles").select("gender, seeking, is_test").eq("user_id", userId).single();
    if (meErr || !me) throw new Error("requester profile not found");

    const { data: mine, error: vErr } = await this.db
      .from("user_vectors").select("flat").eq("user_id", userId).single();
    if (vErr || !mine) throw new Error("requester vector not found");
    const myFlat: number[] = (mine.flat as { v: number[] }).v;

    const { data: rows, error } = await this.db
      .from("profiles")
      .select("user_id, user_vectors!inner(flat)")
      .eq("gender", me.seeking)
      .eq("seeking", me.gender)
      .eq("is_test", me.is_test)
      .neq("user_id", userId)
      .not("onboarding_completed_at", "is", null)
      .limit(2000);
    if (error) throw new Error(`candidate query failed: ${error.message}`);

    const scored: Candidate[] = (rows ?? []).map((r) => {
      const uv = r.user_vectors as unknown as { flat: { v: number[] } } | { flat: { v: number[] } }[];
      const flat = Array.isArray(uv) ? uv[0]?.flat : uv?.flat;
      return { user_id: r.user_id as string, similarity: flat ? flatSimilarity(myFlat, flat.v) : 0 };
    });
    scored.sort((a, b) => b.similarity - a.similarity);
    return scored.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------

export class Trek2SummitEngine implements VectorEngine {
  constructor(private baseUrl: string, private apiKey: string) {}

  private async call(method: string, path: string, body?: unknown) {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Trek2Summit ${method} ${path} → ${res.status}`);
    return res.json();
  }

  async upsertProfile(payload: EnginePayload): Promise<void> {
    await this.call("POST", "/user/profile", payload);
  }
  async deleteProfile(userId: string): Promise<void> {
    await this.call("DELETE", `/user/profile/${userId}`);
  }
  async getCandidates(userId: string, limit: number): Promise<Candidate[]> {
    const r = await this.call(
      "GET", `/match/candidates?user_id=${encodeURIComponent(userId)}&limit=${limit}`
    );
    return r.candidates ?? [];
  }
}

// ---------------------------------------------------------------------------

/** Active engine for reads/matching. Local until Trek2Summit proves out. */
export function getEngine(db: SupabaseClient): VectorEngine {
  return new LocalEngine(db);
}

/**
 * Optional mirror: when Trek2Summit endpoints exist, every vector upsert is
 * additionally sent to them (their engine warm + webhook flow exercised)
 * without making the portal depend on their availability.
 */
export function getMirrorEngine(): VectorEngine | null {
  const url = process.env.TREK2SUMMIT_API_URL;
  const key = process.env.TREK2SUMMIT_API_KEY;
  return url && key ? new Trek2SummitEngine(url.replace(/\/$/, ""), key) : null;
}
