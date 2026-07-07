import React from "react";
import type { MatchBreakdown } from "@/lib/engine/scoring";

/**
 * Shared match-card pieces — used by the /matches list (server) and the
 * constellation person card (client).
 */

export const COMPONENT_LABELS: Array<[keyof MatchBreakdown, string]> = [
  ["values_alignment", "Wartości"],
  ["personality_alignment", "Osobowość"],
  ["goals_alignment", "Cele życiowe"],
  ["spiritual_alignment", "Duchowość"],
  ["dynamic_alignment", "Zgodność w interakcji"],
];

export function ComponentBars({
  components, labelWidth = 150,
}: {
  components: MatchBreakdown; labelWidth?: number;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {COMPONENT_LABELS.map(([key, label]) => {
        const v = components[key];
        if (v === null || v === undefined) return null;
        const pct = Math.round((v as number) * 100);
        return (
          <div key={key} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ font: "var(--type-caption)", color: "var(--text-secondary)", width: labelWidth, flexShrink: 0 }}>{label}</span>
            <div style={{ flex: 1, height: "5px", borderRadius: "var(--radius-pill)", background: "var(--surface-veil)" }}>
              <div style={{
                width: `${pct}%`, height: "100%", borderRadius: "var(--radius-pill)",
                background: pct >= 80 ? "var(--accent-success)" : "var(--accent-value)",
              }} />
            </div>
            <span style={{ font: "var(--type-caption)", color: "var(--text-muted)", width: "36px", textAlign: "right", flexShrink: 0 }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
