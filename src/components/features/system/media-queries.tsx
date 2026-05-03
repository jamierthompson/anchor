import styles from "./media-queries.module.css";

/*
 * Custom media query documentation. Two tables under Foundations →
 * Media:
 *
 *   Breakpoints     — mobile-first min-width thresholds (--tablet,
 *                     --desktop)
 *   Accessibility   — preference-based queries (--reduced-motion)
 *
 * The Sample column is a tiny indicator dot that lights up (accent
 * color) when the row's media query currently matches, and stays
 * dim (border color) otherwise. CSS-only — the @media rules in
 * media-queries.module.css toggle each indicator's color, so the
 * dots update live as the viewport resizes or the OS preference
 * changes. Pure CSS, no listeners.
 *
 * Server Component. Tokens are static; the live state is rendered
 * by the browser, not React.
 */

type MediaRow = {
  token: string;
  /** Resolved expression. Documented inline so the table reads
   *  without cross-referencing custom-media.css. */
  value: string;
  usage: string;
  /** Class on the indicator dot. Each one has a matching @media
   *  rule in the CSS module that flips its color when the query
   *  resolves true. */
  indicatorClass: string;
};

/*
 * The mobile row has no custom-media token — it's the implicit
 * default state below --tablet. Showing it here makes the table
 * read as a complete picture of breakpoint *states* (the layout
 * actually in effect right now), which is what the live indicator
 * column communicates.
 */
const BREAKPOINTS: MediaRow[] = [
  {
    token: "—",
    value: "default",
    usage: "Mobile — single column, stacked-card layouts",
    indicatorClass: "indicatorMobile",
  },
  {
    token: "--tablet",
    value: "(min-width: 720px)",
    usage: "Tablet — tables expand from cards; grids step to 2 columns",
    indicatorClass: "indicatorTablet",
  },
  {
    token: "--desktop",
    value: "(min-width: 900px)",
    usage: "Desktop — grids step to their full column count",
    indicatorClass: "indicatorDesktop",
  },
];

const ACCESSIBILITY: MediaRow[] = [
  {
    token: "--reduced-motion",
    value: "(prefers-reduced-motion: reduce)",
    usage: "User opted out of motion at the OS level",
    indicatorClass: "indicatorReducedMotion",
  },
];

function MediaTable({ rows }: { rows: MediaRow[] }) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          <th scope="col">Token</th>
          <th scope="col">Value</th>
          <th scope="col">Usage</th>
          <th scope="col">Active</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.token}>
            <td>
              <code className={styles.token}>{row.token}</code>
            </td>
            <td className={styles.value}>{row.value}</td>
            <td className={styles.usage}>{row.usage}</td>
            <td>
              <span
                className={`${styles.indicator} ${
                  styles[row.indicatorClass as keyof typeof styles] ?? ""
                }`}
                aria-hidden="true"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function MediaQueries() {
  return (
    <div className={styles.root}>
      <section
        className={styles.subsection}
        aria-labelledby="media-breakpoints"
      >
        <h4 id="media-breakpoints" className={styles.subheading}>
          Breakpoints
        </h4>
        <MediaTable rows={BREAKPOINTS} />
      </section>

      <section
        className={styles.subsection}
        aria-labelledby="media-accessibility"
      >
        <h4 id="media-accessibility" className={styles.subheading}>
          Accessibility
        </h4>
        <MediaTable rows={ACCESSIBILITY} />
      </section>
    </div>
  );
}
