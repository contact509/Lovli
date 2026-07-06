"use client";
import React from "react";
import { getSupabaseBrowser } from "@/lib/supabase-browser";

/** RODO: right to be forgotten — removes vectors, answers, profile, account. */
export function DeleteAccountButton() {
  const [busy, setBusy] = React.useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!window.confirm("Usunąć konto i WSZYSTKIE dane (profil, odpowiedzi, wektor)? Tej operacji nie można cofnąć.")) return;
        setBusy(true);
        const res = await fetch("/api/account/delete", { method: "POST" });
        if (res.ok) {
          await getSupabaseBrowser().auth.signOut().catch(() => {});
          window.location.href = "/";
        } else {
          setBusy(false);
          window.alert("Nie udało się usunąć konta — spróbuj ponownie.");
        }
      }}
      style={{
        background: "none", border: "none", cursor: "pointer",
        font: "var(--type-micro)", color: "var(--text-muted)", textDecoration: "underline",
      }}
    >
      {busy ? "Usuwam…" : "Usuń konto i wszystkie moje dane (RODO)"}
    </button>
  );
}
