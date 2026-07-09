// Chapter ("obszar") layer over STEPS — Boruta's direction (2026-07-08):
// the onboarding should read as discovering successive areas of your life,
// with a value promise up front and a short "why this matters" per area.
// STEPS stay untouched (questions.ts is generated from the CSVs); chapters
// only group them for framing, progress and transitions.
import { STEPS } from "./questions";

export type Chapter = {
  id: string;
  title: string;
  /** One-breath "why this area matters" — intro map + chapter transitions. */
  lead: string;
  /** STEPS ids, contiguous and in flow order. */
  steps: string[];
};

export const CHAPTERS: Chapter[] = [
  {
    id: "vibe",
    title: "Twój vibe",
    lead: "Temperament, energia, rytm. To nie jest ocena — to sposób, w jaki jesteś zbudowany/a.",
    steps: ["vibe-1", "vibe-2", "vibe-3"],
  },
  {
    id: "wartosci",
    title: "Twoje wartości",
    lead: "Serce Lovli. Każdą wartość oceniasz dwa razy: jak bardzo jest ważna i ile z niej naprawdę żyjesz. Ta różnica mówi o tobie więcej niż deklaracje.",
    steps: [
      "values-1", "values-2", "values-3", "values-4", "values-5",
      "values-6", "values-7", "values-8", "values-9", "values-10",
    ],
  },
  {
    id: "sens",
    title: "Sens i priorytety",
    lead: "Pytania o najwyższej wadze — wiara, kierunek, priorytety. Tu decyduje się fundamentalna zgodność dwojga ludzi.",
    steps: ["faith", "fund"],
  },
  {
    id: "cele",
    title: "Twoje cele życiowe",
    lead: "Dokąd idziesz i co ma być na końcu drogi. Cele nie muszą być wielkie — muszą być twoje.",
    steps: ["goals-1", "goals-2", "children", "goals-3", "goals-4"],
  },
  {
    id: "pasje-styl",
    title: "Pasje i styl życia",
    lead: "Bonus, nie kryterium. Pasje dają tematy na pierwszą rozmowę, styl życia — codzienną zgodność.",
    steps: ["passions", "lifestyle"],
  },
  {
    id: "historia",
    title: "Twoja historia",
    lead: "Trzy pytania twoimi słowami. Nigdy nie trafiają do silnika dopasowań — budują twój portret.",
    steps: ["open"],
  },
];

// stepId → { chapter index, step index within chapter }
const INDEX = new Map<string, { chapter: number; step: number }>();
CHAPTERS.forEach((ch, ci) => ch.steps.forEach((s, si) => INDEX.set(s, { chapter: ci, step: si })));

export function chapterPos(stepId: string): { chapter: number; step: number } | null {
  return INDEX.get(stepId) ?? null;
}

// questions.ts is generated — if the step list drifts, fail loudly in dev
// instead of silently mis-grouping the flow.
if (process.env.NODE_ENV !== "production") {
  const flat = CHAPTERS.flatMap((c) => c.steps);
  const stepIds = STEPS.map((s) => s.id);
  if (flat.length !== stepIds.length || flat.some((id, i) => id !== stepIds[i])) {
    // eslint-disable-next-line no-console
    console.warn(
      "[lovli] chapters.ts is out of sync with generated STEPS:",
      { chapters: flat, steps: stepIds },
    );
  }
}
