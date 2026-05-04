import styles from "./z-index-scale.module.css";

/*
 * Z-index documentation. Two layers above the page content,
 * documented as a side-by-side: a small visual stack on the left
 * showing how three layers paint over each other, and a token list
 * on the right.
 *
 * The stack is purely illustrative — three diagonally-offset tiles,
 * each rendered at the relevant z-index value. Reading the visual
 * top-to-bottom is the same as reading z-index ascending.
 */

type ZIndexRow = {
  token: string;
  value: string;
  usage: string;
};

const TOKENS: ZIndexRow[] = [
  {
    token: "--z-floating",
    value: "50",
    usage: "Fixed/sticky chrome (theme toggle) above page content",
  },
  {
    token: "--z-overlay",
    value: "100",
    usage: "Modal backdrop scrims, dialog underlays",
  },
  {
    token: "--z-modal",
    value: "101",
    usage: "Dialog content above its overlay",
  },
];

export function ZIndexScale() {
  return (
    <div className={styles.root}>
      {/*
       * Visual demo. Three diagonally-offset tiles stack from
       * bottom-left (page content, default stacking) up to
       * top-right (--z-modal). The order in the JSX matches paint
       * order; z-index is applied so the ordering would still be
       * correct if a sibling reordered the markup.
       */}
      <div className={styles.stack} aria-hidden="true">
        <div className={`${styles.tile} ${styles.tilePage}`}>
          <span className={styles.tileLabel}>Page content</span>
          <span className={styles.tileValue}>auto</span>
        </div>
        <div className={`${styles.tile} ${styles.tileFloating}`}>
          <span className={styles.tileLabel}>--z-floating</span>
          <span className={styles.tileValue}>50</span>
        </div>
        <div className={`${styles.tile} ${styles.tileOverlay}`}>
          <span className={styles.tileLabel}>--z-overlay</span>
          <span className={styles.tileValue}>100</span>
        </div>
        <div className={`${styles.tile} ${styles.tileModal}`}>
          <span className={styles.tileLabel}>--z-modal</span>
          <span className={styles.tileValue}>101</span>
        </div>
      </div>

      <dl className={styles.tokens}>
        {TOKENS.map((row) => (
          <div key={row.token} className={styles.tokenRow}>
            <dt className={styles.tokenLine}>
              <code className={styles.tokenName}>{row.token}</code>
              <span className={styles.tokenValue}>{row.value}</span>
            </dt>
            <dd className={styles.tokenDescription}>{row.usage}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
