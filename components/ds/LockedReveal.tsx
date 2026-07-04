"use client";
import React from "react";

/**
 * Lovli.IO signature element — a photo/content tile veiled behind a milky fog.
 * The photo is the REWARD: it de-blurs gradually as `progress` (0–100) rises.
 * At <100 it shows a lock affordance; at 100 the veil lifts.
 */
export function LockedReveal({
  src,
  progress = 0,
  label = "Zablokowane",
  caption = "",
  size = 220,
  onClick,
  style,
  ...rest
}: {
  src?: string;
  progress?: number;
  label?: string;
  caption?: string;
  size?: number;
  onClick?: React.MouseEventHandler<HTMLDivElement>;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "onClick" | "style">) {
  const clamped = Math.max(0, Math.min(100, progress));
  const unlocked = clamped >= 100;
  // more progress -> less blur (14px -> 0), veil fades out
  const blur = (1 - clamped / 100) * 14;
  const veil = 0.85 * (1 - clamped / 100);

  return (
    <div
      onClick={onClick}
      style={{
        position: "relative",
        width: size,
        height: size,
        minWidth: size,
        minHeight: size,
        flexShrink: 0,
        borderRadius: "var(--radius-lg)",
        overflow: "hidden",
        border: `1px solid ${unlocked ? "var(--accent-reward)" : "var(--border-hairline)"}`,
        boxShadow: unlocked ? "var(--glow-amber)" : "var(--shadow-md)",
        cursor: onClick ? "pointer" : "default",
        background: "var(--surface-veil)",
        ...style,
      }}
      {...rest}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt=""
          style={{
            width: "100%", height: "100%", objectFit: "cover",
            filter: `blur(${blur}px) saturate(${0.55 + clamped / 220}) sepia(${(1 - clamped / 100) * 0.28})`,
            transform: `scale(${1 + blur * 0.01})`,
            transition:
              "filter var(--dur-reveal) var(--ease-calm), transform var(--dur-reveal) var(--ease-calm)",
          }}
        />
      ) : (
        <div
          style={{
            width: "100%", height: "100%",
            background: "radial-gradient(circle at 50% 40%, var(--fog) 0%, var(--surface-card) 100%)",
          }}
        />
      )}

      {/* fog veil — warm mauve, not navy */}
      <div
        style={{
          position: "absolute", inset: 0,
          background: `rgba(122,102,112,${veil * 0.8})`,
          backdropFilter: `blur(${blur * 0.4}px)`,
          transition: "background var(--dur-reveal) var(--ease-calm)",
        }}
      />

      {/* lock affordance */}
      {!unlocked && (
        <div
          style={{
            position: "absolute", inset: 0,
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            gap: size >= 140 ? "var(--space-2)" : "4px",
            color: "#FFFFFF", textAlign: "center", padding: "var(--space-4)",
            textShadow: "0 1px 8px rgba(46,42,77,.5)",
          }}
        >
          <svg
            width={size >= 140 ? 26 : 18} height={size >= 140 ? 26 : 18}
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <rect x="5" y="11" width="14" height="9" rx="2.5" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          {size >= 140 && (
            <span style={{ font: "var(--type-caption)", letterSpacing: "var(--ls-wide)" }}>{label}</span>
          )}
        </div>
      )}

      {/* progress meter */}
      <div style={{ position: "absolute", left: "var(--space-3)", right: "var(--space-3)", bottom: "var(--space-3)" }}>
        <div style={{ height: "4px", borderRadius: "var(--radius-pill)", background: "rgba(0,0,0,0.35)" }}>
          <div
            style={{
              width: `${clamped}%`, height: "100%", borderRadius: "var(--radius-pill)",
              background: "var(--grad-reward)", boxShadow: "var(--glow-amber)",
              transition: "width var(--dur-slow) var(--ease-calm)",
            }}
          />
        </div>
        {caption && size >= 140 && (
          <div
            style={{
              font: "var(--type-micro)", fontSize: 11, color: "rgba(255,255,255,.9)",
              textShadow: "0 1px 6px rgba(46,42,77,.6)", marginTop: "6px",
            }}
          >
            {caption}
          </div>
        )}
      </div>
    </div>
  );
}
