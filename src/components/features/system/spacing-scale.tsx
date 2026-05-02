import styles from "./spacing-scale.module.css";

/*
 * Spacing scale documentation. A single table whose Sample column
 * shows a horizontal bar at the actual token's width — a quick way
 * to read the rhythm of the scale at a glance.
 *
 * Names mirror the multiplier of the 4px half-step
 * (--space-2 = 2 × 4px = 8px). The scale intentionally skips 5 and 7 — not needed at this time.
 *
 * Server Component — entirely static.
 */

type SpaceRow = {
  token: string;
  /** Resolved value, also passed inline as the bar's width. */
  value: string;
  /** Where this step actually appears in the codebase today. */
  usage: string;
};

const SPACES: SpaceRow[] = [
  {
    token: "--space-1",
    value: "4px",
    usage: "Hairline inset — chip brackets, request-id padding",
  },
  {
    token: "--space-2",
    value: "8px",
    usage: "Tight gap — instance pills, paired controls, dividers",
  },
  {
    token: "--space-3",
    value: "12px",
    usage: "Default gap and padding — log columns, card padding, table cells",
  },
  {
    token: "--space-4",
    value: "16px",
    usage: "Horizontal padding — log line gutters, legend bar",
  },
  {
    token: "--space-6",
    value: "24px",
    usage: "Section spacing — sheet groups, page header gaps",
  },
  {
    token: "--space-8",
    value: "32px",
    usage: "Page-scale padding — sheet, /system page, section margins",
  },
];

export function SpacingScale() {
  return (
    <div className={styles.root}>
      <p className={styles.note}>
        4px base unit on an 8px rhythm. Intentionally skips{" "}
        <code className={styles.token}>--space-5</code> (20px) and{" "}
        <code className={styles.token}>--space-7</code> (28px).
      </p>

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
          {SPACES.map((row) => (
            <tr key={row.token}>
              <td>
                <code className={styles.token}>{row.token}</code>
              </td>
              <td className={styles.value}>{row.value}</td>
              <td className={styles.usage}>{row.usage}</td>
              <td>
                {/*
                 * Sample bar — width is set to the actual token via
                 * inline style. Reading left-to-right, neighboring
                 * rows' bars compare directly without needing a ruler.
                 */}
                <div
                  className={styles.bar}
                  style={{ width: `var(${row.token})` }}
                  aria-hidden="true"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}