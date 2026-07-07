/**
 * Gender-aware rendering of the question bank (Kris, 2026-07-07): gender is
 * known from registration, so the "y/a" slash forms are resolved instead of
 * shown. The CSV/bank stays neutral (source of truth); this is a render-time
 * transform.
 *
 * Rules cover every slash token present in the generated bank (verified
 * against the full inventory). Tokens that match no rule are left untouched —
 * e.g. "tworzenie/granie" in a passion label, which is not a gender pair.
 *
 * Partner-stem tokens flip to the OPPOSITE gender (matching is cross-gender
 * by design): a man reads "partnerka", a woman reads "partner".
 */

export type Gender = "male" | "female";

const TOKEN = /([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)\/([A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]+)/g;

/** Derive the female form from "male/suffix"; null = not a gender pair. */
function femaleForm(a: string, b: string): string | null {
  // full-word alternative sharing the stem: "partnera/partnerki"
  if (b.length >= 5 && a.slice(0, 5).toLowerCase() === b.slice(0, 5).toLowerCase()) return b;
  if (b === "a") {
    if (a.endsWith("y") || a.endsWith("i")) return a.slice(0, -1) + "a"; // uczciwy→uczciwa
    return a + "a"; // sam→sama, miał→miała
  }
  if (b === "aś" && a.endsWith("eś")) return a.slice(0, -2) + b;   // czułeś→czułaś
  if (b === "am" && a.endsWith("em")) return a.slice(0, -2) + b;   // mogłem→mogłam
  if (b === "ą" && a.endsWith("ym")) return a.slice(0, -2) + b;    // obecnym→obecną
  if (b === "ką" && a.endsWith("ą")) return a.slice(0, -1) + b;    // indywidualistą→indywidualistką
  if (b.startsWith("czk") && a.endsWith("k")) return a.slice(0, -1) + b; // Katolik→Katoliczka
  if (b === "tka" && a.endsWith("ta")) return a.slice(0, -2) + b;  // Ateista→Ateistka
  if (b === "ka" && a.endsWith("nin")) return a.slice(0, -2) + b;  // chrześcijanin→chrześcijanka
  if (b === "ka") return a + b;                                    // partner→partnerka
  return null;
}

export function genderize(text: string, gender: Gender): string {
  return text.replace(TOKEN, (match, a: string, b: string) => {
    const female = femaleForm(a, b);
    if (female === null) return match; // not a gender pair — leave as written
    // partner words describe the other side of a strictly cross-gender match
    const target: Gender = a.toLowerCase().startsWith("partner")
      ? (gender === "male" ? "female" : "male")
      : gender;
    return target === "male" ? a : female;
  });
}

/**
 * Sentences where a verb agrees with the PARTNER, not the user — token-local
 * rules can't know that, so these are replaced wholesale per user gender.
 */
export const GENDER_OVERRIDES: Record<string, { male: string; female: string }> = {
  FUND_05b: {
    male: "Jak ważne jest dla ciebie, żeby twoja partnerka miała podobne podejście do podziału ról?",
    female: "Jak ważne jest dla ciebie, żeby twój partner miał podobne podejście do podziału ról?",
  },
};

export function genderizeQuestion(code: string, text: string, gender: Gender | null): string {
  if (!gender) return text;
  const override = GENDER_OVERRIDES[code];
  if (override) return override[gender];
  return genderize(text, gender);
}
