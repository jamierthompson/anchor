"use client";

import { useSyncExternalStore } from "react";

import styles from "./color-swatches.module.css";

/*
 * Color swatches — renders every color token in the system as a
 * visual sample with its name, the active theme's OKLCH value, the
 * contrast ratio against the page bg (where applicable), and a
 * one-line usage description.
 *
 * Two layers of theme-awareness:
 *
 *   1. The visual sample uses `background: var(--color-bg)` etc., so
 *      its rendered color is whatever the active theme resolves to —
 *      no JS needed for the actual color rendering.
 *   2. The OKLCH value and contrast ratio shown next to each sample
 *      are *strings* and need to swap when the theme changes. This
 *      component subscribes to both the /system wrapper's data-theme
 *      attribute (via MutationObserver) and prefers-color-scheme
 *      (via matchMedia) so the text re-renders in lockstep with the
 *      visual on every theme change.
 */

type Theme = "light" | "dark";

type SwatchValue = {
  oklch: string;
  /** Contrast ratio against the page bg, with WCAG label. Optional —
   *  bg/border tokens have no contrast claim of their own. */
  contrast?: string;
};

type Swatch = {
  /** CSS custom property name, including the `--` prefix. */
  token: string;
  /** One-line description of what this token is for. */
  description: string;
  light: SwatchValue;
  dark: SwatchValue;
};

const NEUTRALS: Swatch[] = [
  {
    token: "--color-bg",
    description: "Page background",
    light: { oklch: "oklch(1.000 0 0)" },
    dark: { oklch: "oklch(0.145 0 0)" },
  },
  {
    token: "--color-bg-elevated",
    description: "Elevated surfaces — filter bar, popovers, cards",
    light: { oklch: "oklch(0.976 0 0)" },
    dark: { oklch: "oklch(0.187 0 0)" },
  },
  {
    token: "--color-fg",
    description: "Body text — log messages, default UI",
    light: { oklch: "oklch(0.205 0 0)", contrast: "17.93:1 AAA" },
    dark: { oklch: "oklch(0.946 0 0)", contrast: "16.91:1 AAA" },
  },
  {
    token: "--color-fg-muted",
    description: "Secondary text — timestamps, instance pills",
    light: { oklch: "oklch(0.465 0 0)", contrast: "7.00:1 AAA" },
    dark: { oklch: "oklch(0.685 0 0)", contrast: "7.04:1 AAA" },
  },
  {
    token: "--color-border",
    description: "Hairline borders — chip outlines, dividers",
    light: { oklch: "oklch(0.919 0 0)" },
    dark: { oklch: "oklch(0.285 0 0)" },
  },
];

const OPACITY_SAMPLE = "The quick brown fox jumps over the lazy dog.";

const ROLES: Swatch[] = [
  {
    token: "--color-accent",
    description: "Active/focus ink — chip brackets, focus outlines",
    light: { oklch: "oklch(0.485 0.180 349.8)", contrast: "7.11:1 AAA" },
    dark: { oklch: "oklch(0.725 0.175 349.8)", contrast: "7.48:1 AAA" },
  },
  {
    token: "--color-warn",
    description: "WARN level prefix in log lines",
    light: { oklch: "oklch(0.465 0.130 73.0)", contrast: "7.09:1 AAA" },
    dark: { oklch: "oklch(0.784 0.159 73.0)", contrast: "9.77:1 AAA" },
  },
  {
    token: "--color-error",
    description: "ERROR level prefix in log lines",
    light: { oklch: "oklch(0.485 0.200 27.3)", contrast: "7.07:1 AAA" },
    dark: { oklch: "oklch(0.730 0.200 27.3)", contrast: "7.05:1 AAA" },
  },
];

const WRAPPER_ID = "system-root";

/*
 * Active-theme resolution. If the /system wrapper has an explicit
 * data-theme set (from the toggle), that wins. Otherwise we fall
 * back to the OS preference via prefers-color-scheme — matching the
 * CSS that drives the actual visual rendering.
 */
function getActiveTheme(): Theme {
  const wrapper = document.getElementById(WRAPPER_ID);
  const explicit = wrapper?.dataset.theme;
  if (explicit === "light" || explicit === "dark") return explicit;
  return window.matchMedia("(prefers-color-scheme: light)").matches
    ? "light"
    : "dark";
}

