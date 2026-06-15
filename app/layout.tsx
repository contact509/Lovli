export const metadata = {
  title: "Lovli",
  description: "Najpierw poznaj — wygląd na końcu.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
          background: "#0e0e12",
          color: "#f3f1ea",
        }}
      >
        {children}
      </body>
    </html>
  );
}
