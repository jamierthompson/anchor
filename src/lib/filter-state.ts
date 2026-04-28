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
 * Actions are a discriminated union by action `type`. Each action carries
 * exactly the fields it needs so callers can't accidentally mismatch a
 * level value with the instances facet.
 *
 * Toggle (rather than separate add/remove) collapses three callsites onto
 * one shape: clicking a value in the popover, clicking an instance/level/
 * request-id badge inside a log line, and clicking the × on a chip all
 * end up calling the same action. The chip × case toggles a value that
 * is by definition present, which is correct.
 */

import type { Level } from "@/types/log";

export type Facet = "instances" | "requestIds" | "levels";

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
  | { type: "toggleInstance"; value: string }
  | { type: "toggleRequestId"; value: string }
  | { type: "toggleLevel"; value: Level }
  | { type: "clearFacet"; facet: Facet };

/** Add `value` if absent, remove it if present. Returns the same array reference when no-op-equivalent isn't possible — we always return a new array on change so React sees the update. */
function toggle<T>(values: readonly T[], value: T): readonly T[] {
  return values.includes(value)
    ? values.filter((v) => v !== value)
    : [...values, value];
}

export function filterReducer(
  state: FilterState,
  action: FilterAction,
): FilterState {
  switch (action.type) {
    case "toggleInstance":
      return { ...state, instances: toggle(state.instances, action.value) };
    case "toggleRequestId":
      return { ...state, requestIds: toggle(state.requestIds, action.value) };
    case "toggleLevel":
      return { ...state, levels: toggle(state.levels, action.value) };
    case "clearFacet":
      // Used by cmd/ctrl + click on a chip — wipes every value of that facet.
      return { ...state, [action.facet]: [] };
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