/*
 * Subscribe to both inputs that can change the active theme:
 *   - data-theme on the /system wrapper (changed by ThemeToggle)
 *   - prefers-color-scheme media query (changed by the OS)
 *
 * We don't need to coordinate with ThemeToggle's internal listeners
 * — observing the wrapper attribute directly via MutationObserver
 * means this component reacts to any source that mutates the
 * attribute, including future ones.
 */
function subscribe(callback: () => void) {
  const media = window.matchMedia("(prefers-color-scheme: light)");
  media.addEventListener("change", callback);

  let observer: MutationObserver | null = null;
  const wrapper = document.getElementById(WRAPPER_ID);
  if (wrapper) {
    observer = new MutationObserver(callback);
    observer.observe(wrapper, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }

  return () => {
    media.removeEventListener("change", callback);
    observer?.disconnect();
  };
}

/*
 * SSR has no DOM and no media query. Picking "light" as the stable
 * server snapshot is arbitrary — useSyncExternalStore handles the
 * mismatch with a clean re-render once the client snapshot is
 * available, so this is just to satisfy the API contract.
 */
function getServerSnapshot(): Theme {
  return "light";
}

function useActiveTheme(): Theme {
  return useSyncExternalStore(subscribe, getActiveTheme, getServerSnapshot);
}

function SwatchCard({ swatch, theme }: { swatch: Swatch; theme: Theme }) {
  const active = swatch[theme];

  return (
    <div className={styles.card}>
      {/* The sample uses var(--token) so its color follows the active
          theme automatically. A hairline border keeps the sample
          visible when its color is close to the card's surface
          (e.g. --color-bg-elevated against the page bg). */}
      <div
        className={styles.sample}
        style={{ background: `var(${swatch.token})` }}
        aria-hidden="true"
      />
      <div className={styles.meta}>
        <code className={styles.token}>{swatch.token}</code>
        <p className={styles.description}>{swatch.description}</p>
        <code className={styles.value}>{active.oklch}</code>
        {active.contrast ? (
          <span className={styles.contrast}>{active.contrast}</span>
        ) : null}
      </div>
    </div>
  );
}

export function ColorSwatches() {
  const theme = useActiveTheme();

  return (
    <div className={styles.root}>
      <section className={styles.subsection} aria-labelledby="color-roles">
        <h3 id="color-roles" className={styles.subheading}>
          Roles
        </h3>
        <div className={styles.grid}>
          {ROLES.map((swatch) => (
            <SwatchCard key={swatch.token} swatch={swatch} theme={theme} />
          ))}
        </div>
      </section>

      <section className={styles.subsection} aria-labelledby="color-neutrals">
        <h3 id="color-neutrals" className={styles.subheading}>
          Neutrals
        </h3>
        <div className={styles.grid}>
          {NEUTRALS.map((swatch) => (
            <SwatchCard key={swatch.token} swatch={swatch} theme={theme} />
          ))}
        </div>
      </section>

      <section className={styles.subsection} aria-labelledby="color-opacity">
        <h3 id="color-opacity" className={styles.subheading}>
          Opacity
        </h3>

        {/*
         * Two prose samples side by side on tablet, stacked on
         * mobile. The "Dimmed" sample renders the same string with
         * opacity: var(--opacity-dimmed) applied so the rendered
         * contrast is visible at a glance — particularly useful in
         * light mode where dimmed text gets subtly closer to the
         * background.
         */}
        <div className={styles.opacityDemo}>
          <div className={styles.opacitySample}>
            <span className={styles.opacityLabel}>Default</span>
            <p className={styles.opacityText}>{OPACITY_SAMPLE}</p>
          </div>
          <div className={styles.opacitySample}>
            <span className={styles.opacityLabel}>Dimmed</span>
            <p
              className={`${styles.opacityText} ${styles.opacityDimmed}`}
            >
              {OPACITY_SAMPLE}
            </p>
          </div>
        </div>

        <div className={styles.opacityMeta}>
          <div className={styles.opacityTokenLine}>
            <code className={styles.opacityToken}>--opacity-dimmed</code>
            <span className={styles.opacityValue}>0.4</span>
          </div>
          <p className={styles.opacityDescription}>
            Applied to context-revealed log lines that don&apos;t match the
            active filter — keeps them readable but signals they&apos;re
            secondary.
          </p>
        </div>
      </section>
    </div>
  );
}
