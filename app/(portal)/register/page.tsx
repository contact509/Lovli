"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Button, Card, TextInput } from "@/components/ds";
import { track } from "@/lib/telemetry-client";

const GENDERS = [
  { v: "female", label: "Kobieta" },
  { v: "male", label: "Mężczyzna" },
];

function PickOne({
  label, value, onPick, options,
}: {
  label: string; value: string | null;
  onPick: (v: string) => void; options: { v: string; label: string }[];
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)", letterSpacing: "var(--ls-caps)", textTransform: "uppercase" }}>
        {label}
      </span>
      <div style={{ display: "flex", gap: "10px" }}>
        {options.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onPick(o.v)}
            style={{
              flex: 1, padding: "13px 10px", cursor: "pointer",
              borderRadius: "var(--radius-sm)",
              border: `2px solid ${value === o.v ? "var(--accent-value)" : "var(--border-hairline)"}`,
              background: value === o.v ? "var(--accent-value-tint)" : "var(--surface-raised)",
              color: "var(--text-primary)", font: "var(--type-body)",
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const [hasSession, setHasSession] = React.useState(false);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [displayName, setDisplayName] = React.useState("");
  const [gender, setGender] = React.useState<string | null>(null);
  const [seeking, setSeeking] = React.useState<string | null>(null);
  const [birthYear, setBirthYear] = React.useState("");
  const [consent, setConsent] = React.useState(false);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => {
    track("register_view", "register");
    getSupabaseBrowser().auth.getUser().then(({ data }) => {
      if (data.user) {
        setHasSession(true);
        setEmail(data.user.email ?? "");
      }
    });
  }, []);

  async function submit() {
    setError("");
    const year = parseInt(birthYear, 10);
    if (!displayName.trim()) return setError("Podaj imię.");
    if (!gender || !seeking) return setError("Zaznacz płeć i kogo szukasz.");
    if (!Number.isInteger(year) || year < 1920 || year > new Date().getFullYear() - 18)
      return setError("Lovli jest dla osób pełnoletnich — sprawdź rok urodzenia.");
    if (!consent) return setError("Udział w projekcie badawczym wymaga zgody.");

    setBusy(true);
    try {
      if (!hasSession) {
        if (!email.trim() || password.length < 8) {
          setBusy(false);
          return setError("Podaj e-mail i hasło (min. 8 znaków).");
        }
        const { error: signErr } = await getSupabaseBrowser().auth.signUp({
          email: email.trim(), password,
        });
        if (signErr) {
          setBusy(false);
          return setError(
            /already/i.test(signErr.message)
              ? "To konto już istnieje — zaloguj się."
              : `Rejestracja nie powiodła się: ${signErr.message}`
          );
        }
      }
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(), gender, seeking,
          birth_year: year, research_consent: consent,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        setBusy(false);
        return setError(j.error ?? "Nie udało się zapisać profilu.");
      }
      track("register_completed", "register");
      router.push("/onboarding");
    } catch {
      setBusy(false);
      setError("Coś poszło nie tak — spróbuj ponownie.");
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "480px", margin: "0 auto" }}>
      <div>
        <h1 style={{ font: "var(--type-display)", fontSize: "clamp(28px, 5vw, 40px)", fontFamily: "var(--font-serif-display)", margin: "0 0 8px" }}>
          Dołącz do Lovli
        </h1>
        <p style={{ font: "var(--type-body)", color: "var(--text-secondary)", margin: 0 }}>
          Najpierw poznaj. Potem zobaczysz. Konto zakłada się raz — potem czeka Cię
          rozmowa z samym sobą (ok. 25 minut), z której powstaje Twój profil wartości.
        </p>
      </div>

      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {!hasSession && (
            <>
              <TextInput label="E-mail" value={email} placeholder="ty@przyklad.pl"
                onChange={(e) => setEmail(e.target.value)} />
              <TextInput label="Hasło" value={password} placeholder="min. 8 znaków"
                type="password" onChange={(e) => setPassword(e.target.value)} />
            </>
          )}
          <TextInput label="Imię" value={displayName} placeholder="Jak mamy się do Ciebie zwracać?"
            helper="Widoczne dopiero po wzajemnym odsłonięciu — dopasowania widzą tylko inicjały."
            onChange={(e) => setDisplayName(e.target.value)} />
          <PickOne label="Płeć" value={gender} onPick={setGender} options={GENDERS} />
          <PickOne label="Kogo szukasz" value={seeking} onPick={setSeeking}
            options={[{ v: "female", label: "Kobiety" }, { v: "male", label: "Mężczyzny" }]} />
          <TextInput label="Rok urodzenia" value={birthYear} placeholder="np. 1996"
            inputMode="numeric" onChange={(e) => setBirthYear(e.target.value.replace(/\D/g, "").slice(0, 4))} />

          <label style={{ display: "flex", gap: "10px", alignItems: "flex-start", cursor: "pointer" }}>
            <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)}
              style={{ marginTop: "3px", accentColor: "var(--accent-value)" }} />
            <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)", lineHeight: "var(--lh-relaxed)" }}>
              Wyrażam zgodę na udział w projekcie badawczym Fundacji Good Way i przetwarzanie
              moich odpowiedzi w celach badawczych (anonimizowane analizy). Mogę w każdej
              chwili usunąć konto wraz ze wszystkimi danymi (RODO).
            </span>
          </label>

          {error && (
            <div style={{ font: "var(--type-caption)", color: "#B4462E" }}>{error}</div>
          )}

          <Button full size="lg" disabled={busy} onClick={submit}>
            {busy ? "Tworzę konto…" : "Załóż konto i zacznij"}
          </Button>
        </div>
      </Card>

      <p style={{ font: "var(--type-caption)", color: "var(--text-muted)", textAlign: "center" }}>
        Masz już konto? <Link href="/login" style={{ color: "var(--accent-value)" }}>Zaloguj się</Link>
      </p>
    </div>
  );
}
