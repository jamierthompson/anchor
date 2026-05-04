import type { Metadata } from "next";
import { JetBrains_Mono } from "next/font/google";
import Script from "next/script";

import { Footer } from "@/components/features/footer/footer";
import { Nav } from "@/components/features/nav/nav";
import { Shell } from "@/components/features/shell/shell";

import "./globals.css";
import styles from "./layout.module.css";

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

/*
 * Theme init script — applies the saved light/dark preference to
 * <html data-theme> before React hydrates and before the body paints,
 * so a user who picked "dark" on /system never sees a flash of the
 * OS-preferred theme on subsequent loads.
 *
 * Three things are deliberate here:
 *
 * 1. We target document.documentElement (always present once the
 *    parser hits <html>), not a body-level wrapper that would have
 *    to be parsed first. With strategy="beforeInteractive" Next.js
 *    inlines this script in the document head, so a body-level
 *    target wouldn't yet exist when it runs.
 *
 * 2. We use next/script (not a raw <script> tag in JSX) because
 *    React 19 warns when it encounters <script> tags during render —
 *    they're a no-op on client navigation, only firing on SSR. The
 *    Script component is the framework's escape hatch for this case.
 *
 * 3. localStorage access is wrapped in try/catch because some
 *    browsers throw on access in private mode or when storage is
 *    disabled. Falling back to OS preference is the right behavior
 *    in those cases — losing persistence is not a critical failure
 *    for a non-essential preference.
 */
const initThemeScript = `
  try {
    var saved = localStorage.getItem("anchor-theme");
    if (saved === "light" || saved === "dark") {
      document.documentElement.dataset.theme = saved;
    }
  } catch {}
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    /*
     * suppressHydrationWarning on <html> is required because the
     * init script above mutates the data-theme attribute before
     * React hydrates. Without it, React would log a mismatch warning
     * for the html element on every load with a saved theme. The
     * prop only suppresses warnings on this single element — it
     * does NOT disable hydration mismatch detection for descendants.
     */
    <html
      lang="en"
      className={jetbrainsMono.variable}
      suppressHydrationWarning
    >
      <body>
        {/*
         * Skip link is the first focusable element on every page.
         * Hidden visually until it receives focus (see layout.module.css).
         * Targets the per-page <main id="main-content"> element so
         * keyboard users can bypass the nav without clicking through it.
         */}
        <a href="#main-content" className={styles.skipLink}>
          Skip to main content
        </a>
        {/*
         * Shell is a thin client wrapper that branches on the current
         * pathname so /demo can render the nav + page + footer inside
         * a scroll-snap container, while every other route keeps the
         * default min-height: 100dvh grid. Slots stay server-rendered.
         */}
        <Shell nav={<Nav />} footer={<Footer />}>
          {children}
        </Shell>
        <Script id="anchor-theme-init" strategy="beforeInteractive">
          {initThemeScript}
        </Script>
      </body>
    </html>
  );
}
