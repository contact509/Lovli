"use client";
import React from "react";

/**
 * Lovli.IO primary action button.
 * variant: "primary" (violet depth gradient) | "secondary" (quiet outline) | "reward" (amber unlock) | "ghost"
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  full = false,
  disabled = false,
  icon = null,
  onClick,
  style,
  ...rest
}: {
  children?: React.ReactNode;
  variant?: "primary" | "secondary" | "reward" | "ghost";
  size?: "sm" | "md" | "lg";
  full?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  style?: React.CSSProperties;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onClick" | "style">) {
  const sizes = {
    sm: { padding: "10px 16px", font: "var(--fs-caption)", radius: "var(--radius-sm)", gap: "6px" },
    md: { padding: "14px 24px", font: "var(--fs-body)", radius: "var(--radius-pill)", gap: "8px" },
    lg: { padding: "17px 30px", font: "var(--fs-body-lg)", radius: "var(--radius-pill)", gap: "10px" },
  };
  const s = sizes[size] || sizes.md;

  const variants: Record<string, React.CSSProperties> = {
    primary: {
      background: "var(--grad-depth)",
      color: "var(--text-onAccent)",
      border: "1px solid transparent",
      boxShadow: "var(--glow-violet)",
    },
    reward: {
      background: "var(--grad-reward)",
      color: "#2E2A4D",
      border: "1px solid transparent",
      boxShadow: "var(--glow-amber)",
      fontWeight: "var(--fw-semibold)" as React.CSSProperties["fontWeight"],
    },
    secondary: {
      background: "transparent",
      color: "var(--text-primary)",
      border: "1px solid var(--border-strong)",
      boxShadow: "none",
    },
    ghost: {
      background: "transparent",
      color: "var(--accent-value)",
      border: "1px solid transparent",
      boxShadow: "none",
    },
  };
  const v = variants[variant] || variants.primary;

  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: s.gap,
        width: full ? "100%" : "auto",
        padding: s.padding,
        font: "var(--type-body)",
        fontSize: s.font,
        fontWeight: (v.fontWeight || "var(--fw-semibold)") as React.CSSProperties["fontWeight"],
        fontFamily: "var(--font-sans)",
        letterSpacing: "0.01em",
        whiteSpace: "nowrap",
        borderRadius: s.radius,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition:
          "transform var(--dur-fast) var(--ease-calm), filter var(--dur-fast) var(--ease-calm), box-shadow var(--dur-base) var(--ease-calm)",
        ...v,
        ...style,
      }}
      onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = "brightness(1.08)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; e.currentTarget.style.transform = "none"; }}
      onMouseDown={(e) => { if (!disabled) e.currentTarget.style.transform = "scale(0.97)"; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = "none"; }}
      {...rest}
    >
      {icon}
      {children}
    </button>
  );
}
