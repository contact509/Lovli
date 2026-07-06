import Link from "next/link";
import { getSessionUser } from "@/lib/supabase-server";
import { SignOutButton } from "@/components/portal/SignOutButton";

/** Shared chrome for the portal (register/login/onboarding/matches). The
 *  frozen landing page at / is untouched — the portal lives on its own routes. */
export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      <header
        style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px clamp(16px, 5vw, 48px)",
          borderBottom: "1px solid var(--border-hairline)",
        }}
      >
        <Link
          href="/"
          style={{
            fontFamily: "var(--font-serif-display)", fontSize: "24px",
            fontWeight: 600, color: "var(--text-primary)", textDecoration: "none",
          }}
        >
          Lovli
        </Link>
        {user && <SignOutButton />}
      </header>
      <main
        style={{
          flex: 1, width: "100%", maxWidth: "760px", margin: "0 auto",
          padding: "clamp(20px, 4vw, 40px) 16px 64px",
        }}
      >
        {children}
      </main>
    </div>
  );
}
