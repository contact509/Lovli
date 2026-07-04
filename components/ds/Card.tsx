"use client";
import React from "react";

/**
 * Lovli.IO surface card — white panel used for modals, list items,
 * and value/profile blocks. Soft radius, hairline border, optional glow.
 */
export function Card({
  children,
  variant = "default",
  glow = "none",
  padding = "var(--space-6)",
  style,
  ...rest
}: {
  children?: React.ReactNode;
  variant?: "default" | "raised" | "cosmos";
  glow?: "none" | "violet" | "amber" | "emerald";
  padding?: string;
  style?: React.CSSProperties;
} & Omit<React.HTMLAttributes<HTMLDivElement>, "style">) {
  const surfaces: Record<string, React.CSSProperties> = {
    default: { background: "var(--surface-card)" },
    raised: { background: "var(--surface-raised)" },
    cosmos: { background: "var(--bg-cosmos)" },
  };
  const glows: Record<string, string> = {
    none: "var(--shadow-md)",
    violet: "var(--shadow-md), var(--glow-violet)",
    amber: "var(--shadow-md), var(--glow-amber)",
    emerald: "var(--shadow-md), var(--glow-emerald)",
  };

  return (
    <div
      style={{
        borderRadius: "var(--radius-lg)",
        border: "1px solid var(--border-hairline)",
        padding,
        color: "var(--text-primary)",
        boxShadow: glows[glow] || glows.none,
        ...(surfaces[variant] || surfaces.default),
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
