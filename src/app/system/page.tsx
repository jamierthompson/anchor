import { ColorSwatches } from "@/components/features/system/color-swatches";
import { ThemeToggle } from "@/components/features/system/theme-toggle";

import styles from "./page.module.css";

/*
 * /system — the project's design-system reference page.
 *
 * This route documents the foundations (color, typography, spacing,
 * motion) and, eventually, the atomic components used by the logs
 * explorer. It's both a working spec — confirming each token has a
 * named purpose and lives at the right level of the scale — and a
 * surface to demonstrate the system underneath the app.
 *
 * Server Component by default; no per-request data, no browser-only
 * APIs at this level. Interactive pieces (theme toggle, color swatch
 * value readouts) are isolated to small client islands so the page
 * stays statically renderable.
 */
export default function SystemPage() {
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <div>
          <h1 className={styles.title}>System</h1>
          <p className={styles.subtitle}>
            Design tokens and components powering the logs explorer.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <section className={styles.section} aria-labelledby="foundations">
        <h2 id="foundations" className={styles.sectionHeading}>
          Foundations
        </h2>

        <section
          className={styles.subsection}
          aria-labelledby="foundations-color"
        >
          <h3 id="foundations-color" className={styles.subsectionHeading}>
            Color
          </h3>
          <ColorSwatches />
        </section>

        {/* Typography, Spacing, and Motion subsections will land here. */}
      </section>
    </main>
  );
}