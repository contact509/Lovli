"use client";
import React from "react";

/**
 * Lovli.IO text field. Quiet input with violet focus glow.
 * Supports label, helper/error text, and a multiline mode for reflective answers.
 */
export function TextInput({
  label,
  value,
  onChange,
  placeholder = "",
  helper = "",
  error = "",
  multiline = false,
  rows = 4,
  disabled = false,
  id,
  style,
  ...rest
}: {
  label?: string;
  value?: string;
  onChange?: React.ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  placeholder?: string;
  helper?: string;
  error?: string;
  multiline?: boolean;
  rows?: number;
  disabled?: boolean;
  id?: string;
  style?: React.CSSProperties;
  type?: string;
  inputMode?: React.InputHTMLAttributes<HTMLInputElement>["inputMode"];
  maxLength?: number;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement | HTMLTextAreaElement>;
}) {
  const [focused, setFocused] = React.useState(false);
  const autoId = React.useId();
  const fieldId = id || autoId;

  const base: React.CSSProperties = {
    width: "100%",
    boxSizing: "border-box",
    background: "var(--surface-raised)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-sans)",
    fontSize: "var(--fs-body)",
    lineHeight: "var(--lh-body)",
    padding: "13px 16px",
    borderRadius: "var(--radius-sm)",
    border: `1px solid ${error ? "var(--accent-reward)" : focused ? "var(--accent-value)" : "var(--border-hairline)"}`,
    outline: "none",
    boxShadow: focused && !error ? "var(--glow-violet)" : "none",
    transition:
      "border-color var(--dur-base) var(--ease-calm), box-shadow var(--dur-base) var(--ease-calm)",
    resize: multiline ? "vertical" : "none",
    opacity: disabled ? 0.5 : 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", ...style }}>
      {label && (
        <label
          htmlFor={fieldId}
          style={{
            font: "var(--type-caption)",
            color: "var(--text-secondary)",
            letterSpacing: "var(--ls-caps)",
            textTransform: "uppercase",
          }}
        >
          {label}
        </label>
      )}
      {multiline ? (
        <textarea
          id={fieldId}
          value={value}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={onChange}
          style={base}
          {...(rest as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        />
      ) : (
        <input
          id={fieldId}
          type="text"
          value={value}
          placeholder={placeholder}
          disabled={disabled}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={onChange}
          style={base}
          {...rest}
        />
      )}
      {(helper || error) && (
        <span
          style={{
            font: "var(--type-caption)",
            color: error ? "var(--accent-reward)" : "var(--text-muted)",
          }}
        >
          {error || helper}
        </span>
      )}
    </div>
  );
}
