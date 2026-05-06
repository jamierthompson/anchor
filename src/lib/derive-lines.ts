/**
 * The unified visibility / dimming rule.
 *
 * For each line:
 *
 *   matchesFilter      = passes all active filters (AND across facets, OR within)
 *   inAnyContextWindow = sits within ±N of any line currently selected for context
 *
 *   isVisible = matchesFilter || inAnyContextWindow
 *   isDimmed  = isVisible && !matchesFilter
 *
 * Deploy boundaries are global section markers — they bypass the rule
 * entirely and are always visible, never dimmed.
 *
 * Selected-line-filtered-out auto-collapse: if the line an open
 * context is anchored on no longer matches the active filter, the
 * context goes dormant for the visibility computation — its windowed
 * lines collapse back to hidden rather than staying visible-dimmed.
 * The open-context state itself is preserved by the caller, so
 * loosening the filter brings the context back.
 *
 * Pure function on purpose: the visibility rule is the most testable
 * piece of the prototype, and keeping it free of React/state means
 * the unit tests can exercise filter combos and context windows
 * directly.
 */

import type { DerivedLogLine, LogLine } from "@/types/log";

import type { OpenContext } from "./context-state";
import { lineMatchesFilter, type FilterState } from "./filter-state";

export function deriveLines(
  lines: readonly LogLine[],
  filter: FilterState,
  openContexts: readonly OpenContext[] = [],
): DerivedLogLine[] {
  // Resolve each open context to a (selectedIndex, range) pair, and drop
  // any whose selected line doesn't match the active filter — those go
  // dormant per the auto-collapse rule above.
  const indexById = new Map<string, number>();
  for (let i = 0; i < lines.length; i++) {
    indexById.set(lines[i].id, i);
  }

  const activeWindows: { selectedIndex: number; range: number }[] = [];
  for (const ctx of openContexts) {
    const idx = indexById.get(ctx.selectedLineId);
    if (idx === undefined) continue;
    if (!lineMatchesFilter(lines[idx], filter)) continue;
    activeWindows.push({ selectedIndex: idx, range: ctx.range });
  }

  return lines.map((line, index) => {
    if (line.isDeployBoundary) {
      return { ...line, isVisible: true, isDimmed: false };
    }

    const matchesFilter = lineMatchesFilter(line, filter);

    const inAnyContextWindow = activeWindows.some(
      (w) => Math.abs(index - w.selectedIndex) <= w.range,
    );

    const isVisible = matchesFilter || inAnyContextWindow;
    const isDimmed = isVisible && !matchesFilter;

    return { ...line, isVisible, isDimmed };
  });
}
