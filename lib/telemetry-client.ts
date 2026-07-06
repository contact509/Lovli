"use client";

/**
 * Fire-and-forget research telemetry (retention, screen times, drop-offs —
 * the good-way.org behavioural layer). Never blocks or breaks the UI.
 */

const KEY = "lovli_session_id";

export function sessionId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = sessionStorage.getItem(KEY);
  if (!id) {
    id = Math.random().toString(36).slice(2) + Date.now().toString(36);
    sessionStorage.setItem(KEY, id);
  }
  return id;
}

export function track(event: string, screen?: string, props?: Record<string, unknown>) {
  try {
    const body = JSON.stringify({
      events: [{ event, screen, session_id: sessionId(), props }],
    });
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/telemetry", new Blob([body], { type: "application/json" }));
    } else {
      fetch("/api/telemetry", {
        method: "POST", body, keepalive: true,
        headers: { "Content-Type": "application/json" },
      }).catch(() => {});
    }
  } catch {}
}
