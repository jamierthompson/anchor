"use client";

import { MotionConfig } from "motion/react";
import { useCallback, useMemo, useReducer, useState } from "react";

import { FilterBar } from "@/components/features/filter-bar/filter-bar";
import { LogList } from "@/components/features/log-list/log-list";
import {
  DEFAULT_CONTEXT_RANGE,
  type OpenContext,
} from "@/lib/context-state";
import { deriveLines } from "@/lib/derive-lines";
import {
  actionForTarget,
  filterReducer,
  hasAnyFilter,
  initialFilterState,
  lineMatchesFilter,
  type FilterAction,
  type FilterToggleTarget,
} from "@/lib/filter-state";
import type { LogLine } from "@/types/log";

import styles from "./log-explorer.module.css";

/**
 * Client wrapper that owns interactive state for the log view.
 *
 * Lives on the client because it holds filter state via useReducer.
 * The page itself stays a server component and passes the static
 * mock data in as a prop, which keeps the data import on the server
 * side of the boundary.
 *
 * Filter state changes are folded into the rendered list via
 * deriveLines, memoized so the recompute only fires when either the
 * input array or the filter state changes. Open context windows will
 * become a third dependency in task #3.
 */
export function LogExplorer({ lines }: { lines: readonly LogLine[] }) {
  const [filterState, rawDispatch] = useReducer(
    filterReducer,
    initialFilterState,
  );

  // Single open context for task #3. Task #6 makes this an array; the
  // unified rule already handles multiple windows, so widening here is
  // a one-line change when that lands.
  const [openContext, setOpenContext] = useState<OpenContext | null>(null);

  /**
   * Filter dispatch wrapper that also clears the open context when the
   * pending filter change would put it past its activation gate.
   *
   * The activation gate (used by handleToggleContext below) is: at
   * least one filter is active AND the line matches the filter. Mirror
   * that gate on filter changes — if either side fails after the
   * dispatch, drop the saved context. This covers two cases:
   *
   *   - All filters cleared (e.g. removing the last chip) → !hasAnyFilter
   *     → clear. Spec §3 hides the View Context affordance entirely
   *     when no filter is active, so an open context shouldn't survive
   *     reaching that state.
   *   - Filter narrows past the selected line → !lineMatchesFilter →
   *     clear. Diverges from spec §5's "preserve so loosening brings
   *     it back" — a stale accent on a hidden line is more confusing
   *     than the power-user nicety of context auto-restore.
   *
   * Doing this in the dispatch path (rather than a post-render effect)
   * keeps the cleanup atomic with the filter change and avoids a
   * separate render-then-cleanup round-trip.
   */
  const dispatchFilter = useCallback(
    (action: FilterAction) => {
      rawDispatch(action);
      if (!openContext) return;
      const nextFilter = filterReducer(filterState, action);
      const selected = lines.find(
        (l) => l.id === openContext.selectedLineId,
      );
      if (!selected) return;
      const stillActivatable =
        hasAnyFilter(nextFilter) &&
        lineMatchesFilter(selected, nextFilter);
      if (!stillActivatable) {
        setOpenContext(null);
      }
    },
    [filterState, openContext, lines],
  );

  const derivedLines = useMemo(
    () => deriveLines(lines, filterState, openContext ? [openContext] : []),
    [lines, filterState, openContext],
  );

  const handleFilterToggle = useCallback(
    (target: FilterToggleTarget) =>
      dispatchFilter(actionForTarget(target)),
    [dispatchFilter],
  );

  /**
   * Toggle a View Context window on the given line.
   *
   * Spec §3 gates: only available on filter-matched (non-context-only)
   * lines, and only when at least one filter is active. The first guard
   * checks the dimmed flag of the derived line — a dimmed line is
   * visible only because some other context revealed it, so opening a
   * nested context on it is disallowed.
   *
   * Toggling on the currently selected line closes the context.
   */
  const handleToggleContext = useCallback(
    (lineId: string) => {
      if (!hasAnyFilter(filterState)) return;
      const target = derivedLines.find((l) => l.id === lineId);
      if (!target || target.isDimmed) return;
      setOpenContext((current) =>
        current?.selectedLineId === lineId
          ? null
          : { selectedLineId: lineId, range: DEFAULT_CONTEXT_RANGE },
      );
    },
    [filterState, derivedLines],
  );

  return (
    // reducedMotion="user" honors the OS-level prefers-reduced-motion
    // setting — Motion drops durations to ~0 so the line transitions
    // don't run, but the final state still resolves correctly.
    <MotionConfig reducedMotion="user">
      <div className={styles.explorer}>
        <FilterBar state={filterState} dispatch={dispatchFilter} />
        <LogList
          lines={derivedLines}
          onFilterToggle={handleFilterToggle}
          onToggleContext={handleToggleContext}
          selectedLineId={openContext?.selectedLineId}
        />
      </div>
    </MotionConfig>
  );
}
