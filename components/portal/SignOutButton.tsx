"use client";
import { getSupabaseBrowser } from "@/lib/supabase-browser";
import { Button } from "@/components/ds";

export function SignOutButton() {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={async () => {
        await getSupabaseBrowser().auth.signOut();
        window.location.href = "/login";
      }}
    >
      Wyloguj
    </Button>
  );
}
