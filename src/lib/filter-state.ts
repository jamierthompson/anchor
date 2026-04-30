/**
 * Filter state and reducer.
 *
 * Three facets, each a flat list of selected values:
 *   - instances   — instance ids the user has chipped in
 *   - requestIds  — request ids the user has chipped in
 *   - levels      — log severity levels the user has chipped in
 *
 * Within a facet, values combine with OR ("show me 7tbsm OR a3kx2").
 * Across facets, the overall query is AND ("instances above AND level=ERROR").
 * The OR/AND rule itself lives in `derive-lines.ts` — this file only owns
 * the shape and the transitions.
 *
 * The user-facing filter UI is the scenario-chips bar (a small fixed set
 * of preset filter states, mutually exclusive). Chips dispatch the full
 * target FilterState atomically rather than composing per-facet toggles —
 * the reducer here only needs to swap state wholesale or clear it.
 */

import type { Level, LogLine } from "@/types/log";

export type FilterState = {
  readonly instances: readonly string[];
  readonly requestIds: readonly string[];
  readonly levels: readonly Level[];
};

export const initialFilterState: FilterState = {
  instances: [],
  requestIds: [],
  levels: [],
};

export type FilterAction =
  | { type: "setFilter"; state: FilterState }
  | { type: "clear" };

export function filterReducer(
  _state: FilterState,
  action: FilterAction,
): FilterState {
  // Both transitions replace the prior state wholesale — there's nothing
  // to merge in from `_state`. Underscore-prefixed to satisfy
  // noUnusedParameters while preserving the (state, action) signature
  // useReducer requires.
  switch (action.type) {
    case "setFilter":
      return action.state;
    case "clear":
      return initialFilterState;
  }
}

/** Convenience for components that need a quick "are any filters active?" check. */
export function hasAnyFilter(state: FilterState): boolean {
  return (
    state.instances.length > 0 ||
    state.requestIds.length > 0 ||
    state.levels.length > 0
  );
}

/**
 * Whether two filter states represent the same active filter. Used by
 * the scenario chip bar to decide which preset is currently "on" without
 * having to track an extra "active chip" state alongside the filter
 * itself — single source of truth lives in FilterState.
 */
export function filterStatesEqual(a: FilterState, b: FilterState): boolean {
  return (
    arraysEqual(a.instances, b.instances) &&
    arraysEqual(a.requestIds, b.requestIds) &&
    arraysEqual(a.levels, b.levels)
  );
}

function arraysEqual<T>(a: readonly T[], b: readonly T[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Whether a line passes the active filter (AND across facets, OR within).
 * With no facets active, every line trivially matches.
 *
 * Public so consumers like LogExplorer can predict whether a single line
 * would be visible under a candidate filter state without re-running the
 * full deriveLines pipeline.
 */
export function lineMatchesFilter(
  line: LogLine,
  filter: FilterState,
): boolean {
  if (!hasAnyFilter(filter)) return true;
  if (
    filter.instances.length > 0 &&
    !filter.instances.includes(line.instance)
  ) {
    return false;
  }
  if (filter.requestIds.length > 0) {
    if (!line.requestId || !filter.requestIds.includes(line.requestId)) {
      return false;
    }
  }
  if (filter.levels.length > 0 && !filter.levels.includes(line.level)) {
    return false;
  }
  return true;
}
