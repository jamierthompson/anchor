import styles from "./motion-scale.module.css";

/*
 * Motion scale documentation. Two panels side by side on desktop,
 * stacked on mobile:
 *
 *   Left  — the easing token. SVG curve sits on top of its meta
 *           (token, value, usage), giving the single foundational
 *           easing curve a hero treatment that matches its role
 *           (every transition in the system uses this curve).
 *   Right — the three duration tokens, each with meta on top and
 *           an auto-looping bar below. The bars run at 10× the
 *           actual product duration so the difference is felt;
 *           ratios are preserved.
 *
 * Server Component — no client state. Animations are pure CSS.
 *
 * prefers-reduced-motion is respected — the bars freeze at frame 0
 * on opted-out devices. The SVG curve is static and unaffected.
 */

type DurationToken = {
  token: string;
  value: string;
  usage: string;
  /** Bar's loop duration in seconds. 10× the product's --duration-* . */
  demoSeconds: number;
};

const EASING = {
  token: "--ease-standard",
  value: "cubic-bezier(0.32, 0.72, 0, 1)",
  usage: "Single easing curve applied to every transition",
};

const DURATIONS: DurationToken[] = [
  {
    token: "--duration-fast",
    value: "120ms",
    usage: "Dim / undim opacity changes",
    demoSeconds: 1.2,
  },
  {
    token: "--duration-base",
    value: "150ms",
    usage: "Text opacity on context expand / collapse",
    demoSeconds: 1.5,
  },
  {
    token: "--duration-slow",
    value: "200ms",
    usage: "Height transitions on context expand / collapse",
    demoSeconds: 2.0,
  },
];

/*
 * Cubic-bezier curve as an SVG path.
 *
 * cubic-bezier(0.32, 0.72, 0, 1) in math coordinates:
 *   start (0, 0), control1 (0.32, 0.72), control2 (0, 1), end (1, 1).
 * Scaled to a 100×100 viewBox and flipped on y (SVG y grows down).
 * The faint diagonal is a linear-easing reference; the gap between
 * the curve and the diagonal is the curve's character.
 */
function EasingCurve() {
  return (
    <svg viewBox="0 0 100 100" className={styles.curveSvg} aria-hidden="true">
      <line x1="0" y1="100" x2="100" y2="0" className={styles.curveRef} />
      <path
        d="M 0 100 C 32 28, 0 0, 100 0"
        className={styles.curvePath}
        fill="none"
      />
    </svg>
  );
}

function DurationBar({ seconds }: { seconds: number }) {
  return (
    <div className={styles.track}>
      <div
        className={styles.bar}
        style={{ animationDuration: `${seconds}s` }}
        aria-hidden="true"
      />
    </div>
  );
}

function TokenMeta({
  token,
  value,
  usage,
}: {
  token: string;
  value: string;
  usage: string;
}) {
  return (
    <div className={styles.meta}>
      <div className={styles.tokenLine}>
        <code className={styles.token}>{token}</code>
        <span className={styles.value}>{value}</span>
      </div>
      <p className={styles.usage}>{usage}</p>
    </div>
  );
}

export function MotionScale() {
  return (
    <div className={styles.root}>
      <section className={styles.easingPanel} aria-labelledby="motion-easing">
        <h3 id="motion-easing" className={styles.panelLabel}>
          Easing
        </h3>
        <EasingCurve />
        <TokenMeta
          token={EASING.token}
          value={EASING.value}
          usage={EASING.usage}
        />
      </section>

      <section
        className={styles.durationsPanel}
        aria-labelledby="motion-durations"
      >
        <h3 id="motion-durations" className={styles.panelLabel}>
          Durations
        </h3>
        <ul className={styles.durationList}>
          {DURATIONS.map((row) => (
            <li key={row.token} className={styles.durationItem}>
              <TokenMeta
                token={row.token}
                value={row.value}
                usage={row.usage}
              />
              <DurationBar seconds={row.demoSeconds} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
