"use client";

import { useReducer } from "react";

import { FilterBar } from "@/components/features/filter-bar/filter-bar";
import { LogList } from "@/components/features/log-list/log-list";
import {
  filterReducer,
  initialFilterState,
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
 * In this commit, the FilterBar is wired to real state but the
 * LogList still receives raw lines — chips will render and toggle,
 * but the list won't yet hide or dim anything. Wiring the list to
 * derived lines is the next commit on this branch.
 */
export function LogExplorer({ lines }: { lines: readonly LogLine[] }) {
  const [filterState, dispatch] = useReducer(
    filterReducer,
    initialFilterState,
  );

  return (
    <div className={styles.explorer}>
      <FilterBar state={filterState} dispatch={dispatch} />
      <LogList lines={lines} />
    </div>
  );
}
