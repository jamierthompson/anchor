"use client";

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
  const [filterState, dispatch] = useReducer(
    filterReducer,
    initialFilterState,
  );

  // Single open context for task #3. Task #6 makes this an array; the
  // unified rule already handles multiple windows, so widening here is
  // a one-line change when that lands.
  const [openContext, setOpenContext] = useState<OpenContext | null>(null);

  const derivedLines = useMemo(
    () => deriveLines(lines, filterState, openContext ? [openContext] : []),
    [lines, filterState, openContext],
  );

  const handleFilterToggle = useCallback(
    (target: FilterToggleTarget) => dispatch(actionForTarget(target)),
    [],
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
    <div className={styles.explorer}>
      <FilterBar state={filterState} dispatch={dispatch} />
      <LogList
        lines={derivedLines}
        onFilterToggle={handleFilterToggle}
        onToggleContext={handleToggleContext}
        selectedLineId={openContext?.selectedLineId}
      />
    </div>
  );
}
