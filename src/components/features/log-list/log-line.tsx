import type { LogLine as LogLineType, Level } from "@/types/log";

import styles from "./log-line.module.css";

/**
 * Static renderer for a single log line.
 *
 * Two render shapes:
 *   - Deploy-boundary lines render as a centered horizontal rule with
 *     the deploy text inline. They have no time / instance / message
 *     columns and stay visible regardless of filter.
 *   - Regular lines render as a three-column grid: time, instance pill,
 *     message. WARN and ERROR levels are prefixed with a colored level
 *     word; INFO and DEBUG use the default text color. Request IDs
 *     append as a small badge at the end of the message column.
 *
 * Per-line elements (instance pill, level badge, request id badge) are
 * non-interactive — filtering is applied via the scenario-chips bar
 * above the list. The line itself is a single click-target — the parent
 * <li> handles the click (focus + optional context toggle); see
 * LogListItem.
 */

type LogLineProps = {
  line: LogLineType;
  /**
   * Whether this line is currently rendered (vs collapsed to
   * height: 0). Kept for symmetry with the other derived flags;
   * currently unused inside LogLine itself.
   */
  isVisible?: boolean;
  /**
   * Drives the dim opacity. Lives on the inner element (this component's
   * root) so it composes cleanly with the visibility opacity applied
   * to the parent <li> during expand/collapse — see
   * log-list.module.css for the composition rationale.
   */
  isDimmed?: boolean;
  /**
   * Whether this line is currently anchoring an open View Context
   * window. The matching <li> carries `data-selected="true"` to drive
   * the left-border accent.
   */
  isSelected?: boolean;
  /**
   * Whether the toggle-context gate (filter active + filter-matched +
   * not dimmed) passes for this line. Surfaced on the inner element
   * so the CSS can drive a "this line is clickable to expand context"
   * hint (cursor + hover bg) without LogLine needing to know
   * FilterState shape.
   */
  canToggleContext?: boolean;
  /** Currently unused inside LogLine — click is handled at the <li>. */
  onToggleContext?: (lineId: string) => void;
};

const LEVEL_PREFIX: Record<Level, string | null> = {
  INFO: null,
  WARN: "WARN",
  ERROR: "ERROR",
  DEBUG: null,
};

const LEVEL_PREFIX_CLASS: Record<"WARN" | "ERROR", string> = {
  WARN: styles.levelWARN,
  ERROR: styles.levelERROR,
};

function formatTime(timestamp: number): string {
  // UTC formatting keeps the rendered output deterministic across test
  // environments and locales. Real-product time-zone handling is a later
  // concern (see the time-format toggle in the spec).
  const d = new Date(timestamp);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(
    d.getUTCSeconds(),
  )}`;
}

export function LogLine({
  line,
  isDimmed,
  isSelected,
}: LogLineProps) {
  if (line.isDeployBoundary) {
    // Deploy boundaries don't participate in View Context — they're
    // global section markers, not anchorable rows. They also never
    // dim, so they don't carry a data-dimmed attribute.
    return (
      <div className={styles.deployBoundary} role="separator">
        <span className={styles.deployRule} aria-hidden="true" />
        <span className={styles.deployText}>{line.message}</span>
        <span className={styles.deployRule} aria-hidden="true" />
      </div>
    );
  }

  const prefix = LEVEL_PREFIX[line.level];

  return (
    <div
      className={styles.line}
      data-level={line.level}
      data-dimmed={isDimmed ?? false}
      data-selected={isSelected ?? false}
    >
      <time
        className={styles.time}
        dateTime={new Date(line.timestamp).toISOString()}
      >
        {formatTime(line.timestamp)}
      </time>
      <span className={styles.instance}>{line.instance}</span>
      <span className={styles.message}>
        {prefix && (
          <span
            className={LEVEL_PREFIX_CLASS[line.level as "WARN" | "ERROR"]}
          >
            {prefix}
          </span>
        )}
        {prefix ? ` ${line.message}` : line.message}
        {line.requestId && (
          <span className={styles.requestId}>{line.requestId}</span>
        )}
      </span>
    </div>
  );
}
