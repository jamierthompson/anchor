import type { LogLine as LogLineType, Level } from "@/types/log";

import styles from "./log-line.module.css";

/**
 * Static renderer for a single log line.
 *
 * Two render shapes: deploy-boundary lines as a separator-style row
 * that stays visible regardless of filter, and regular lines as
 * structured time / instance / message content with optional level
 * and request-id metadata.
 *
 * The line itself is a single click target — the parent <li> handles
 * the click (focus + optional context toggle). Nothing inside this
 * component is interactive.
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
   * Drives the dim opacity. Lives on the inner element so it composes
   * multiplicatively with the visibility opacity applied to the parent
   * <li> during expand/collapse.
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
   * so the CSS can drive an affordance without this component needing
   * to know the filter state's shape.
   */
  canToggleContext?: boolean;
  // TODO: prop is unused — click handling moved to the parent <li>;
  // remove this and update call sites to stop passing it.
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
  // environments and locales.
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
    // dim, so they don't carry the dimmed attribute.
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
