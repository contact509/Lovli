import type { SupabaseClient } from "@supabase/supabase-js";
import { QUESTIONS } from "./onboarding/questions";
import type { Answers } from "./onboarding/payload";

/**
 * "Poznaj siebie" (DEVELOPER_DOCS D-03) — the LLM psychological portrait, the
 * reward for completing the onboarding. Hard rules from the spec:
 *  - the LLM DESCRIBES the user to themselves from their OWN answers — it does
 *    not match, classify into happiness models, or diagnose (§10);
 *  - grounded in logotherapy (Frankl): will to meaning, values as compass;
 *  - the aspiration–reality gap (importance high, practice low) is named with
 *    warmth, as room to grow — never as criticism;
 *  - Lovli-side only: open answers (OPQ) may be read here, they never reach
 *    the matching engine.
 * Generated once per user, stored in `portraits`.
 *
 * Engine (Kris, 2026-07-07): OpenAI ChatGPT on a DEDICATED Lovli-only key
 * (`LOVLI_OPENAI_API_KEY` — never the global OPENAI_API_KEY, never reused for
 * other projects). Model: gpt-5-mini — strong quality tier without flagship
 * pricing. Gemini 2.5 Flash stays as emergency fallback so a user never hits
 * a dead end. (Claude variant existed at commit 3a7d1fb if ever needed.)
 */

export type Portrait = {
  naglowek: string;
  w_relacji: string;
  mocne_strony: { emoji: string; tytul: string; opis: string }[];
  kluczowe: string[];
  do_zbadania: string;
  filozofia: string;
};

const MODEL = "gpt-5-mini";

const PORTRAIT_SCHEMA = {
  type: "object",
  properties: {
    naglowek: {
      type: "string",
      description:
        "Jedno zdanie-esencja profilu, jak motto (np. „Jesteś budowniczym — cenisz stabilność, działanie i trwały ślad.”). Bez imienia.",
    },
    w_relacji: {
      type: "string",
      description:
        "Jak ta osoba wygląda w bliskiej relacji — 3-5 zdań, ciepło i konkretnie, zakotwiczone w jej odpowiedziach (bliskość vs przestrzeń, decyzje, emocje, zaufanie, lojalność).",
    },
    mocne_strony: {
      type: "array",
      description: "Dokładnie 3 mocne strony jako partnera/partnerki, z najwyżej ocenionych wartości.",
      items: {
        type: "object",
        properties: {
          emoji: { type: "string", description: "Jedno pasujące emoji" },
          tytul: { type: "string", description: "2-4 słowa" },
          opis: { type: "string", description: "1-2 zdania, konkretnie z odpowiedzi" },
        },
        required: ["emoji", "tytul", "opis"],
        additionalProperties: false,
      },
    },
    kluczowe: {
      type: "array",
      description:
        "2-3 rzeczy absolutnie kluczowe/nienegocjowalne dla tej osoby (z odpowiedzi o najwyższej wadze i wyniku: wiara, dzieci, model rodziny, wartości >75). Każda jako jedno zdanie.",
      items: { type: "string" },
    },
    do_zbadania: {
      type: "string",
      description:
        "Obszary, gdzie ważność jest wysoka, a codzienna realizacja niższa — opisane CIEPŁO jako przestrzeń do wzrostu, nigdy jako krytyka. 2-4 zdania. Jeśli brak wyraźnych luk — napisz o spójności.",
    },
    filozofia: {
      type: "string",
      description:
        "Wiodąca filozofia życiowa tej osoby w duchu logoterapii Frankla (wola sensu) — 1-2 zdania na bazie odpowiedzi o pracy, misji, duchowości i celach.",
    },
  },
  required: ["naglowek", "w_relacji", "mocne_strony", "kluczowe", "do_zbadania", "filozofia"],
  additionalProperties: false,
} as const;

