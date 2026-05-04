import styles from "./type-scale.module.css";

/*
 * Type scale documentation. Three small tables under
 * Foundations → Typography:
 *
 *   1. Sizes      — every --font-size-* token, with a live sample
 *                   set at the actual token's size so the scale is
 *                   readable, not just claimed.
 *   2. Weights    — the two weights the system uses (regular/medium).
 *   3. Line heights — tight vs base, with multi-line samples that
 *                     show the difference visibly.
 *
 * Server Component — entirely static once tokens resolve. The text
 * content doesn't depend on theme or any browser state, so this
 * doesn't need to be a client island.
 */

const SAMPLE = "The quick brown fox jumps over the lazy dog";

type SizeRow = {
  /** CSS custom property name, including the `--` prefix. */
  token: string;
  /** Resolved value. Documenting it here makes the table readable
   *  without needing to crack open globals.css. */
  value: string;
  /** What this step is used for in the system. */
  usage: string;
};

const SIZES: SizeRow[] = [
  {
    token: "--font-size-1",
    value: "10px",
    usage: "Eyebrow labels, legend keycap text",
  },
  {
    token: "--font-size-2",
    value: "11px",
    usage: "Section labels, shortcut sheet keycap text",
  },
  {
    token: "--font-size-3",
    value: "12px",
    usage: "Chip text, instance pills, inline metadata",
  },
  {
    token: "--font-size-4",
    value: "13px",
    usage: "Body — log lines, default UI text",
  },
  {
    token: "--font-size-5",
    value: "14px",
    usage: "Surface header (e.g. shortcut sheet title)",
  },
  {
    token: "--font-size-page-h3",
    value: "14px",
    usage: "/system subsection heading (Roles, Sizes, Breakpoints, …)",
  },
  {
    token: "--font-size-page-h2",
    value: "18px",
    usage: "/system section heading (Color, Typography, …)",
  },
  {
    token: "--font-size-page-h1",
    value: "22px",
    usage: "/system page title",
  },
];

type WeightRow = {
  token: string;
  value: string;
  usage: string;
};

const WEIGHTS: WeightRow[] = [
  {
    token: "--font-weight-regular",
    value: "400",
    usage: "Default body text",
  },
  {
    token: "--font-weight-medium",
    value: "500",
    usage: "Emphasis — chip text, level prefixes, headings, labels",
  },
];

type LineHeightRow = {
  token: string;
  value: string;
  usage: string;
};

const LINE_HEIGHTS: LineHeightRow[] = [
  {
    token: "--line-height-tight",
    value: "1.2",
    usage: "Headings, single-line UI",
  },
  {
    token: "--line-height-base",
    value: "1.4",
    usage: "Body, multi-line text",
  },
];

export function TypeScale() {
  return (
    <div className={styles.root}>
      {/* ---------- Sizes ---------- */}
      <section className={styles.subsection} aria-labelledby="type-sizes">
        <h3 id="type-sizes" className={styles.subheading}>
          Sizes
        </h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Value</th>
              <th scope="col">Usage</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {SIZES.map((row) => (
              <tr key={row.token}>
                <td>
                  <code className={styles.token}>{row.token}</code>
                </td>
                <td className={styles.value}>{row.value}</td>
                <td className={styles.usage}>{row.usage}</td>
                <td
                  className={styles.sample}
                  style={{ fontSize: `var(${row.token})` }}
                >
                  {SAMPLE}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------- Weights ---------- */}
      <section className={styles.subsection} aria-labelledby="type-weights">
        <h3 id="type-weights" className={styles.subheading}>
          Weights
        </h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Value</th>
              <th scope="col">Usage</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {WEIGHTS.map((row) => (
              <tr key={row.token}>
                <td>
                  <code className={styles.token}>{row.token}</code>
                </td>
                <td className={styles.value}>{row.value}</td>
                <td className={styles.usage}>{row.usage}</td>
                <td
                  className={styles.sample}
                  style={{ fontWeight: `var(${row.token})` }}
                >
                  {SAMPLE}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* ---------- Line heights ---------- */}
      <section className={styles.subsection} aria-labelledby="type-line-heights">
        <h3 id="type-line-heights" className={styles.subheading}>
          Line heights
        </h3>
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">Token</th>
              <th scope="col">Value</th>
              <th scope="col">Usage</th>
              <th scope="col">Sample</th>
            </tr>
          </thead>
          <tbody>
            {LINE_HEIGHTS.map((row) => (
              <tr key={row.token}>
                <td>
                  <code className={styles.token}>{row.token}</code>
                </td>
                <td className={styles.value}>{row.value}</td>
                <td className={styles.usage}>{row.usage}</td>
                <td
                  className={styles.sample}
                  style={{ lineHeight: `var(${row.token})` }}
                >
                  {SAMPLE}. {SAMPLE.toLowerCase()}.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
