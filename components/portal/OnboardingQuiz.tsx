"use client";
import React from "react";
import { useRouter } from "next/navigation";
import { QUESTIONS, STEPS, type Question } from "@/lib/onboarding/questions";
import { genderize, genderizeQuestion, type Gender } from "@/lib/gender";
import { Button, Card, TextInput, ValueSlider } from "@/components/ds";
import { track } from "@/lib/telemetry-client";

/**
 * The Lovli onboarding — 104 questions in 23 thematic steps (DEVELOPER_DOCS
 * §3/§8). Sliders between opposing poles (default 50 = no clear preference),
 * fundamental questions (faith, children) woven mid-flow and visually marked,
 * open questions last (they never reach the matching engine).
 *
 * Every step autosaves to the server; telemetry records step views/completes
 * and durations — that's the research layer (drop-off per screen, H1/D4/D7).
 */

type AnswerValue = number | string | number[];
type AnswersState = Record<string, AnswerValue>;

const LS_KEY = "lovli_onboarding_v1";

function visibleItems(step: { items: string[] }, answers: AnswersState): Question[] {
  return step.items
    .map((c) => QUESTIONS[c])
    .filter((q) => {
      if (!q) return false;
      if (!q.showIf) return true;
      const gate = answers[q.showIf.code];
      if (q.showIf.answered) return gate !== undefined && gate !== null;
      if (q.showIf.in) return typeof gate === "number" && q.showIf.in.includes(gate);
      return true;
    });
}

function isAnswered(q: Question, answers: AnswersState): boolean {
  const v = answers[q.code];
  if (q.code === "PAS_TEXT") return true; // optional free text
  if (q.type === "text") return typeof v === "string" && v.trim().length > 0;
  if (q.type === "multi") return Array.isArray(v);
  return v !== undefined && v !== null;
}

function stepComplete(step: { items: string[] }, answers: AnswersState): boolean {
  return visibleItems(step, answers).every((q) => q.type === "slider" || isAnswered(q, answers));
}

