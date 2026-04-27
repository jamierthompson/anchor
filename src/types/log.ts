/**
 * Log line types.
 *
 * The source log array is fixed for the lifetime of the page — lines never
 * mount or unmount, only their visibility and styling change. Filtering and
 * View Context are expressed as derived state computed on top of the fixed
 * array, which is what makes the height/opacity animation possible.
 *
 * Splitting raw (`LogLine`) from derived (`DerivedLogLine`) keeps the source
 * data a true immutable fixture and makes the visibility/dimming rule a pure
 * function of (raw lines, active filter, open context windows).
 */

/** The four log severity levels. WARN and ERROR render with visible badges. */
export type Level = "INFO" | "WARN" | "ERROR" | "DEBUG";

/**
 * A single log line in the fixed source array.
 *
 * Every field is `readonly` — anything that varies per render (visibility,
 * dimming, focus, selection) lives outside this type.
 */
export type LogLine = {
  /** Stable unique id; used as React key and for context-window membership. */
  readonly id: string;
  /** Milliseconds since epoch. */
  readonly timestamp: number;
  /** Short instance id, e.g. "7tbsm". */
  readonly instance: string;
  /** Set when the line is part of a request lifecycle; absent for non-request lines. */
  readonly requestId?: string;
  readonly level: Level;
  readonly message: string;
  /** Marks deploy-event lines (the 🎉 dividers), which stay visible regardless of filter. */
  readonly isDeployBoundary?: boolean;
};

/**
 * A log line plus the two flags computed from the active filter and any
 * open View Context windows. Recomputed on every filter or context change
 * by the unified rule:
 *
 *   isVisible = matchesFilter || inAnyContextWindow
 *   isDimmed  = isVisible && !matchesFilter
 *
 * `isDimmed` is only meaningful when `isVisible` is true.
 */
export type DerivedLogLine = LogLine & {
  /** Drives DOM presence and height. */
  readonly isVisible: boolean;
  /** Drives opacity. */
  readonly isDimmed: boolean;
};
