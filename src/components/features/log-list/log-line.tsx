import type { MouseEvent as ReactMouseEvent } from "react";

import { DEFAULT_CONTEXT_RANGE } from "@/lib/context-state";
import type { FilterToggleTarget } from "@/lib/filter-state";
import type { LogLine as LogLineType, Level } from "@/types/log";

import { LineActions } from "./line-actions";

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
 *     word; DEBUG dims the entire message; INFO uses the default text
 *     color. Request IDs append as a small badge at the end of the
 *     message column.
 *
 * Click-to-filter (spec §8): when an `onFilterToggle` callback is
 * supplied, the instance pill, the WARN/ERROR level badge, and the
 * request-id badge each become buttons that announce a filter target
 * to the parent. With no callback, those elements render as plain
 * spans — the static-render path stays usable for tests, snapshots,
 * and any future read-only context.
 *
 * Click-to-toggle-context (spec §7 modifiers): when an `onToggleContext`
 * callback is supplied, cmd/ctrl + click anywhere on the line body
 * (outside a pill or badge button) announces the line id to the parent,
 * which decides whether to open or close a context window. The
 * pill/badge button onClick handlers `stopPropagation` so a modifier
 * click on those still adds a filter rather than also opening a context.
 *
 * Hover-revealed line actions (spec §8 — redesigned from the originally-
 * planned kebab menu): when `onToggleContext` is supplied, a row of
 * small icon buttons reveals at the right edge on hover (or while the
 * line is keyboard-focused). Plain `<button>` elements with no
 * dropdown / portal / open-state machinery — direct manipulation, no
 * Radix mount/unmount churn during context toggles. See the LineActions
 * component below.
 */

