import { ColorSwatches } from "@/components/features/system/color-swatches";
import { KeycapChrome } from "@/components/features/system/keycap-chrome";
import { MediaQueries } from "@/components/features/system/media-queries";
import { MotionScale } from "@/components/features/system/motion-scale";
import { RadiusScale } from "@/components/features/system/radius-scale";
import { SpacingScale } from "@/components/features/system/spacing-scale";
import { Toc } from "@/components/features/system/toc";
import { TypeScale } from "@/components/features/system/type-scale";
import { ZIndexScale } from "@/components/features/system/z-index-scale";

import styles from "./page.module.css";

/*
 * /system — the design-token reference page.
 *
 * Documents every token the logs explorer uses: color, typography,
 * spacing, radius, shadow, motion, z-index, and the custom-media
 * queries that drive responsive behavior. Each section is a
 * top-level H2; component-level subgroups (Roles, Sizes, Breakpoints,
 * etc.) are H3 with the same uppercase / muted styling.
 *
 * Layout splits on tablet+ — a sticky TOC on the left, content on
 * the right. Mobile stacks everything in a single column with the
 * TOC sitting above Color in flow.
 *
 * Server Component by default; the only client island is Toc
 * (IntersectionObserver for the active-section indicator).
 */
export default function SystemPage() {
  return (
    <main id="main-content" className={styles.page}>
      <header className={styles.header}>
        <h1 className={styles.title}>System</h1>
        <p className={styles.subtitle}>
          Design tokens powering the logs explorer.
        </p>
      </header>

      <div className={styles.layout}>
        <aside className={styles.tocColumn}>
          <Toc />
        </aside>

        <div className={styles.content}>
          <section
            id="section-color"
            className={styles.section}
            aria-labelledby="heading-color"
          >
            <h2 id="heading-color" className={styles.sectionHeading}>
              Color
            </h2>
            <ColorSwatches />
          </section>

          <section
            id="section-typography"
            className={styles.section}
            aria-labelledby="heading-typography"
          >
            <h2 id="heading-typography" className={styles.sectionHeading}>
              Typography
            </h2>
            <TypeScale />
          </section>

          <section
            id="section-spacing"
            className={styles.section}
            aria-labelledby="heading-spacing"
          >
            <h2 id="heading-spacing" className={styles.sectionHeading}>
              Spacing
            </h2>
            <SpacingScale />
          </section>

          <section
            id="section-radius"
            className={styles.section}
            aria-labelledby="heading-radius"
          >
            <h2 id="heading-radius" className={styles.sectionHeading}>
              Radius
            </h2>
            <RadiusScale />
          </section>

          <section
            id="section-shadow"
            className={styles.section}
            aria-labelledby="heading-shadow"
          >
            <h2 id="heading-shadow" className={styles.sectionHeading}>
              Shadow
            </h2>
            <KeycapChrome />
          </section>

          <section
            id="section-motion"
            className={styles.section}
            aria-labelledby="heading-motion"
          >
            <h2 id="heading-motion" className={styles.sectionHeading}>
              Motion
            </h2>
            <MotionScale />
          </section>

          <section
            id="section-z-index"
            className={styles.section}
            aria-labelledby="heading-z-index"
          >
            <h2 id="heading-z-index" className={styles.sectionHeading}>
              Z-index
            </h2>
            <ZIndexScale />
          </section>

          <section
            id="section-media"
            className={styles.section}
            aria-labelledby="heading-media"
          >
            <h2 id="heading-media" className={styles.sectionHeading}>
              Media
            </h2>
            <MediaQueries />
          </section>
        </div>
      </div>
    </main>
  );
}
