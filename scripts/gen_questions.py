"""Generate lib/onboarding/questions.ts from the authoritative spec CSVs.

Sources (second-brain/Projects/lovli-io-vectors/):
  06_pytania_onboardingowe_full.csv  -> question texts, poles, types, slider weights
  01_wartosci.csv                    -> system_weight per VAL (payload values[])
  02_cele_zyciowe.csv                -> system_weight per GOAL (payload goals[])

Enum option lists follow CODEBOOK.md / DEVELOPER_DOCS D-06 exactly — option
index IS the code sent in the payload. Re-run after any CSV change:
  py scripts/gen_questions.py
"""
import csv
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SPEC_DIR = r"I:/.gemini/antigravity/second-brain/Projects/lovli-io-vectors"
OUT = os.path.join(HERE, "..", "lib", "onboarding", "questions.ts")

# --- enum option labels (index = payload code; see CODEBOOK.md) --------------
RELIGION_OPTIONS = [
    "Katolik/czka praktykujący/a",
    "Katolik/czka niepraktykujący/a",
    "Inny chrześcijanin/ka — praktykujący/a",
    "Inny chrześcijanin/ka — niepraktykujący/a",
    "Prawosławny/a",
    "Islam",
    "Judaizm",
    "Inna religia",
    "Duchowość bez religii",
    "Agnostyk/czka",
    "Ateista/tka",
    "Wolę nie odpowiadać",
]
CHILDREN_OPTIONS = [
    "Tak — bardzo tego chcę",
    "Tak — raczej tak",
    "Jeszcze nie wiem",
    "Raczej nie",
    "Nie — zdecydowanie nie",
    "Mam już dzieci i chcę więcej",
    "Mam już dzieci i nie chcę więcej",
]
INTENT_OPTIONS = [
    "Związku długotrwałego",
    "Relacji z potencjałem na związek",
    "Przyjaźni i wartościowej znajomości",
    "Jeszcze nie wiem — sprawdzam",
]
# index = code in vectors.passions[] (PASSIONS_POOL order from the generator)
PASSION_OPTIONS = [
    "🎨 Sztuka i rysowanie", "📸 Fotografia", "🎵 Muzyka (słuchanie)",
    "🎸 Muzyka (tworzenie/granie)", "🍳 Gotowanie i kulinaria",
    "🏃 Sporty wytrzymałościowe", "💪 Sporty siłowe", "🥋 Sporty walki",
    "⚽ Sporty zespołowe", "🪂 Sporty ekstremalne i przygoda",
    "🧘 Joga i medytacja", "🏔️ Trekking i góry", "✈️ Podróże i eksploracja",
    "🌿 Natura i ekologia", "📚 Czytanie i literatura",
    "🧠 Filozofia i psychologia", "🌱 Samorozwój i coaching",
    "🚀 Nauka i technologia", "💻 Programowanie", "🎮 Gry video",
    "🎲 Gry planszowe i RPG", "🎬 Film i kino", "🎭 Teatr i sztuki performatywne",
    "🙏 Duchowość i religia", "🤝 Wolontariat i działalność społeczna",
    "🚗 Motoryzacja", "👗 Moda i styl", "🌻 Ogrodnictwo i uprawa",
    "🥗 Zdrowe odżywianie",
]


def load(name):
    with open(os.path.join(SPEC_DIR, name), encoding="utf-8") as f:
        return list(csv.DictReader(f))


