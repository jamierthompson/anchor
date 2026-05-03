import { ColorSwatches } from "@/components/features/system/color-swatches";
import { KeycapChrome } from "@/components/features/system/keycap-chrome";
import { MediaQueries } from "@/components/features/system/media-queries";
import { MotionScale } from "@/components/features/system/motion-scale";
import { RadiusScale } from "@/components/features/system/radius-scale";
import { SpacingScale } from "@/components/features/system/spacing-scale";
import { ThemeToggle } from "@/components/features/system/theme-toggle";
import { TypeScale } from "@/components/features/system/type-scale";
import { ZIndexScale } from "@/components/features/system/z-index-scale";

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

        <section
          className={styles.subsection}
          aria-labelledby="foundations-typography"
        >
          <h3
            id="foundations-typography"
            className={styles.subsectionHeading}
          >
            Typography
          </h3>
          <TypeScale />
        </section>

        <section
          className={styles.subsection}
          aria-labelledby="foundations-spacing"
        >
          <h3 id="foundations-spacing" className={styles.subsectionHeading}>
            Spacing
          </h3>
          <SpacingScale />
        </section>

        <section
          className={styles.subsection}
          aria-labelledby="foundations-radius"
        >
          <h3 id="foundations-radius" className={styles.subsectionHeading}>
            Radius
          </h3>
          <RadiusScale />
        </section>

        <section
          className={styles.subsection}
          aria-labelledby="foundations-shadow"
        >
          <h3 id="foundations-shadow" className={styles.subsectionHeading}>
            Shadow
          </h3>
          <KeycapChrome />
        </section>

        <section
          className={styles.subsection}
          aria-labelledby="foundations-motion"
        >
          <h3 id="foundations-motion" className={styles.subsectionHeading}>
            Motion
          </h3>
          <MotionScale />
        </section>

        <section
          className={styles.subsection}
          aria-labelledby="foundations-z-index"
        >
          <h3 id="foundations-z-index" className={styles.subsectionHeading}>
            Z-index
          </h3>
          <ZIndexScale />
        </section>

        <section
          className={styles.subsection}
          aria-labelledby="foundations-media"
        >
          <h3 id="foundations-media" className={styles.subsectionHeading}>
            Media
          </h3>
          <MediaQueries />
        </section>
      </section>
    </main>
  );
}