const SYSTEM = `Jesteś psychologiem-praktykiem piszącym po polsku, zakorzenionym w logoterapii Viktora Frankla („wola sensu" jako główna siła napędowa człowieka). Piszesz „Poznaj siebie" — osobisty portret wartości użytkownika aplikacji Lovli, który właśnie ukończył 104-pytaniowy onboarding. Portret jest nagrodą za ten wysiłek: ma być ciepły, konkretny i prawdziwy.

Zasady nienaruszalne:
- Opisujesz użytkownika JEMU SAMEMU, wyłącznie na podstawie jego odpowiedzi. Zwracasz się per „ty".
- NIE diagnozujesz, NIE klasyfikujesz do typów/modeli, NIE oceniasz („lepszy/gorszy"), NIE dajesz porad terapeutycznych.
- Każde spostrzeżenie kotwiczysz w konkretnych odpowiedziach (możesz przywołać treść, nie cytuj surowych liczb więcej niż raz-dwa razy).
- Luka między ważnością a realizacją to przestrzeń do wzrostu — piszesz o niej z ciepłem i szacunkiem, nigdy jak o wadzie.
- Suwak 50 = brak wyraźnej preferencji — nie nadinterpretuj środkowych odpowiedzi.
- Język: naturalna polszczyzna, zero żargonu psychologicznego, zero AI-frazesów („warto podkreślić", „niezwykle istotne"). Pisz zwięźle — każde zdanie ma nieść treść.`;

// ---------------------------------------------------------------------------

const fmt = (v: unknown) => (typeof v === "number" ? String(v) : "");

/** Human-readable digest of all answers — question text + poles + value. */
export function buildPortraitInput(answers: Answers, gender?: string | null): string {
  const lines: string[] = [];
  for (const q of Object.values(QUESTIONS)) {
    const v = answers[q.code];
    if (v === undefined || v === null) continue;
    if (q.type === "slider" && typeof v === "number") {
      lines.push(`• ${q.text}\n  skala: 0 = „${q.low}" … 100 = „${q.high}" → odpowiedź: ${v}`);
    } else if (q.type === "choice" && typeof v === "number") {
      lines.push(`• ${q.text} → „${q.options?.[v] ?? v}"`);
    } else if (q.type === "multi" && Array.isArray(v)) {
      const labels = (v as number[]).map((i) => q.options?.[i]).filter(Boolean);
      if (labels.length) lines.push(`• ${q.text} → ${labels.join(", ")}`);
    } else if (q.type === "text" && typeof v === "string" && v.trim()) {
      lines.push(`• ${q.text}\n  odpowiedź własnymi słowami: „${v.trim()}"`);
    }
  }

  // anchors for sections 2-4 (per the spec: top values, non-negotiables, gaps)
  const tops: string[] = [];
  const gaps: string[] = [];
  for (let n = 1; n <= 31; n++) {
    const code = `VAL_${String(n).padStart(2, "0")}`;
    const imp = answers[`${code}a`];
    const prac = answers[`${code}b`];
    if (typeof imp !== "number") continue;
    const q = QUESTIONS[`${code}a`];
    if (imp >= 80 && q) tops.push(`${q.text} (ważność ${fmt(imp)}, realizacja ${fmt(prac)})`);
    if (typeof prac === "number" && imp > 70 && prac < 40 && q) {
      gaps.push(`${q.text} (ważność ${fmt(imp)}, realizacja ${fmt(prac)})`);
    }
  }

  const genderLine =
    gender === "female"
      ? "PŁEĆ UŻYTKOWNIKA: kobieta — pisz do niej w rodzaju żeńskim (np. „jesteś gotowa”, „zbudowałaś”)."
      : gender === "male"
        ? "PŁEĆ UŻYTKOWNIKA: mężczyzna — pisz do niego w rodzaju męskim (np. „jesteś gotowy”, „zbudowałeś”)."
        : "PŁEĆ UŻYTKOWNIKA: nieznana — pisz formami neutralnymi.";

  return [
    "ODPOWIEDZI UŻYTKOWNIKA Z ONBOARDINGU LOVLI:",
    genderLine,
    "",
    lines.join("\n"),
    "",
    `NAJWYŻEJ OCENIONE WARTOŚCI (ważność ≥80): ${tops.length ? tops.join("; ") : "brak wyraźnych szczytów — profil zrównoważony"}`,
    `LUKI ASPIRACJA→REALIZACJA (ważność >70, realizacja <40): ${gaps.length ? gaps.join("; ") : "brak wyraźnych luk"}`,
    "",
    "Napisz portret „Poznaj siebie” zgodnie ze schematem.",
  ].join("\n");
}

