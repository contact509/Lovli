"use client";

import { useState } from "react";
import { Button } from "@/components/ds";

export default function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (state === "sending" || state === "done") return;
    setState("sending");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <p className="wl-done">
        Jesteś na liście. Odezwiemy się, gdy ruszą pierwsze testy — i ani razu wcześniej.
      </p>
    );
  }

  return (
    <form className="wl-form" onSubmit={submit}>
      <input
        type="email"
        required
        placeholder="Twój adres e-mail"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        aria-label="Adres e-mail"
      />
      {/* honeypot — hidden from humans */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        style={{ position: "absolute", left: "-9999px" }}
      />
      <Button size="lg" type="submit" disabled={state === "sending"}>
        {state === "sending" ? "Zapisuję…" : "Dołącz do listy"}
      </Button>
      {state === "error" && (
        <p className="wl-err">Coś poszło nie tak — spróbuj jeszcze raz za chwilę.</p>
      )}
    </form>
  );
}