export function OnboardingQuiz() {
  const router = useRouter();
  const [answers, setAnswers] = React.useState<AnswersState>({});
  const [stepIdx, setStepIdx] = React.useState(0);
  const [loaded, setLoaded] = React.useState(false);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState("");
  const [gender, setGender] = React.useState<Gender | null>(null);
  const stepStart = React.useRef(Date.now());

  // Load saved progress: server autosave + localStorage fallback (local wins —
  // it may hold answers whose save request failed).
  React.useEffect(() => {
    (async () => {
      let merged: AnswersState = {};
      try {
        // profile gender drives grammatical forms in every rendered text
        const prof = await fetch("/api/profile");
        if (prof.ok) {
          const g = (await prof.json())?.profile?.gender;
          if (g === "male" || g === "female") setGender(g);
        }
      } catch {}
      try {
        const res = await fetch("/api/onboarding/save");
        if (res.ok) merged = { ...(await res.json()).answers };
      } catch {}
      try {
        const local = JSON.parse(localStorage.getItem(LS_KEY) ?? "{}");
        merged = { ...merged, ...local };
      } catch {}
      setAnswers(merged);
      // resume at the first step with an unanswered required question
      const idx = STEPS.findIndex((s) =>
        visibleItems(s, merged).some((q) => !isAnswered(q, merged) && q.type !== "slider")
        || visibleItems(s, merged).some((q) => q.type === "slider" && merged[q.code] === undefined)
      );
      setStepIdx(idx === -1 ? STEPS.length - 1 : idx);
      setLoaded(true);
      track("onboarding_started", "onboarding");
    })();
  }, []);

  React.useEffect(() => {
    if (!loaded) return;
    stepStart.current = Date.now();
    track("step_view", "onboarding", { step: STEPS[stepIdx]?.id, idx: stepIdx });
    window.scrollTo({ top: 0 });
  }, [stepIdx, loaded]);

  const set = (code: string, value: AnswerValue) => {
    setAnswers((prev) => {
      const next = { ...prev, [code]: value };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
  };

  const step = STEPS[stepIdx];
  const items = step ? visibleItems(step, answers) : [];
  const answeredCount = Object.values(QUESTIONS).filter((q) => isAnswered(q, answers) && answers[q.code] !== undefined).length;
  const progress = Math.round((answeredCount / Object.keys(QUESTIONS).length) * 100);
  const isLast = stepIdx === STEPS.length - 1;

  async function saveStep(stepAnswers: AnswersState) {
    try {
      await fetch("/api/onboarding/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: stepAnswers }),
      });
    } catch {} // localStorage still has it; submit re-validates server-side
  }

  async function next() {
    setError("");
    // untouched sliders count as the deliberate middle (50) — commit them
    const batch: AnswersState = {};
    const withDefaults = { ...answers };
    for (const q of items) {
      if (q.type === "slider" && withDefaults[q.code] === undefined) {
        withDefaults[q.code] = 50;
        set(q.code, 50);
      }
      if (withDefaults[q.code] !== undefined) batch[q.code] = withDefaults[q.code];
    }
    if (!stepComplete(step, withDefaults)) {
      setError("Odpowiedz na wszystkie pytania na tym ekranie, zanim przejdziesz dalej.");
      return;
    }
    track("step_complete", "onboarding", {
      step: step.id, idx: stepIdx, ms: Date.now() - stepStart.current,
    });
    await saveStep(batch);

    if (!isLast) {
      setStepIdx(stepIdx + 1);
      return;
    }
    // final submit — raw answers → engine payload → vector store
    setBusy(true);
    const res = await fetch("/api/onboarding/submit", { method: "POST" });
    if (res.ok) {
      try { localStorage.removeItem(LS_KEY); } catch {}
      track("onboarding_submitted", "onboarding");
      router.push("/poznaj-siebie"); // the reward comes before the matches
    } else {
      const j = await res.json().catch(() => ({}));
      setBusy(false);
      if (j.missing?.length) {
        const missIdx = STEPS.findIndex((s) => s.items.includes(j.missing[0]));
        setError(`Brakuje kilku odpowiedzi (np. w kroku „${STEPS[Math.max(missIdx, 0)]?.title}") — przechodzę tam.`);
        if (missIdx >= 0) setStepIdx(missIdx);
      } else {
        setError("Nie udało się zapisać profilu — spróbuj ponownie.");
      }
    }
  }

  if (!loaded) {
    return <p style={{ font: "var(--type-body)", color: "var(--text-muted)", textAlign: "center" }}>Wczytuję…</p>;
  }

  const special = step.special;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* progress */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
          <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)" }}>
            Krok {stepIdx + 1} z {STEPS.length}
          </span>
          <span style={{ font: "var(--type-caption)", color: "var(--accent-value)" }}>{progress}%</span>
        </div>
        <div style={{ height: "6px", borderRadius: "var(--radius-pill)", background: "var(--surface-veil)" }}>
          <div style={{
            height: "100%", width: `${Math.max(progress, 2)}%`, borderRadius: "var(--radius-pill)",
            background: "linear-gradient(90deg, var(--accent-value), var(--accent-reward))",
            transition: "width var(--dur-base) var(--ease-calm)",
          }} />
        </div>
      </div>

      <Card glow={special ? "amber" : "none"}>
        <div style={{ display: "flex", flexDirection: "column", gap: "22px" }}>
          <div>
            <h2 style={{
              margin: 0, fontFamily: "var(--font-serif-display)",
              fontSize: "clamp(22px, 4vw, 30px)", fontWeight: 600,
              color: special ? "var(--accent-reward)" : "var(--text-primary)",
            }}>
              {step.title}
            </h2>
            {step.intro && (
              <p style={{
                margin: "8px 0 0", font: "var(--type-body)", color: "var(--text-secondary)",
                fontFamily: special ? "var(--font-serif-quote)" : undefined,
                fontStyle: special ? "italic" : undefined,
              }}>
                {gender ? genderize(step.intro, gender) : step.intro}
              </p>
            )}
          </div>

          {items.map((q) => (
            <QuestionField key={q.code} q={q} answers={answers} set={set} gender={gender} />
          ))}

          {error && <div style={{ font: "var(--type-caption)", color: "#B4462E" }}>{error}</div>}

          <div style={{ display: "flex", justifyContent: "space-between", gap: "12px" }}>
            <Button variant="secondary" disabled={stepIdx === 0 || busy}
              onClick={() => setStepIdx(stepIdx - 1)}>
              ← Wstecz
            </Button>
            <Button variant={isLast ? "reward" : "primary"} disabled={busy} onClick={next}>
              {busy ? "Zapisuję…" : isLast ? "Zakończ — poznaj siebie" : "Dalej →"}
            </Button>
          </div>
        </div>
      </Card>

      <p style={{ font: "var(--type-micro)", color: "var(--text-muted)", textAlign: "center" }}>
        Postęp zapisuje się automatycznie — możesz wrócić w dowolnym momencie.
        Odpowiedzi otwarte nigdy nie trafiają do silnika dopasowań.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuestionField({
  q, answers, set, gender,
}: {
  q: Question; answers: AnswersState; set: (code: string, v: AnswerValue) => void;
  gender: Gender | null;
}) {
  const g = (t?: string) => (t && gender ? genderize(t, gender) : t ?? "");
  const qText = genderizeQuestion(q.code, q.text, gender);

  if (q.type === "slider") {
    const v = typeof answers[q.code] === "number" ? (answers[q.code] as number) : 50;
    return (
      <div>
        <p style={{ margin: "0 0 10px", font: "var(--type-body)", fontWeight: 500 }}>{qText}</p>
        <ValueSlider value={v} lowLabel={g(q.low)} highLabel={g(q.high)}
          onChange={(e) => set(q.code, parseInt(e.target.value, 10))} />
        {v === 50 && answers[q.code] === undefined && (
          <p style={{ margin: "4px 0 0", font: "var(--type-micro)", color: "var(--text-muted)", fontStyle: "italic" }}>
            Środek skali = brak wyraźnej preferencji
          </p>
        )}
      </div>
    );
  }

  if (q.type === "choice") {
    const v = answers[q.code];
    return (
      <div>
        <p style={{ margin: "0 0 10px", font: "var(--type-body)", fontWeight: 500 }}>{qText}</p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))", gap: "10px" }}>
          {q.options?.map((label, i) => (
            <button key={i} type="button" onClick={() => set(q.code, i)}
              style={{
                padding: "13px 14px", textAlign: "left", cursor: "pointer",
                borderRadius: "var(--radius-sm)",
                border: `2px solid ${v === i ? "var(--accent-value)" : "var(--border-hairline)"}`,
                background: v === i ? "var(--accent-value-tint)" : "var(--surface-raised)",
                color: "var(--text-primary)", font: "var(--type-body)", lineHeight: "var(--lh-snug)",
              }}>
              {g(label)}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (q.type === "multi") {
    const sel = Array.isArray(answers[q.code]) ? (answers[q.code] as number[]) : [];
    return (
      <div>
        <p style={{ margin: "0 0 10px", font: "var(--type-body)", fontWeight: 500 }}>{qText}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
          {q.options?.map((label, i) => {
            const on = sel.includes(i);
            return (
              <button key={i} type="button"
                onClick={() => set(q.code, on ? sel.filter((x) => x !== i) : [...sel, i])}
                style={{
                  padding: "9px 14px", cursor: "pointer", borderRadius: "var(--radius-pill)",
                  border: `1.5px solid ${on ? "var(--accent-value)" : "var(--border-hairline)"}`,
                  background: on ? "var(--accent-value-tint)" : "var(--surface-raised)",
                  color: "var(--text-primary)", font: "var(--type-caption)",
                }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  // text
  const v = typeof answers[q.code] === "string" ? (answers[q.code] as string) : "";
  return (
    <TextInput
      label={qText}
      multiline rows={5}
      value={v}
      maxLength={q.maxLen ?? 500}
      placeholder={q.code === "PAS_TEXT" ? "Opcjonalnie — opisz pasję spoza listy" : "Możesz pisać tyle, ile chcesz — liczy się autentyczność…"}
      helper={`${v.length}/${q.maxLen ?? 500}`}
      onChange={(e) => set(q.code, e.target.value.slice(0, q.maxLen ?? 500))}
    />
  );
}
