import type { LogLine as LogLineType } from "@/types/log";

import { LogLine } from "./log-line";
import styles from "./log-list.module.css";

/**
 * Renders a sequence of log lines.
 *
 * Uses <ul>/<li> to convey the sequence-and-identity semantics of a
 * log feed. The list is the full fixed array — filtering and View
 * Context don't add or remove children, they toggle visibility flags
 * on the lines themselves. Wiring those flags through the renderer
 * is a later task.
 */
export function LogList({ lines }: { lines: readonly LogLineType[] }) {
  return (
    <ul className={styles.list}>
      {lines.map((line) => (
        <li key={line.id} className={styles.item}>
          <LogLine line={line} />
        </li>
      ))}
    </ul>
  );
}
