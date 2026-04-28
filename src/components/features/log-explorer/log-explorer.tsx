"use client";

import { useCallback, useMemo, useReducer } from "react";

import { FilterBar } from "@/components/features/filter-bar/filter-bar";
import { LogList } from "@/components/features/log-list/log-list";
import { deriveLines } from "@/lib/derive-lines";
import {
  actionForTarget,
  filterReducer,
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

  const derivedLines = useMemo(
    () => deriveLines(lines, filterState),
    [lines, filterState],
  );

  // Stable identity so LogLine doesn't need to re-render every time
  // filterState changes; dispatch is itself stable from useReducer.
  const handleFilterToggle = useCallback(
    (target: FilterToggleTarget) => dispatch(actionForTarget(target)),
    [],
  );

  return (
    <div className={styles.explorer}>
      <FilterBar state={filterState} dispatch={dispatch} />
      <LogList lines={derivedLines} onFilterToggle={handleFilterToggle} />
    </div>
  );
}