// ---------------------------------------------------------------------------

export async function getOrGeneratePortrait(
  db: SupabaseClient,
  userId: string
): Promise<{ portrait: Portrait; created: boolean }> {
  const { data: existing } = await db
    .from("portraits").select("content").eq("user_id", userId).maybeSingle();
  if (existing?.content) return { portrait: existing.content as Portrait, created: false };

  const { data: rows } = await db
    .from("onboarding_answers")
    .select("code, value_num, value_text, value_list")
    .eq("user_id", userId);
  if (!rows?.length) throw new Error("no onboarding answers");
  const answers: Answers = {};
  for (const r of rows) {
    answers[r.code] = (r.value_list ?? r.value_text ?? r.value_num) as Answers[string];
  }

  const { data: prof } = await db
    .from("profiles").select("gender").eq("user_id", userId).maybeSingle();

  const input = buildPortraitInput(answers, prof?.gender ?? null);
  let portrait: Portrait;
  let model = MODEL;
  try {
    portrait = await generateWithOpenAI(input);
  } catch (e) {
    console.error("OpenAI portrait failed, falling back to Gemini:", e);
    portrait = await generateWithGemini(input);
    model = GEMINI_MODEL;
  }
  validatePortrait(portrait);

  await db.from("portraits").upsert({ user_id: userId, content: portrait, model });
  return { portrait, created: true };
}

function validatePortrait(p: Portrait) {
  const ok =
    p && typeof p.naglowek === "string" && typeof p.w_relacji === "string" &&
    Array.isArray(p.mocne_strony) && p.mocne_strony.length >= 1 &&
    Array.isArray(p.kluczowe) && p.kluczowe.length >= 1 &&
    typeof p.do_zbadania === "string" && typeof p.filozofia === "string";
  if (!ok) throw new Error("portrait failed shape validation");
}

async function generateWithOpenAI(input: string): Promise<Portrait> {
  const key = process.env.LOVLI_OPENAI_API_KEY; // Lovli-dedicated key, by design
  if (!key) throw new Error("LOVLI_OPENAI_API_KEY not configured");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: MODEL,
      max_completion_tokens: 8000, // includes gpt-5 reasoning tokens
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: input },
      ],
      response_format: {
        type: "json_schema",
        json_schema: { name: "portret", strict: true, schema: PORTRAIT_SCHEMA },
      },
    }),
    signal: AbortSignal.timeout(55_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error(`OpenAI returned no content (finish: ${data?.choices?.[0]?.finish_reason})`);
  return JSON.parse(text) as Portrait;
}

const GEMINI_MODEL = "gemini-2.5-flash";

async function generateWithGemini(input: string): Promise<Portrait> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${key}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM }] },
        contents: [{
          role: "user",
          parts: [{
            text: `${input}\n\nOdpowiedz WYŁĄCZNIE poprawnym JSON-em o polach: naglowek (string), w_relacji (string), mocne_strony (tablica dokładnie 3 obiektów {emoji, tytul, opis}), kluczowe (tablica 2-3 stringów), do_zbadania (string), filozofia (string). Znaczenie pól:\n${JSON.stringify(PORTRAIT_SCHEMA.properties, null, 1)}`,
          }],
        }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
      }),
      signal: AbortSignal.timeout(50_000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p: { text?: string }) => p.text ?? "").join("");
  if (!text) throw new Error("Gemini returned no text");
  return JSON.parse(text) as Portrait;
}
