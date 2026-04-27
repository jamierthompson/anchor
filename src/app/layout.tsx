import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import "./globals.css";

/*
 * JetBrains Mono is the project's only typeface (per the visual
 * design spec — no font pairing). Loading it through next/font
 * gives us self-hosting, automatic font-display: swap, and a CSS
 * custom property that globals.css picks up via the --font-mono
 * fallback chain.
 *
 * Three weights are loaded:
 *   400 — body text (log lines, default UI text)
 *   500 — instance pills, level badges
 *   600 — used sparingly for emphasis
 *
 * The `variable` option exposes the font as --font-jetbrains-mono
 * on whichever element receives `jetbrainsMono.variable`. Applying
 * it to <html> makes it cascade everywhere.
 */
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Anchor",
  description: "A logs explorer prototype.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={jetbrainsMono.variable}>
      <body>{children}</body>
    </html>
  );
}
