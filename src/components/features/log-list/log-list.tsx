import type { DerivedLogLine } from "@/types/log";

import { LogLine } from "./log-line";
import styles from "./log-list.module.css";

/**
 * Renders a sequence of log lines.
 *
 * Uses <ul>/<li> to convey the sequence-and-identity semantics of a
 * log feed. The list is always the full fixed array — filtering and
 * View Context don't add or remove children, they toggle the visibility
 * flags on each line. The <li> wrapper carries those flags as data
 * attributes so CSS owns the hide/dim behavior:
 *
 *   data-visible="false" → display: none (will become height + opacity
 *     transitions in task #4 — the array stays stable so the animation
 *     can target stable identities).
 *   data-dimmed="true"   → opacity: var(--opacity-dimmed). Only set on
 *     lines that are visible but didn't match the active filter (i.e.
 *     revealed by a context window, once contexts arrive in task #3).
 */
export function LogList({ lines }: { lines: readonly DerivedLogLine[] }) {
  return (
    <ul className={styles.list}>
      {lines.map((line) => (
        <li
          key={line.id}
          className={styles.item}
          data-visible={line.isVisible}
          data-dimmed={line.isDimmed}
        >
          <LogLine line={line} />
        </li>
      ))}
    </ul>
  );
}
