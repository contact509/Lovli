"use client";
import React from "react";

/**
 * Lovli.IO value slider — used to weight a personal value ("jak ważne jest dla
 * Ciebie…") on a continuum. Violet track fill, luminous thumb, live label.
 */
export function ValueSlider({
  label,
  min = 0,
  max = 100,
  value = 50,
  onChange,
  lowLabel = "",
  highLabel = "",
  accent = "violet",
  disabled = false,
  style,
  ...rest
}: {
  label?: string;
  min?: number;
  max?: number;
  value?: number;
  onChange?: React.ChangeEventHandler<HTMLInputElement>;
  lowLabel?: string;
  highLabel?: string;
  accent?: "violet" | "amber" | "emerald";
  disabled?: boolean;
  style?: React.CSSProperties;
}) {
  const pct = ((value - min) / (max - min)) * 100;
  const accents = {
    violet: "var(--accent-value)",
    amber: "var(--accent-reward)",
    emerald: "var(--accent-success)",
  };
  const c = accents[accent] || accents.violet;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--space-3)",
        opacity: disabled ? 0.5 : 1,
        ...style,
      }}
    >
      {label && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <span style={{ font: "var(--type-body)", color: "var(--text-primary)" }}>{label}</span>
          <span style={{ font: "var(--type-caption)", color: c, fontVariantNumeric: "tabular-nums" }}>
            {value}
          </span>
        </div>
      )}
      <div style={{ position: "relative", height: "22px", display: "flex", alignItems: "center" }}>
        <div
          style={{
            position: "absolute", left: 0, right: 0, height: "6px",
            borderRadius: "var(--radius-pill)", background: "var(--surface-veil)",
          }}
        />
        <div
          style={{
            position: "absolute", left: 0, width: `${pct}%`, height: "6px",
            borderRadius: "var(--radius-pill)",
            background: `linear-gradient(90deg, color-mix(in oklab, ${c} 60%, transparent), ${c})`,
          }}
        />
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={onChange}
          style={{
            position: "relative", width: "100%", margin: 0,
            appearance: "none", WebkitAppearance: "none", background: "transparent",
            cursor: disabled ? "not-allowed" : "pointer", height: "22px",
            ["--thumb" as string]: c,
          }}
          {...rest}
        />
      </div>
      {(lowLabel || highLabel) && (
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ font: "var(--type-caption)", color: "var(--text-muted)" }}>{lowLabel}</span>
          <span style={{ font: "var(--type-caption)", color: "var(--text-muted)" }}>{highLabel}</span>
        </div>
      )}
      <style>{`
        input[type=range]::-webkit-slider-thumb{
          -webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;
          background:#FFFFFF;border:3px solid var(--thumb,#7C5CE6);
          box-shadow:0 2px 8px rgba(70,55,30,.2);cursor:pointer;margin-top:0;
        }
        input[type=range]::-moz-range-thumb{
          width:20px;height:20px;border-radius:50%;background:#FFFFFF;
          border:3px solid var(--thumb,#7C5CE6);box-shadow:0 2px 8px rgba(70,55,30,.2);cursor:pointer;
        }
      `}</style>
    </div>
  );
}