def main():
    value_w = {r["KOD_WARTOSCI"].strip(): int(r["WAGA_KORELACJI (1-5)"])
               for r in load("01_wartosci.csv")}
    goal_w = {r["KOD_CELU"].strip(): int(r["PRIORYTET_KORELACJI (1-5)"])
              for r in load("02_cele_zyciowe.csv")}

    questions = {}
    order = []
    for r in load("06_pytania_onboardingowe_full.csv"):
        kod = r["KOD"].strip()
        typ = (r["TYP"] or "").strip().upper()
        try:
            waga = int(r["WAGA"])
        except (ValueError, TypeError):
            waga = 3
        q = {
            "code": kod,
            "section": r["SEKCJA"].strip(),
            "text": r["PYTANIE_PL"].strip(),
            "weight": waga,
        }
        if typ == "SUWAK":
            q["type"] = "slider"
            q["low"] = (r["BIEGUN_LEWY_PL"] or "").strip()
            q["high"] = (r["BIEGUN_PRAWY_PL"] or "").strip()
        elif typ == "WYBÓR_JEDNOKROTNY":
            q["type"] = "choice"
            # option lists come from the payload enums (index = code), not the
            # CSV column — CODEBOOK/D-06 are authoritative for codes
            q["options"] = {"VAL_32a": RELIGION_OPTIONS,
                            "VAL_33a": CHILDREN_OPTIONS,
                            "OPQ_03": INTENT_OPTIONS}[kod]
        elif typ == "WYBÓR_WIELOKROTNY":
            q["type"] = "multi"
            q["options"] = PASSION_OPTIONS
        elif typ in ("TEKST_DŁUGI", "TEKST_WOLNY"):
            q["type"] = "text"
            # open reflections: room to actually write (Kris 07-07); passion note stays short
            q["maxLen"] = 10000 if typ == "TEKST_DŁUGI" else 500
        else:
            raise SystemExit(f"unknown TYP {typ} for {kod}")

        # payload system_weight sources mirror generate_user_json.py exactly:
        # VAL_xx -> 01_wartosci, GOAL_xx -> 02_cele, VB/LS/FUND -> 06 CSV
        base = kod.rstrip("ab")
        if base.startswith("VAL_") and base not in ("VAL_32", "VAL_33"):
            q["weight"] = value_w.get(base, waga)
        elif base.startswith("GOAL_"):
            q["weight"] = goal_w.get(base, waga)

        questions[kod] = q
        order.append(kod)

    # GOAL_07 only for positive children answers (CSV UWAGI_UX)
    questions["GOAL_07a"]["showIf"] = {"code": "VAL_33a", "in": [0, 1, 5]}
    # VAL_33b appears once VAL_33a is answered
    questions["VAL_33b"]["showIf"] = {"code": "VAL_33a", "answered": True}
    questions["VAL_32b"]["showIf"] = {"code": "VAL_32a", "answered": True}

    # --- step layout (CSV row order, woven fundamentals) ---------------------
    steps = []

    def step(sid, title, items, intro=None, special=False):
        steps.append({"id": sid, "title": title, "items": items,
                      **({"intro": intro} if intro else {}),
                      **({"special": True} if special else {})})

    vb = [f"VB_{i:02d}" for i in range(1, 13)]
    step("vibe-1", "Twój vibe · 1/3", vb[0:4],
         "Zanim przejdziemy do wartości — chcemy zrozumieć, jak jesteś zbudowany/a. Nie ma dobrych ani złych odpowiedzi.")
    step("vibe-2", "Twój vibe · 2/3", vb[4:8])
    step("vibe-3", "Twój vibe · 3/3", vb[8:12])

    vals = [f"VAL_{n:02d}" for n in range(1, 32)]
    intro_vals = ("Każdą wartość oceniasz na dwóch poziomach: jak bardzo jest dla ciebie ważna "
                  "i jak bardzo realizujesz ją w życiu. Ta różnica jest kluczowa.")
    groups = [vals[i:i + 3] for i in range(0, 27, 3)] + [vals[27:31]]
    for i, g in enumerate(groups, 1):
        items = [c + s for c in g for s in ("a", "b")]
        step(f"values-{i}", f"Twoje wartości · {i}/{len(groups)}", items,
             intro_vals if i == 1 else None)

    step("faith", "Pytanie o sens", ["VAL_32a", "VAL_32b"],
         "To jedno z ważniejszych pytań. Odpowiedź wpłynie znacząco na to, z kim zostaniesz dopasowany/a.",
         special=True)
    step("fund", "Twoje priorytety życiowe",
         ["FUND_05a", "FUND_05b", "FUND_06a", "FUND_07a"],
         "Teraz pytania o to, jak widzisz swoją przyszłość.")
    step("goals-1", "Twoje cele życiowe · 1/3",
         ["GOAL_01a", "GOAL_02a", "GOAL_03a", "GOAL_04a"],
         "Co jest dla ciebie naprawdę ważne na końcu drogi?")
    step("goals-2", "Twoje cele życiowe · 2/3", ["GOAL_06a"])
    step("children", "Pytanie o przyszłość", ["VAL_33a", "VAL_33b"],
         "Jedno z pytań o najwyższej wadze. Odpowiedź decyduje o fundamentalnej kompatybilności.",
         special=True)
    step("goals-3", "Twoje cele życiowe · 3/3",
         ["GOAL_07a", "GOAL_08a", "GOAL_09a", "GOAL_10a"])
    step("goals-4", "Sens i trwałość",
         ["GOAL_13a", "GOAL_14a", "GOAL_19a", "GOAL_22a"])
    step("passions", "Twoje pasje", ["PAS_SET", "PAS_TEXT"],
         "Pasje to bonus, nie kryterium — pomagają w rozmowie.")
    step("lifestyle", "Twój styl życia",
         ["LS_01a", "LS_02a", "LS_03a", "LS_04a"])
    step("open", "Twoja historia", ["OPQ_01", "OPQ_02", "OPQ_03"],
         "Ostatnie pytania są najważniejsze. Weź chwilę — liczy się autentyczność. "
         "Piszesz bezpiecznie: te odpowiedzi przechowujemy pod anonimowym identyfikatorem konta, "
         "nie pod imieniem i nazwiskiem. Nikt nie zobaczy ich w aplikacji i nigdy nie trafiają "
         "do silnika dopasowań — do badań idą wyłącznie w formie zanonimizowanej.")

    covered = {c for s in steps for c in s["items"]}
    missing = [c for c in order if c not in covered]
    if missing:
        raise SystemExit(f"steps miss questions: {missing}")

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8", newline="\n") as f:
        f.write("// GENERATED by scripts/gen_questions.py — do not edit by hand.\n")
        f.write("// Source of truth: second-brain/Projects/lovli-io-vectors/*.csv\n\n")
        f.write("export type Question = {\n")
        f.write("  code: string; section: string; text: string; weight: number;\n")
        f.write('  type: "slider" | "choice" | "multi" | "text";\n')
        f.write("  low?: string; high?: string; options?: string[]; maxLen?: number;\n")
        f.write("  showIf?: { code: string; in?: number[]; answered?: boolean };\n")
        f.write("};\n\n")
        f.write("export type Step = { id: string; title: string; intro?: string; special?: boolean; items: string[] };\n\n")
        f.write("export const QUESTIONS: Record<string, Question> = ")
        f.write(json.dumps(questions, ensure_ascii=False, indent=2))
        f.write(";\n\n")
        f.write("export const STEPS: Step[] = ")
        f.write(json.dumps(steps, ensure_ascii=False, indent=2))
        f.write(";\n\n")
        f.write(f"export const PASSION_OPTIONS = {json.dumps(PASSION_OPTIONS, ensure_ascii=False)};\n")
    print(f"[+] {os.path.normpath(OUT)}: {len(questions)} questions, {len(steps)} steps")


if __name__ == "__main__":
    main()
