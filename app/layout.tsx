import { Playfair_Display, DM_Sans, Lora } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-playfair",
});

const dmSans = DM_Sans({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-dm-sans",
});

const lora = Lora({
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-lora",
});

export const metadata = {
  title: "Lovli.IO — Najpierw sens. Potem miłość.",
  description:
    "Poznaj wartości, cele i model szczęścia drugiej osoby. Zdjęcie odsłonisz, gdy zbudujecie dopasowanie.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pl" className={`${playfair.variable} ${dmSans.variable} ${lora.variable}`}>
      <body>{children}</body>
    </html>
  );
}
