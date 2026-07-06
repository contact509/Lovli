"use client";
import React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Button, Card, TextInput } from "@/components/ds";
import { track } from "@/lib/telemetry-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => track("login_view", "login"), []);

  async function submit() {
    setError("");
    setBusy(true);
    const { error: err } = await getSupabaseBrowser().auth.signInWithPassword({
      email: email.trim(), password,
    });
    if (err) {
      setBusy(false);
      return setError("Nieprawidłowy e-mail lub hasło.");
    }
    // Route by progress: no profile → register, unfinished quiz → onboarding.
    const res = await fetch("/api/profile");
    const j = res.ok ? await res.json() : { profile: null };
    if (!j.profile) router.push("/register");
    else if (!j.profile.onboarding_completed_at) router.push("/onboarding");
    else router.push("/matches");
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "420px", margin: "0 auto" }}>
      <h1 style={{ font: "var(--type-display)", fontSize: "clamp(28px, 5vw, 40px)", fontFamily: "var(--font-serif-display)", margin: 0 }}>
        Witaj z powrotem
      </h1>
      <Card>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          <TextInput label="E-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
          <TextInput label="Hasło" value={password} type="password"
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent) => e.key === "Enter" && submit()} />
          {error && <div style={{ font: "var(--type-caption)", color: "#B4462E" }}>{error}</div>}
          <Button full size="lg" disabled={busy} onClick={submit}>
            {busy ? "Loguję…" : "Zaloguj się"}
          </Button>
        </div>
      </Card>
      <p style={{ font: "var(--type-caption)", color: "var(--text-muted)", textAlign: "center" }}>
        Nie masz konta? <Link href="/register" style={{ color: "var(--accent-value)" }}>Dołącz do Lovli</Link>
      </p>
    </div>
  );
}
