import styles from "./radius-scale.module.css";

/*
 * Radius scale documentation. Two steps mapped to "scales of chrome":
 * --radius-1 for small chrome (keycaps, chips), --radius-2 for the
 * default UI surface (pills, cards, modal content).
 *
 * The Sample column renders a small filled tile using the same
 * surface treatment as the rest of /system (elevated bg + hairline
 * border) so the corner reads at honest scale rather than as an
 * abstract diagram.
 */

type RadiusRow = {
  token: string;
  value: string;
  usage: string;
};

const RADII: RadiusRow[] = [
  {
    token: "--radius-1",
    value: "3px",
    usage: "Small chrome — keycaps, chips, request-id pills",
  },
  {
    token: "--radius-2",
    value: "4px",
    usage:
      "Default UI — pills, cards, table cells, modal content, swatch cards",
  },
];

export function RadiusScale() {
  return (
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
        {RADII.map((row) => (
          <tr key={row.token}>
            <td>
              <code className={styles.token}>{row.token}</code>
            </td>
            <td className={styles.value}>{row.value}</td>
            <td className={styles.usage}>{row.usage}</td>
            <td>
              <div
                className={styles.sample}
                style={{ borderRadius: `var(${row.token})` }}
                aria-hidden="true"
              />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
