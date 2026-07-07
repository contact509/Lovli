"use client";
import React from "react";
import Link from "next/link";
import { Button, Card } from "@/components/ds";
import type { Portrait } from "@/lib/portrait";
import { track } from "@/lib/telemetry-client";

const WAIT_LINES = [
  "Czytamy Twoje odpowiedzi…",
  "Szukamy wspólnych wątków…",
  "Układamy Twój portret wartości…",
  "Jeszcze chwila — dobre rzeczy wymagają namysłu…",
];

/** Renders the stored portrait, or generates it with a calm waiting state. */
export function PortraitView({ initial }: { initial: Portrait | null }) {
  const [portrait, setPortrait] = React.useState<Portrait | null>(initial);
  const [error, setError] = React.useState(false);
  const [line, setLine] = React.useState(0);
  const started = React.useRef(false);

  React.useEffect(() => {
    if (portrait || started.current) return;
    started.current = true;
    track("portrait_requested", "poznaj-siebie");
    const t = setInterval(() => setLine((l) => (l + 1) % WAIT_LINES.length), 6000);
    fetch("/api/portrait", { method: "POST" })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        setPortrait((await r.json()).portrait);
      })
      .catch(() => setError(true))
      .finally(() => clearInterval(t));
    return () => clearInterval(t);
  }, [portrait]);

  if (error) {
    return (
      <Card>
        <p style={{ font: "var(--type-body)", margin: "0 0 14px" }}>
          Nie udało się przygotować portretu — spróbuj za chwilę.
        </p>
        <Button onClick={() => window.location.reload()}>Spróbuj ponownie</Button>
      </Card>
    );
  }

  if (!portrait) {
    return (
      <Card glow="violet">
        <div style={{ textAlign: "center", padding: "28px 8px" }}>
          <div style={{
            width: 44, height: 44, margin: "0 auto 18px", borderRadius: "50%",
            border: "3px solid var(--surface-veil)", borderTopColor: "var(--accent-value)",
            animation: "lovli-spin 0.9s linear infinite",
          }} />
          <style>{`@keyframes lovli-spin { to { transform: rotate(360deg); } }`}</style>
          <p style={{ fontFamily: "var(--font-serif-display)", fontSize: "20px", margin: "0 0 6px" }}>
            {WAIT_LINES[line]}
          </p>
          <p style={{ font: "var(--type-caption)", color: "var(--text-muted)", margin: 0 }}>
            To potrwa do minuty. Portret powstaje raz — z Twoich własnych odpowiedzi.
          </p>
        </div>
      </Card>
    );
  }

  const h3: React.CSSProperties = {
    margin: "0 0 10px", fontFamily: "var(--font-serif-display)",
    fontSize: "20px", fontWeight: 600, color: "var(--accent-value)",
  };
  const body: React.CSSProperties = {
    margin: 0, font: "var(--type-body)", lineHeight: "var(--lh-relaxed)", color: "var(--text-primary)",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <Card glow="amber">
        <p style={{
          margin: 0, fontFamily: "var(--font-serif-quote)", fontStyle: "italic",
          fontSize: "clamp(19px, 3.2vw, 24px)", lineHeight: "var(--lh-snug)", textAlign: "center",
        }}>
          „{portrait.naglowek}"
        </p>
      </Card>

      <Card>
        <h3 style={h3}>Jak wyglądasz w relacji</h3>
        <p style={body}>{portrait.w_relacji}</p>
      </Card>

      <Card>
        <h3 style={h3}>Twoje mocne strony w relacji</h3>
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {portrait.mocne_strony.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: "12px", alignItems: "flex-start" }}>
              <span style={{ fontSize: "22px", lineHeight: 1.3 }}>{m.emoji}</span>
              <div>
                <p style={{ ...body, fontWeight: 600 }}>{m.tytul}</p>
                <p style={{ ...body, color: "var(--text-secondary)" }}>{m.opis}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 style={h3}>Co jest dla ciebie absolutnie kluczowe</h3>
        <ul style={{ margin: 0, paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {portrait.kluczowe.map((k, i) => (
            <li key={i} style={body}>{k}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h3 style={h3}>Obszary, które warto zbadać</h3>
        <p style={body}>{portrait.do_zbadania}</p>
      </Card>

      <Card>
        <h3 style={h3}>Twoja wiodąca filozofia życiowa</h3>
        <p style={{ ...body, fontFamily: "var(--font-serif-quote)", fontStyle: "italic" }}>
          {portrait.filozofia}
        </p>
      </Card>

      <div style={{ textAlign: "center", marginTop: "6px" }}>
        <Link href="/matches" style={{ textDecoration: "none" }}>
          <Button variant="reward" size="lg">Zobacz swoje dopasowania →</Button>
        </Link>
      </div>
      <p style={{ font: "var(--type-micro)", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
        Portret opisuje Cię na podstawie Twoich odpowiedzi — nie ocenia i nie diagnozuje.
        Nie wpływa na dopasowania.
      </p>
    </div>
  );
}
