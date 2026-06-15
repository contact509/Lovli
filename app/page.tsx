export default function Home() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
      }}
    >
      <h1 style={{ fontSize: "2.5rem", fontWeight: 600, letterSpacing: "0.04em" }}>
        Lovli
      </h1>
      <p style={{ opacity: 0.7, maxWidth: 420, lineHeight: 1.6 }}>
        Najpierw poznaj — wygląd na końcu. Relacje oparte na wspólnych
        wartościach.
      </p>
      <p style={{ opacity: 0.35, fontSize: "0.8rem", marginTop: "3rem" }}>
        Wkrótce.
      </p>
    </main>
  );
}