type LogLineProps = {
  line: LogLineType;
  /**
   * Whether this line is currently rendered (vs collapsed by Motion to
   * height: 0). Threads through to LineActions so the action row only
   * renders for visible rows — rendering plain buttons for ~390 hidden
   * lines is wasted React reconciliation work on every state change.
   */
  isVisible?: boolean;
  /**
   * Drives the dim opacity. Lives on the inner element (this component's
   * root) so it composes cleanly with the visibility opacity that Motion
   * applies to the parent <li> during expand/collapse — see
   * log-list.module.css for the composition rationale.
   */
  isDimmed?: boolean;
  /**
   * Whether this line is currently anchoring an open View Context
   * window. Drives the action-row label/icon flips ("View context" ↔
   * "Hide context") and gates the visibility of the Expand/Less
   * range-cycle buttons. The matching <li> also carries
   * `data-selected="true"` (set by LogList) which paints the left-
   * border accent.
   */
  isSelected?: boolean;
  /**
   * Whether the View context button should appear in the action row.
   * The §3 gate (filter active + line currently filter-matched + not
   * dimmed) is computed once in LogList and passed in pre-resolved;
   * LogLine doesn't need to know FilterState shape.
   * Spec §8: "hide items that don't apply rather than show disabled."
   */
  canToggleContext?: boolean;
  /**
   * The current ±N range of the open context on this line, if any.
   * Drives whether Expand / Less buttons render and which icons each
   * uses (the buttons hide at the endpoints of CONTEXT_RANGE_CYCLE).
   * Only meaningful when `isSelected` is true.
   */
  contextRange?: number;
  /**
   * `sourceLineId` lets the parent know which line the click originated
   * from — used as the converging-wave anchor so the stagger radiates
   * from the line the user actually interacted with. Always set to
   * `line.id` when calling from a pill button.
   */
  onFilterToggle?: (target: FilterToggleTarget, sourceLineId: string) => void;
  onToggleContext?: (lineId: string) => void;
  /**
   * Steps the open context's range to the next entry in
   * CONTEXT_RANGE_CYCLE. Bound to the "Expand context" icon button.
   */
  onExpandContext?: (lineId: string) => void;
  /**
   * Steps the open context's range to the previous entry in
   * CONTEXT_RANGE_CYCLE. Bound to the "Less context" icon button.
   */
  onLessContext?: (lineId: string) => void;
  /**
   * Copies a plain-text representation of this line to the clipboard.
   * Bound to the "Copy line" icon button.
   */
  onCopyLine?: (lineId: string) => void;
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
  isVisible,
  isDimmed,
  isSelected,
  canToggleContext,
  contextRange,
  onFilterToggle,
  onToggleContext,
  onExpandContext,
  onLessContext,
  onCopyLine,
}: LogLineProps) {
  if (line.isDeployBoundary) {
    // Deploy boundaries don't participate in View Context — they're
    // global section markers (spec §5), not anchorable rows. They also
    // never dim, so they don't carry a data-dimmed attribute.
    return (
      <div className={styles.deployBoundary} role="separator">
        <span className={styles.deployRule} aria-hidden="true" />
        <span className={styles.deployText}>{line.message}</span>
        <span className={styles.deployRule} aria-hidden="true" />
      </div>
    );
  }

  const prefix = LEVEL_PREFIX[line.level];
  const messageClass =
    line.level === "DEBUG" ? styles.messageMuted : styles.message;

  const handleLineClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!onToggleContext) return;
    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      onToggleContext(line.id);
    }
  };

  // Pill / badge button clicks must not bubble — without stopPropagation
  // a cmd + click on, say, an instance pill would both add a filter and
  // toggle a context on the same gesture. Each click also passes the
  // host line's id as the wave-anchor source — see LogList.
  const stopAndFilter =
    (target: FilterToggleTarget) =>
    (event: ReactMouseEvent<HTMLButtonElement>) => {
      event.stopPropagation();
      onFilterToggle?.(target, line.id);
    };

  return (
    <div
      className={styles.line}
      data-level={line.level}
      data-dimmed={isDimmed ?? false}
      data-selected={isSelected ?? false}
      onClick={onToggleContext ? handleLineClick : undefined}
    >
      <time
        className={styles.time}
        dateTime={new Date(line.timestamp).toISOString()}
      >
        {formatTime(line.timestamp)}
      </time>
      {onFilterToggle ? (
        <button
          type="button"
          className={`${styles.filterTrigger} ${styles.instance}`}
          onClick={stopAndFilter({
            facet: "instance",
            value: line.instance,
          })}
          aria-label={`Filter by instance ${line.instance}`}
        >
          {line.instance}
        </button>
      ) : (
        <span className={styles.instance}>{line.instance}</span>
      )}
      <span className={messageClass}>
        {prefix &&
          (onFilterToggle ? (
            <button
              type="button"
              className={`${styles.filterTrigger} ${
                LEVEL_PREFIX_CLASS[line.level as "WARN" | "ERROR"]
              }`}
              onClick={stopAndFilter({
                facet: "level",
                value: line.level,
              })}
              aria-label={`Filter by level ${prefix}`}
            >
              {prefix}
            </button>
          ) : (
            <span
              className={
                LEVEL_PREFIX_CLASS[line.level as "WARN" | "ERROR"]
              }
            >
              {prefix}
            </span>
          ))}
        {prefix ? ` ${line.message}` : line.message}
        {line.requestId &&
          (onFilterToggle ? (
            <button
              type="button"
              className={`${styles.filterTrigger} ${styles.requestId}`}
              onClick={stopAndFilter({
                facet: "requestId",
                value: line.requestId,
              })}
              aria-label={`Filter by request id ${line.requestId}`}
            >
              {line.requestId}
            </button>
          ) : (
            <span className={styles.requestId}>{line.requestId}</span>
          ))}
      </span>
      {onToggleContext ? (
        <LineActions
          lineId={line.id}
          isVisible={isVisible ?? true}
          isSelected={isSelected ?? false}
          canToggleContext={canToggleContext ?? false}
          contextRange={contextRange ?? DEFAULT_CONTEXT_RANGE}
          onToggleContext={onToggleContext}
          onExpandContext={onExpandContext}
          onLessContext={onLessContext}
          onCopyLine={onCopyLine}
        />
      ) : null}
    </div>
  );
}

