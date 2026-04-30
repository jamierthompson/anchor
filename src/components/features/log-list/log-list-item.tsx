"use client";

import { motion, type Transition } from "motion/react";
import { memo, type MouseEvent as ReactMouseEvent } from "react";

import type { FilterToggleTarget } from "@/lib/filter-state";
import type { DerivedLogLine } from "@/types/log";

import { LogLine } from "./log-line";
import styles from "./log-list.module.css";

/**
 * Single row of the log list — `motion.li` + `LogLine`. Extracted from
 * LogList and wrapped in `React.memo` so live-tail ticks (which fire
 * setState in `useLiveTail` and propagate through LogExplorer →
 * LogList on every emission) don't re-render every existing row.
 *
 * ### Why this matters for animation smoothness
 *
 * Motion treats the `animate` prop's identity as a signal to re-evaluate
 * a tween. When the parent rebuilds `animate={{ height: ..., opacity: ... }}`
 * inline on every render, Motion may interrupt an in-flight height
 * transition (especially `"auto"`, which requires layout measurement)
 * and produce visible stutter. Memoizing this row means the inner
 * `motion.li` only sees new `animate` objects when one of the actual
 * inputs (`isVisible`) changes — its in-flight tween runs undisturbed
 * while a tail line lands.
 *
 * ### Memo key shape
 *
 * Default shallow equality. All callback props are stabilized via
 * `useCallback` in LogExplorer. The `expand`/`collapse` Transition
 * objects are module constants in LogList. The only per-row prop that
 * changes when a new tail line arrives is *that line's* `isStreamed`
 * flag at the moment it appends — every other row's props are
 * referentially equal to the previous render and the memo skips.
 *
 * ### Why not pass the Set/Map references through?
 *
 * `streamedLineIds` is a fresh `Set` per emission and
 * `selectedContextRangesById` is a fresh `Map` per derive. Passing
 * them down would defeat the memo for every row on every change.
 * LogList resolves the per-row boolean / number-or-undefined and
 * passes those primitives instead.
 */

type LogListItemProps = {
  line: DerivedLogLine;
  domId: string;
  /**
   * True only for lines that streamed in via live tail. Drives the
   * `motion.li`'s `initial` so streamed lines animate from
   * `{ height: 0, opacity: 0 }` and initial-fixture lines skip the
   * mount animation. Resolved once in LogList from
   * `streamedLineIds.has(line.id)` so we can pass a primitive instead
   * of the Set ref (which changes every tail tick).
   */
  isStreamed: boolean;
  isSelected: boolean;
  isFocused: boolean;
  contextRange: number | undefined;
  /**
   * §3 gate for the View/Hide context action. Pre-resolved in LogList
   * so this row doesn't need FilterState shape.
   */
  canToggleContext: boolean;
  /**
   * Active per-render Transition objects for expand and collapse.
   * Module-level constants in LogList — stable references, so they
   * don't break the memo. Picked by transitionMode at the LogList
   * layer.
   */
  expand: Transition;
  collapse: Transition;
  onLineFocus?: (lineId: string) => void;
  onFilterToggle?: (target: FilterToggleTarget, sourceLineId: string) => void;
  onToggleContext?: (lineId: string) => void;
  onExpandContext?: (lineId: string) => void;
  onLessContext?: (lineId: string) => void;
  onCopyLine?: (lineId: string) => void;
};

function LogListItemImpl({
  line,
  domId,
  isStreamed,
  isSelected,
  isFocused,
  contextRange,
  canToggleContext,
  expand,
  collapse,
  onLineFocus,
  onFilterToggle,
  onToggleContext,
  onExpandContext,
  onLessContext,
  onCopyLine,
}: LogListItemProps) {
  // Plain click on the <li> sets focus on this line. LogLine still
  // owns the modifier-click (cmd/ctrl) for context toggle and stops
  // propagation on its inner pill/badge buttons, so this only fires
  // for non-button clicks landing on the line body.
  const handleClick = (event: ReactMouseEvent<HTMLLIElement>) => {
    if (event.metaKey || event.ctrlKey) return;
    onLineFocus?.(line.id);
  };

  return (
    <motion.li
      id={domId}
      data-line-id={line.id}
      role="option"
      aria-selected={isSelected}
      className={styles.item}
      data-visible={line.isVisible}
      data-dimmed={line.isDimmed}
      data-selected={isSelected}
      data-focused={isFocused}
      onClick={handleClick}
      // Per-line `initial`:
      //   - Streamed lines (live tail) → animate from
      //     { height: 0, opacity: 0 } so they slide in from below
      //     with the same expand choreography as context reveal
      //     (spec §10.2).
      //   - Initial-fixture lines → initial={false} so the page-load
      //     render uses target values directly and doesn't trigger
      //     415 simultaneous animations.
      // After mount, isVisible toggles via `animate` only — initial
      // doesn't apply on subsequent renders.
      initial={isStreamed ? { height: 0, opacity: 0 } : false}
      animate={{
        height: line.isVisible ? "auto" : 0,
        opacity: line.isVisible ? 1 : 0,
      }}
      transition={line.isVisible ? expand : collapse}
    >
      <LogLine
        line={line}
        isVisible={line.isVisible}
        isDimmed={line.isDimmed}
        isSelected={isSelected}
        contextRange={contextRange}
        canToggleContext={canToggleContext}
        onFilterToggle={onFilterToggle}
        onToggleContext={onToggleContext}
        onExpandContext={onExpandContext}
        onLessContext={onLessContext}
        onCopyLine={onCopyLine}
      />
    </motion.li>
  );
}

/**
 * Memoized row component. See file-level docblock for why this matters.
 */
export const LogListItem = memo(LogListItemImpl);
