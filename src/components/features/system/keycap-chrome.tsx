import styles from "./keycap-chrome.module.css";

/*
 * Shadow + gradient documentation. The keycap chrome is the only
 * place in the system with a multi-layer visual recipe, so the
 * documentation gets a hands-on demo: two cards, each rendering a
 * real "keycap" against the parent surface that the consumer pairs
 * the recipe with in production.
 *
 *   Left card  — keycap on --color-bg          (sheet context)
 *   Right card — keycap on --color-bg-elevated (legend context)
 *
 * The gradient and shadow are applied via the actual tokens. Tuning
 * --shadow-keycap or --gradient-keycap in globals.css would update
 * this demo *and* the production keycaps simultaneously.
 *
 * Server Component — pure CSS rendering.
 */

const SAMPLE_KEY = "K";

type ChromeDemo = {
  /** Display label describing the parent-surface context. */
  label: string;
  /** Class for the card surface (sets the background color and font
   *  size for the cap to match the production consumer). */
  cardClass: keyof typeof styles;
  /** Class for the cap itself (sets size + base background). */
  capClass: keyof typeof styles;
};

const DEMOS: ChromeDemo[] = [
  {
    label: "On --color-bg-elevated (legend)",
    cardClass: "cardElevated",
    capClass: "capLegend",
  },
  {
    label: "On --color-bg (shortcut sheet)",
    cardClass: "cardBg",
    capClass: "capSheet",
  },
];

export function KeycapChrome() {
  return (
    <div className={styles.root}>
      <div className={styles.demos}>
        {DEMOS.map((demo) => (
          <div
            key={demo.label}
            className={`${styles.card} ${styles[demo.cardClass]}`}
          >
            <span className={`${styles.cap} ${styles[demo.capClass]}`}>
              {SAMPLE_KEY}
            </span>
            <span className={styles.label}>{demo.label}</span>
          </div>
        ))}
      </div>

      <dl className={styles.tokens}>
        <div className={styles.tokenRow}>
          <dt>
            <code className={styles.tokenName}>--shadow-keycap</code>
          </dt>
          <dd className={styles.tokenDescription}>
            5-layer recipe — inset rim highlight, inset concavity,
            translucent edge, hard-bottom shadow, soft drop shadow.
          </dd>
        </div>
        <div className={styles.tokenRow}>
          <dt>
            <code className={styles.tokenName}>--gradient-keycap</code>
          </dt>
          <dd className={styles.tokenDescription}>
            3-stop top-to-bottom highlight overlay — sells the cap as
            facing up under ambient light.
          </dd>
        </div>
      </dl>
    </div>
  );
}
