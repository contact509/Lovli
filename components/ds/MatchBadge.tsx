"use client";
import React from "react";

/**
 * Lovli.IO match-score badge — a value-alignment percentage.
 * Emerald at high alignment, violet at moderate, fog at low. Optional ring gauge.
 */
export function MatchBadge({
  score = 0,
  label = "dopasowanie",
  size = "md",
  ring = true,
  style,
  ...rest
}: {
  score?: number;
  label?: string;
  size?: "sm" | "md" | "lg";
  ring?: boolean;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLSpanElement>, "style">) {
  const s = Math.max(0, Math.min(100, score));
  const tier = s >= 80 ? "var(--accent-success)" : s >= 55 ? "var(--accent-value)" : "var(--text-muted)";

  const dims =
    {
      sm: { d: 44, stroke: 4, num: "var(--fs-caption)" },
      md: { d: 64, stroke: 5, num: "var(--fs-h3)" },
      lg: { d: 88, stroke: 6, num: "var(--fs-h2)" },
    }[size] || { d: 64, stroke: 5, num: "var(--fs-h3)" };

  const r = (dims.d - dims.stroke) / 2;
  const circ = 2 * Math.PI * r;

  if (!ring) {
    return (
      <span
        style={{
          display: "inline-flex", alignItems: "center", gap: "6px",
          padding: "5px 12px", borderRadius: "var(--radius-pill)",
          background: `color-mix(in oklab, ${tier} 18%, transparent)`,
          border: `1px solid ${tier}`, color: tier,
          font: "var(--type-caption)",
          fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"],
          ...style,
        }}
        {...rest}
      >
        {s}%{" "}
        {label && (
          <span style={{ color: "var(--text-secondary)", fontWeight: "var(--fw-regular)" as React.CSSProperties["fontWeight"] }}>
            {label}
          </span>
        )}
      </span>
    );
  }

  return (
    <div
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: "6px", ...style }}
      {...rest}
    >
      <div style={{ position: "relative", width: dims.d, height: dims.d }}>
        <svg width={dims.d} height={dims.d} style={{ transform: "rotate(-90deg)" }}>
          <circle
            cx={dims.d / 2} cy={dims.d / 2} r={r}
            fill="none" stroke="var(--surface-veil)" strokeWidth={dims.stroke}
          />
          <circle
            cx={dims.d / 2} cy={dims.d / 2} r={r}
            fill="none" stroke={tier} strokeWidth={dims.stroke}
            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - s / 100)}
            style={{ transition: "stroke-dashoffset var(--dur-slow) var(--ease-calm)" }}
          />
        </svg>
        <span
          style={{
            position: "absolute", inset: 0,
            display: "flex", alignItems: "center", justifyContent: "center",
            font: "var(--type-h3)", fontSize: dims.num, fontFamily: "var(--font-serif-display)",
            fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"],
            color: "var(--text-primary)", fontVariantNumeric: "tabular-nums",
          }}
        >
          {s}
        </span>
      </div>
      {label && (
        <span
          style={{
            font: "var(--type-micro)", color: "var(--text-secondary)",
            letterSpacing: "var(--ls-caps)", textTransform: "uppercase",
          }}
        >
          {label}
        </span>
      )}
    </div>
  );
}
