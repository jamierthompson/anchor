/**
 * The unified visibility / dimming rule.
 *
 * Per spec §3, for each line:
 *
 *   matchesFilter      = passes all active filters (AND across facets, OR within)
 *   inAnyContextWindow = sits within ±N of any line currently selected for context
 *
 *   isVisible = matchesFilter || inAnyContextWindow
 *   isDimmed  = isVisible && !matchesFilter
 *
 * Task #2 (this commit) ships the filter half only. Open context windows
 * arrive in task #3, at which point this function gains a third argument
 * and the `isDimmed` line below stops being a stub.
 *
 * Deploy boundaries are global section markers — they bypass the rule
 * entirely and are always visible, never dimmed (spec §5).
 *
 * Pure function on purpose: the visibility rule is the most testable
 * piece of the prototype, and keeping it free of React/state lets the
 * unit tests in commit #2 cover all seven filter combos directly.
 */

import type { DerivedLogLine, LogLine } from "@/types/log";

import { hasAnyFilter, type FilterState } from "./filter-state";

export function deriveLines(
  lines: readonly LogLine[],
  filter: FilterState,
): DerivedLogLine[] {
  const noFilter = !hasAnyFilter(filter);

  return lines.map((line) => {
    if (line.isDeployBoundary) {
      return { ...line, isVisible: true, isDimmed: false };
    }

    const matchesFilter = noFilter || matchesAllActiveFacets(line, filter);

    return {
      ...line,
      isVisible: matchesFilter,
      // Stub until task #3: dimming requires a context window covering an
      // unmatched line. With no contexts, every visible line is matched,
      // so isDimmed is always false here.
      isDimmed: false,
    };
  });
}

/**
 * Active facets combine with AND. Within a facet, values combine with OR
 * (handled by `Array.includes` against the line's single value).
 *
 * An empty facet contributes nothing — a line passes a facet either by
 * having no values to filter against, or by matching at least one of
 * the values that are filtered against.
 */
function matchesAllActiveFacets(line: LogLine, filter: FilterState): boolean {
  if (
    filter.instances.length > 0 &&
    !filter.instances.includes(line.instance)
  ) {
    return false;
  }

  if (filter.requestIds.length > 0) {
    // A line with no requestId can never match an active request-id filter.
    if (!line.requestId || !filter.requestIds.includes(line.requestId)) {
      return false;
    }
  }

  if (filter.levels.length > 0 && !filter.levels.includes(line.level)) {
    return false;
  }

  return true;
}
